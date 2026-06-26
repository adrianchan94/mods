#!/usr/bin/env node
// REPLICATE PAST WORKFLOWS: feed muscle-memory's reviewer my REAL cross-session workflow history
// (from the playbook) with a FRONTIER author (Gemini/antigravity), route against my REAL skill
// library (MemFS), and show what skills it generates + whether it correctly UPDATES vs CREATEs.
// Proves muscle-memory works across a variety of real tasks and produces frontier-level skills.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-replicate.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const { __mm: M } = await import(OUT + "?t=" + Date.now());

const MEM = process.env.MEMORY_DIR || join(process.env.HOME, ".letta", "lc-local-backend", "memfs", "agent-local-be7d4413-490c-4d42-aa91-7a2537c9b8a1", "memory");
const skillsDir = join(MEM, "skills");
const AURL = "http://127.0.0.1:9880/v1/chat/completions", AMODEL = "gemini-3.5-flash-antigravity";
const gemini = async (sys, user) => {
  for (let a = 0; a < 2; a++) { try { const r = await fetch(AURL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer not-needed" }, body: JSON.stringify({ model: AMODEL, max_tokens: 2200, temperature: 0.4, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) }); const out = String((await r.json()).choices?.[0]?.message?.content || "").trim(); if (out) return out; } catch { await new Promise((s) => setTimeout(s, 1500)); } }
  return "";
};

// REAL workflow clusters drawn from Mack's playbook (genuine cross-session lessons).
const WORKFLOWS = [
  { tag: "cloud-agent latency/approval forensics", evidence: `CROSS-CONVERSATION EVIDENCE (~5 sessions diagnosing slow/wedged cloud Letta agents):
- recovered: agent slow every turn → MEASURE per-turn load from the compiled context (GET /v1/agents/{id}/context: num_tokens_messages/functions/core_memory/system), not block sizes; the dominant cost was the MESSAGE-HISTORY BACKLOG (113K of 119K/turn); fix = roll a fresh conversation OR manual compact → ~119K→~15K (5-10x cut); [5x]
- recovered: "Cannot process approval response: No tool call is currently awaiting approval" recurring every turn → an orphaned approval baked into in_context_message_ids from switching models mid-tool-call; fix = roll a fresh conversation (also fixes the backlog); [4x]
- pitfall (learned the hard way): do NOT enable message_buffer_autoclear for latency — it is STATELESS mode (nukes the buffer → agent forgets the conversation), NOT compaction; use compaction or a fresh convo; [3x]
- pitfall: STORED-DEFAULT model != ACTIVE model — a fresh --yolo launch uses the agent's stored llm_config, not what you /model-switched to mid-session; sync the stored default or force -m; [3x]
- transient: a missing env var on a fresh shell (env-only).` },
  { tag: "browser / visual QA", evidence: `CROSS-CONVERSATION EVIDENCE (~5 sessions doing WebGL/browser visual QA):
- recovered: FPS numbers were fake-low → agent-browser is HEADLESS by default → software-renders WebGL; use --headed for real-GPU numbers and verify the renderer via WEBGL_debug_renderer_info; [4x]
- recovered: "WebGL Context Lost" + a washed-white blob → a Canvas was remounting per scene (key={scene}) → context exhaustion; fix = ONE persistent Canvas, swap the shader/uniform only; [3x]
- recurring: open→navigate→capture must run in ONE process — session/page state slips across separate CLI invocations; [4x]
- recurring: synthetic KeyboardEvent often won't trigger app handlers → use CDP-trusted press/wheel; screenshots are ground truth, DOM probes lie during transitions; [3x]
- transient: a browser binary missing on a fresh box (env-only).` },
  { tag: "letta mod development", evidence: `CROSS-CONVERSATION EVIDENCE (~8 sessions building Letta Code mods):
- recovered: tool returned "unknown action" → args arrive via ctx.args, NOT positional: run(ctx){ const a = ctx.args }; [4x]
- recovered: a "mod.bak.ts" backup double-registered → the loader scans any .ts in ~/.letta/mods; suffix backups so they don't end in .ts; [3x]
- recurring: validate a mod edit with npx esbuild <mod>.ts --bundle --platform=node --format=esm before claiming it works; [11x]
- recurring: a new tool/command isn't callable until /reload; [5x]
- transient: "command not found: rg" (env-only).` },
];

(async () => {
  console.log(`replicating ${WORKFLOWS.length} real workflow clusters · author=${AMODEL} · library=${skillsDir}\n`);
  const out = [];
  for (const w of WORKFLOWS) {
    const matches = M.searchSkills([skillsDir], w.evidence, 3);
    const tgt = M.pickUpdateTarget(matches, 18);
    const hint = tgt ? `\n\nUPDATE-FIRST: an existing skill already covers this — "${tgt.name}". Extend it (keep the name, fold in the new pitfalls).` : (matches.length ? `\n\nExisting skills (avoid duplicating): ${matches.map((m) => m.name).join(", ")}.` : "");
    const raw = (await gemini(M.REVIEW_PROMPT, w.evidence + hint)).replace(/^```(?:markdown|md)?\n?|\n?```$/g, "").trim();
    const name = (raw.match(/^name:\s*(.+)$/im) || raw.match(/^#\s+(.+)$/m) || [])[1]?.trim() || "?";
    console.log(`── ${w.tag} ──`);
    console.log(`   library route: ${tgt ? `UPDATE → ${tgt.name} (s${tgt.score}/m${tgt.matched})` : "CREATE"}${matches.length ? `   [top: ${matches.map((m) => `${m.name}(${m.score})`).join(", ")}]` : ""}`);
    console.log(`   generated skill: ${name}  (${raw.split("\n").length} lines, ${raw.length} chars)`);
    console.log(raw.split("\n").slice(0, 18).map((l) => "     " + l).join("\n"));
    console.log("");
    out.push({ tag: w.tag, route: tgt ? `UPDATE ${tgt.name}` : "CREATE", topMatches: matches, generatedName: name, skill: raw });
  }
  writeFileSync(new URL("../replicate-workflows-result.json", import.meta.url), JSON.stringify({ ts: new Date().toISOString(), author: AMODEL, library: skillsDir, results: out }, null, 2));
  console.log("receipt -> replicate-workflows-result.json");
})();
