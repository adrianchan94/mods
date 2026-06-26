#!/usr/bin/env node
// Runtime performance improvement A/B: does a muscle-memory-distilled skill actually make the
// agent BETTER at a task? Each pitfall task is run WITHOUT the skill (baseline) vs WITH the skill
// in context, on a real model. We measure first-try correctness. Needs NOUS_API_KEY.
const NOUS = "https://inference-api.nousresearch.com/v1/chat/completions";
const KEY = process.env.NOUS_API_KEY;
const MODEL = process.env.MM_PERF_MODEL || "stepfun/step-3.7-flash:free";
const N = Number(process.env.MM_PERF_N || 4);

// stepfun is a REASONING model — give it room so it emits `content` after `reasoning` (else finish_reason=length).
async function ask(system, user) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(NOUS, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODEL, max_tokens: 2200, temperature: 0.4, messages: [system ? { role: "system", content: system } : null, { role: "user", content: user }].filter(Boolean) }) });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 3000)); continue; }
      if (!r.ok) throw new Error(`${r.status}`);
      const m = (await r.json()).choices?.[0]?.message || {};
      return String(m.content || m.reasoning || "").trim(); // reasoning fallback if content empty
    } catch (e) { if (attempt === 2) throw e; await new Promise((s) => setTimeout(s, 1500)); }
  }
  return "";
}

// The muscle-memory-distilled skill (the real class-level "editing letta mods" knowledge).
const SKILL = `SKILL: editing-letta-code-mods
## Pitfalls (hard-won)
- Tool arguments arrive via \`ctx.args\`, NOT as positional parameters of run(). Use: run(ctx){ const args = ctx.args }.
- Backup files must NOT end in .ts/.tsx — the loader scans ~/.letta/mods for any .ts file and would DOUBLE-REGISTER the backup as a live mod. Suffix backups (e.g. foo.ts.bak-<reason>).
- A newly added tool/command is NOT callable in the same session — you must /reload first.
- Validate a change with: npx esbuild <mod>.ts --bundle --platform=node --format=esm`;

const lastLine = (s) => s.trim().split("\n").filter(Boolean).pop()?.trim() || "";
const TASKS = [
  { name: "ctx.args", user: "In a Letta Code mod, write the tool's `run` handler so it reads a `path` argument and returns it. Output ONLY the TypeScript code.", correct: (o) => /ctx\.args/i.test(o) || (/run\s*\(\s*ctx/.test(o) && /\bargs\b/.test(o)) },
  { name: "backup-naming", user: "You're about to edit a Letta mod at ~/.letta/mods/foo.ts and want to back it up first. Give ONLY the backup filename you'd use (one line, nothing else).", correct: (o) => !/\.tsx?$/.test(lastLine(o).replace(/[`'\"]/g, "")) },
  { name: "reload", user: "You just added a brand-new tool to a Letta mod during this session. Can you call that new tool right now with no other step? Answer YES or NO and a one-line reason.", correct: (o) => /\bno\b/i.test(o) && /reload/i.test(o) },
];

(async () => {
  if (!KEY) { console.error("NOUS_API_KEY not set"); process.exit(1); }
  console.log(`model=${MODEL}  trials/condition=${N}\n`);
  const rows = [];
  for (const t of TASKS) {
    let base = 0, withS = 0;
    for (let i = 0; i < N; i++) { if (t.correct(await ask("", t.user))) base++; }
    for (let i = 0; i < N; i++) { if (t.correct(await ask(`Relevant skill from your memory:\n${SKILL}`, t.user))) withS++; }
    const bp = Math.round((base / N) * 100), wp = Math.round((withS / N) * 100);
    rows.push({ task: t.name, baseline: bp, withSkill: wp, lift: wp - bp });
    console.log(`  ${t.name.padEnd(14)} baseline ${String(bp).padStart(3)}%  →  with-skill ${String(wp).padStart(3)}%   (${wp - bp >= 0 ? "+" : ""}${wp - bp} pts)`);
  }
  const avgB = Math.round(rows.reduce((a, r) => a + r.baseline, 0) / rows.length);
  const avgW = Math.round(rows.reduce((a, r) => a + r.withSkill, 0) / rows.length);
  console.log(`\n  AGGREGATE first-try correctness:  baseline ${avgB}%  →  with-skill ${avgW}%   (+${avgW - avgB} pts)`);
  console.log(avgW > avgB ? `\n  ✓ The distilled skill MEASURABLY improved agent performance at runtime.` : `\n  ✗ no improvement measured`);
  const fs = await import("node:fs");
  fs.writeFileSync(new URL("../perf-improvement-result.json", import.meta.url), JSON.stringify({ ts: new Date().toISOString(), model: MODEL, trials: N, rows, aggregate: { baseline: avgB, withSkill: avgW, lift: avgW - avgB } }, null, 2));
  console.log("  receipt -> perf-improvement-result.json");
  process.exit(avgW > avgB ? 0 : 1);
})();
