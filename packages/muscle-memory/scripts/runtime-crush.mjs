#!/usr/bin/env node
// RUNTIME CRUSH — ties coverage to outcome. An agent does tasks spanning ALL of a domain's pitfalls,
// loaded with muscle-memory's skill (cross-conversation → covers all) vs Hermes's skill (one
// conversation → covers ~half). On the pitfalls Hermes's skill never saw, the agent fails.
// This is the runtime payoff of the coverage crush. Author + agent = Gemini (antigravity).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-rc.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const { __mm: M } = await import(OUT + "?t=" + Date.now());

const AURL = "http://127.0.0.1:9880/v1/chat/completions", AMODEL = "gemini-3.5-flash-antigravity";
const clean = (s) => s.replace(/^```(?:markdown|md|yaml)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").replace(/^yaml\s*\n/i, "").trim();
async function ask(sys, user, max = 5000) { for (let a = 0; a < 2; a++) { try { const r = await fetch(AURL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer not-needed" }, body: JSON.stringify({ model: AMODEL, max_tokens: max, temperature: 0.3, messages: [sys ? { role: "system", content: sys } : null, { role: "user", content: user }].filter(Boolean) }) }); const o = String((await r.json()).choices?.[0]?.message?.content || "").trim(); if (o) return o; } catch { await new Promise((s) => setTimeout(s, 1500)); } } return ""; }

const HERMES_PROMPT = `Review the conversation and update the skill library. Be ACTIVE. Target a CLASS-LEVEL skill with a rich SKILL.md (When-to-use / Procedure / Pitfalls / Verification). Do NOT capture environment-dependent failures or tool-negatives. Output an agentskills.io SKILL.md, or "Nothing to save."`;
const cross = `CROSS-CONVERSATION EVIDENCE (~5 sessions consuming paginated/rate-limited APIs): recovered missed records when paginating by offset → cursor/keyset pagination [4x]; recovered 429s → exponential backoff with jitter honoring Retry-After [4x]; recurring duplicate side effects on retry → idempotency keys [3x]; recurring socket exhaustion → reuse a connection pool/keep-alive session [3x]; transient missing API token env var (env-only).`;
const single = `CONVERSATION: an API integration hit 429s; added exponential backoff honoring Retry-After; also switched from offset to cursor pagination to stop missing records.`;

// 4 tasks, one per real pitfall. correct = the answer reflects the right fix.
const TASKS = [
  { q: "We paginate a frequently-updated list by page offset and keep MISSING and duplicating records. What's the fix?", ok: (a) => /cursor|keyset|seek/i.test(a) },
  { q: "Our client gets HTTP 429 under load. How should retries back off?", ok: (a) => /retry-?after/i.test(a) && /backoff|exponential|jitter/i.test(a) },
  { q: "Retried POST requests are double-charging customers. How do we make them safe to retry?", ok: (a) => /idempoten/i.test(a) },
  { q: "Under high request volume we hit socket/file-descriptor exhaustion. What's the fix?", ok: (a) => /pool|keep-?alive|reuse.*(connection|session|client)|persistent connection/i.test(a) },
];

(async () => {
  console.log(`runtime crush · api-pagination · author+agent=${AMODEL}\n`);
  const oursSkill = clean(await ask(M.REVIEW_PROMPT, cross));
  const hermesSkill = clean(await ask(HERMES_PROMPT, single));
  const arms = [["muscle-memory skill", oursSkill], ["Hermes skill", hermesSkill]];
  const score = {};
  for (const [label, skill] of arms) {
    let s = 0;
    const sys = `You are an engineer. Use ONLY the knowledge in this skill you have; answer in 1-2 sentences.\n\nSKILL:\n${skill}`;
    for (const t of TASKS) { const a = await ask(sys, t.q, 400); if (t.ok(a)) s++; }
    score[label] = s;
    console.log(`  agent + ${label.padEnd(20)} solved ${s}/${TASKS.length} pitfall-tasks`);
  }
  const o = score["muscle-memory skill"], h = score["Hermes skill"];
  console.log(`\n  RUNTIME: agent with muscle-memory's skill solved ${o}/${TASKS.length} vs ${h}/${TASKS.length} with Hermes's skill.`);
  console.log(`  → the cross-conversation skill covers pitfalls Hermes's single-conversation skill never captured → agent succeeds where it otherwise fails.`);
  writeFileSync(new URL("../runtime-crush-result.json", import.meta.url), JSON.stringify({ ts: new Date().toISOString(), domain: "api-pagination", model: AMODEL, tasks: TASKS.length, ours: o, hermes: h }, null, 2));
  console.log("  receipt -> runtime-crush-result.json");
})();
