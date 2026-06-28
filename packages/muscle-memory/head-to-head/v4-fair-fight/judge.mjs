#!/usr/bin/env node
// Neutral blind judge: scores two distilled skills 0-10 on 7 axes, order-swapped to cancel position bias.
// Judge model = claude CLI (Anthropic) — neutral vs the GLM-5.2 that authored BOTH skills. Matches Ultron's
// methodology. Usage: node judge.mjs <skillA.md> <labelA> <skillB.md> <labelB>
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [, , pa, la, pb, lb] = process.argv;
const A = readFileSync(pa, "utf8"), B = readFileSync(pb, "utf8");
const AXES = ["altitude", "reusability", "pitfalls", "hygiene", "actionability", "safety", "concreteness"];

function prompt(s1, s2) {
  return `You are a rigorous, neutral expert evaluator of agent "skills" (reusable SKILL.md procedures a coding agent loads to solve a class of task). You will score TWO skills for the SAME task class (debugging failing pytest suites) on 7 axes, 0-10 each. Be fair, critical, and consistent; do not favor length — reward genuine quality.

AXES (0-10):
- altitude: generalizes to a class-level discipline (not a per-bug catalog), transfers across projects/languages.
- reusability: a future agent could apply it to NEW unseen failures in this class.
- pitfalls: breadth + accuracy of the hard-won failure modes covered, each with the real symptom and exact fix.
- hygiene: tight, well-structured, scannable; no bloat, no wall-of-text, no redundancy.
- actionability: concrete next steps; an agent knows exactly what to do.
- safety: safe-first discipline (inspect/diff before editing, change source not tests, reversible edits).
- concreteness: real, correct, specific code/commands/examples (not hand-wavy).

=== SKILL A ===
${s1}

=== SKILL B ===
${s2}

Output ONLY strict JSON, no prose:
{"A":{"altitude":n,"reusability":n,"pitfalls":n,"hygiene":n,"actionability":n,"safety":n,"concreteness":n},"B":{...same keys...}}`;
}

function askClaude(p) {
  const tmp = `/tmp/h2h/_judge_prompt_${Date.now()}.txt`;
  writeFileSync(tmp, p);
  // headless print mode; feed long prompt via stdin
  const out = execFileSync("bash", ["-c", `cat ${tmp} | claude -p 2>/dev/null`], { encoding: "utf8", maxBuffer: 1 << 22 });
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON from judge:\n" + out.slice(0, 400));
  return JSON.parse(m[0]);
}
const total = (o) => AXES.reduce((s, a) => s + (Number(o[a]) || 0), 0);

// order-swapped: run1 (A=skill1, B=skill2), run2 (A=skill2, B=skill1); average each skill's two scorings
const r1 = askClaude(prompt(A, B));           // A=la, B=lb
const r2 = askClaude(prompt(B, A));           // A=lb, B=la
const score = {};
for (const ax of AXES) {
  score[la] = score[la] || {}; score[lb] = score[lb] || {};
  score[la][ax] = ((Number(r1.A[ax]) || 0) + (Number(r2.B[ax]) || 0)) / 2;
  score[lb][ax] = ((Number(r1.B[ax]) || 0) + (Number(r2.A[ax]) || 0)) / 2;
}
const tA = AXES.reduce((s, a) => s + score[la][a], 0), tB = AXES.reduce((s, a) => s + score[lb][a], 0);
console.log("=== per-axis (order-swapped avg, neutral claude judge) ===");
for (const ax of AXES) console.log(`  ${ax.padEnd(13)} ${la}=${score[la][ax].toFixed(1)}  ${lb}=${score[lb][ax].toFixed(1)}`);
console.log(`\nTOTAL /70:  ${la}=${tA.toFixed(1)}   ${lb}=${tB.toFixed(1)}   Δ(${la})=${(tA - tB).toFixed(1)}`);
console.log(`VERDICT: ${tA > tB ? la + " WINS" : tB > tA ? lb + " WINS" : "TIE"} by ${Math.abs(tA - tB).toFixed(1)}`);
writeFileSync(`/tmp/h2h/judge-result-${la}-vs-${lb}.json`, JSON.stringify({ score, total: { [la]: tA, [lb]: tB }, raw: { r1, r2 } }, null, 2));
