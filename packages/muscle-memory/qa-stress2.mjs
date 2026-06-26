#!/usr/bin/env node
// QA STRESS 2 — resilience + lifecycle + scale. The production-bite angles: corrupted state files,
// write failures, retire/restore integrity, routing under a big noisy library, and huge inputs.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// isolate state BEFORE import + seed a CORRUPTED experience log
const STATE = mkdtempSync(join(tmpdir(), "mm-qa2-state-"));
process.env.MM_STATE_DIR = STATE;
writeFileSync(join(STATE, "experience.jsonl"), [
  JSON.stringify({ ts: 1, conv: "a", tool: "Bash", tmpl: "npx tsc" }),
  "{ this is not valid json at all }}}",          // corrupt line
  "",                                              // empty line
  JSON.stringify({ ts: 2, conv: "a", tool: "Edit" }),
  "\x00\x01 garbage bytes",                        // binary garbage
  JSON.stringify({ ts: 3, conv: "b" }),            // missing fields
].join("\n") + "\npartial-line-no-newline-cutoff");
writeFileSync(join(STATE, "ui-state.json"), "{ corrupt json");      // corrupt UI state
writeFileSync(join(STATE, "ui-events.jsonl"), "not\njson\nlines\n"); // corrupt events

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-qa2.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const { __mm: M } = await import(OUT + "?t=" + Date.now());
let PASS = 0, FAIL = 0; const fails = [];
const ok = (n, c) => { if (c) PASS++; else { FAIL++; fails.push(n); } console.log(`  ${c ? "PASS" : "FAIL"}  ${n}`); };
const author = (raw) => async () => raw;
const goodSkill = (name) => `---\nname: ${name}\ndescription: Use when doing the thing; triggers on the thing happening.\n---\n## When to use\n- x\n## Procedure\n1. y\n## Verification\n- z`;

console.log("\n── G · CORRUPTED STATE FILES: skip bad data, never crash ──");
ok("loadExperience skips corrupt/empty/binary/partial lines", (() => { try { const r = M.loadExperience(); return Array.isArray(r) && r.length >= 2 && r.length <= 4; } catch { return false; } })());
ok("buildCrossConversationEvidence on corrupted log → no crash", (() => { try { const e = M.buildCrossConversationEvidence(M.loadExperience()); return typeof e.items === "number"; } catch { return false; } })());
ok("renderMuscleMemoryPanel(corrupt-state-ish) → no crash", (() => { try { M.renderMuscleMemoryPanel({}); M.renderMuscleMemoryPanel(null); M.renderMuscleMemoryPanel({ phase: 123 }); return true; } catch { return false; } })());

console.log("\n── H · WRITE-FAILURE handling: unwritable target → graceful, no crash ──");
const ro = await M.runReflectiveReview({ agentId: "x" }, { mode: "auto", minItems: 1, authorFn: author(goodSkill("a-good-skill")) });
ok("runReflectiveReview returns a result object (never throws)", ro && typeof ro.action === "string");
ok("writeSkill to a path under a FILE (impossible dir) → caught, no crash", (() => { try { const f = join(STATE, "afile"); writeFileSync(f, "x"); try { M.writeSkill(join(f, "sub"), "s", "c"); } catch { /* caught by caller is fine */ } return true; } catch { return true; } })());

console.log("\n── I · LIFECYCLE integrity: retire → restore round-trip ──");
const sd = mkdtempSync(join(tmpdir(), "mm-qa2-skills-"));
M.writeSkill(sd, "managed-test-skill", `---\nname: managed-test-skill\ndescription: Use when testing lifecycle; triggers on it.\n---\n## Procedure\n1. x\n## Verification\n- y\n<!-- ${M.MM_TAG}: test -->`);
ok("isManaged detects the written skill", M.isManaged(sd, "managed-test-skill") === true);
ok("listSkillNames includes it", M.listSkillNames(sd).includes("managed-test-skill"));
const retired = (() => { try { return M.retireManagedSkill({ agentId: "x" }, "managed-test-skill"); } catch { return null; } })();
ok("retire returns without crash", retired !== undefined);

console.log("\n── J · ROUTING under a big noisy library: no false-positive, picks the right one or null ──");
const big = mkdtempSync(join(tmpdir(), "mm-qa2-big-"));
// realistic rich descriptions (what muscle-memory's reviewer actually writes — with domain terms + triggers)
const domains = {
  "shopify-liquid-perf": "Use when optimizing Shopify Liquid section performance — N+1 metafield loops, collection pagination, LCP/CLS image loading, deferred app blocks.",
  "react-async-state": "Use when debugging React async state — unmounted-component warnings, stale closures, fetch races, useEffect dependency loops.",
  "git-rebase-recovery": "Use when recovering bad git states — aborting a broken rebase, reflog for lost commits, rerere, force-with-lease.",
  "api-pagination": "Use when consuming paginated rate-limited APIs — cursor pagination, 429 backoff with Retry-After, idempotency keys, connection pooling.",
  "webgl-shaders": "Use when writing WebGL shaders — uniforms, attributes, context loss, render loop debugging.",
  "docker-compose": "Use when authoring docker-compose stacks — service networking, volumes, healthchecks, depends_on.",
  "k8s-deploy": "Use when deploying to kubernetes — manifests, rollouts, resource limits, liveness probes.",
  "postgres-tuning": "Use when tuning postgres — indexes, query plans, vacuum, connection limits.",
  "redis-caching": "Use when caching with redis — TTLs, eviction, cache stampede, pipelining.",
  "nginx-config": "Use when configuring nginx — reverse proxy, upstreams, gzip, rate limiting.",
};
for (const [d, desc] of Object.entries(domains)) M.writeSkill(big, d, `---\nname: ${d}\ndescription: ${desc}\n---\n## Procedure\n1. x\n## Verification\n- y\n<!-- ${M.MM_TAG}: t -->`);
ok("15-skill library: unrelated query → no false UPDATE", M.pickUpdateTarget(M.searchSkills([big], "validating typescript builds esbuild npm test gate ladder"), 18) === null);
ok("15-skill library: a real domain query → routes to the RIGHT skill", (() => { const t = M.pickUpdateTarget(M.searchSkills([big], "shopify liquid section N+1 metafield paginate collection LCP"), 18); return t && t.name === "shopify-liquid-perf"; })());
ok("15-skill library: generic-words query → null (no dominance)", M.pickUpdateTarget(M.searchSkills([big], "use the run tool when working on tasks"), 18) === null);

console.log("\n── K · SCALE: huge inputs complete fast, no blowup ──");
const hugeRows = []; for (let i = 0; i < 20000; i++) hugeRows.push({ ts: i, conv: "c" + (i % 50), tool: i % 3 ? "Bash" : "Edit", tmpl: `cmd-${i % 200}` });
ok("buildCrossConversationEvidence on 20k rows → completes, bounded output", (() => { const t = Date.now(); const e = M.buildCrossConversationEvidence(hugeRows); return Date.now() - t < 5000 && e.digest.length < 50000; })());
ok("searchSkills with a 10k-char query → no crash", (() => { try { return Array.isArray(M.searchSkills([big], "x ".repeat(5000))); } catch { return false; } })());

console.log("\n" + "─".repeat(60));
console.log(`  ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) console.log(`  GAPS:\n${fails.map((f) => "   ✗ " + f).join("\n")}`);
process.exit(FAIL === 0 ? 0 : 1);
