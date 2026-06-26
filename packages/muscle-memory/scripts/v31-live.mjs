#!/usr/bin/env node
// v3.1 LIVE end-to-end: reviewAndAuthor on a REAL model (NOUS) against the agent's REAL skill
// library — proving cross-conversation evidence + MemFS update-first routing fire live.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir, homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-v31-live.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const { __mm: M } = await import(OUT + "?t=" + Date.now());

const NOUS = "https://inference-api.nousresearch.com/v1/chat/completions";
const KEY = process.env.NOUS_API_KEY;
const MODEL = process.env.MM_AUTHOR_MODEL || "stepfun/step-3.7-flash:free";
const author = async (sys, user) => {
  const r = await fetch(NOUS, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODEL, max_tokens: 6000, temperature: 0.3, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) });
  if (!r.ok) throw new Error(`${MODEL} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const m = (await r.json()).choices?.[0]?.message || {};
  return String(m.content || "").trim(); // stepfun is a reasoning model; needs headroom to emit content
};

// Real grounded cross-conversation evidence for a domain the agent ALREADY has a skill for.
const EVIDENCE = `CROSS-CONVERSATION EVIDENCE (agent recall over ~8 sessions of Letta Code mod development):
- recovered failure: a mod tool returned "unknown action" → fixed because tool args arrive via ctx.args, not run()'s first positional param: run(ctx){ const a = ctx.args } [4x across sessions]
- recovered failure: a backup named mod.bak.ts double-registered (loader scans any .ts in ~/.letta/mods) → fixed by suffixing backups so they don't end in .ts [3x]
- recurring workflow: validate a mod edit with "npx esbuild <mod>.ts --bundle --platform=node --format=esm" before claiming it works [11x]
- recurring failure (no clean fix): a new tool/command isn't callable until /reload [5x]
- "letta mods list" showing enabled is the authoritative load proof [6x]
- (a couple env-only blips: "command not found: rg" — transient, ignore)`;

const skillsDir = process.env.MEMORY_DIR ? join(process.env.MEMORY_DIR, "skills") : join(homedir(), ".letta", "skills");

(async () => {
  if (!KEY) { console.error("NOUS_API_KEY not set"); process.exit(1); }
  console.log(`model=${MODEL}\nskills dir: ${skillsDir} (exists: ${existsSync(skillsDir)})\n`);

  // 1) MemFS update-first retrieval against the REAL skill library
  const found = M.searchSkills([skillsDir], EVIDENCE, 3);
  console.log("memfs search (real skills) top hits:");
  for (const f of found) console.log(`  - ${f.name}  (score ${f.score})  ${f.description.slice(0, 60)}`);
  console.log();

  // 2) LIVE author + route (real model)
  console.log("authoring (live model, update-first routing)...");
  const res = await M.reviewAndAuthor(EVIDENCE, [skillsDir], author);
  console.log(`\n=== RESULT: action=${res.action}${res.updateTarget ? ` updateTarget=${res.updateTarget}` : ""} name=${res.name || "-"} ===`);
  if (res.reason) console.log("reason:", res.reason);
  if (res.content) console.log("\n--- authored SKILL.md (first 1400 chars) ---\n" + res.content.slice(0, 1400));

  const fs = await import("node:fs");
  fs.writeFileSync(new URL("../v31-live-result.json", import.meta.url), JSON.stringify({ ts: new Date().toISOString(), model: MODEL, topHits: found, action: res.action, name: res.name, updateTarget: res.updateTarget, content: res.content }, null, 2));
  console.log("\nreceipt -> v31-live-result.json");
  // surpass assertion: either routed to UPDATE an existing skill (anti-bloat) or authored a clean class-level skill
  const win = res.action === "update" || (res.action === "create" && M.isValidSkillName(res.name));
  console.log(win ? "\nLIVE SURPASS BEHAVIOR: ✓ (update-first anti-bloat OR clean class-level authoring)" : "\n✗ unexpected result");
  process.exit(win ? 0 : 1);
})();
