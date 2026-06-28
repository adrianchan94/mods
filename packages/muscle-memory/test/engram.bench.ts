// ENGRAM ablation benchmark — does each brain mechanism beat the v4 baseline?
// Deterministic, labeled synthetic corpus; no live model. Measures, per axis, ENGRAM vs baseline:
//   1. Synaptic tagging   — rescue of valuable one-shots   vs v4 frequency-threshold (detect)
//   2. Reconsolidation    — labile detection prec/recall    vs v4 (no mechanism → 0 recall)
//   3. Prioritized replay — durable precision@K, salience   vs uniform-recency ordering
//   4. Salience separation— mean salience of wins vs trivia (the neuromodulatory gate works)
import { __mm } from "../mods/index";
import type { Row } from "../mods/index";

const { tagExperience, captureTagged, labileSkills, replayQueue, buildDefenses, detect, detectRepairChains, detectInvocationGotchas, inferOutcomes } = __mm;

const T = 1_700_000_000_000, MIN = 60_000;
let s = 0;
const R = (tool: string, tmpl: string, ok: boolean | undefined, conv: string, h?: string, dt = 1000): Row =>
  ({ tool, tmpl, fp: `${tool}::${tmpl}`, h: h ?? `${tool}::${tmpl}`, ok, ts: T + (s += dt), conv });

// ── Labeled corpus ───────────────────────────────────────────────────────────
const rows: Row[] = [];
const durableRecoveryH = new Set<string>();   // ground-truth salient "wins"
const trivialH = new Set<string>();           // ground-truth low-salience
const valuableOneShotH = new Set<string>();   // should be RESCUED by tagging
const distractorOneShotH = new Set<string>(); // one-shot far from any win → should NOT be rescued

// 3 sessions of a recurring fix→recover workflow (durable across conversations).
for (const conv of ["s1", "s2", "s3"]) {
  rows.push(R("Bash", "alpha-build", false, conv));                       // failure
  rows.push(R("Edit", "fix-alpha.ts", true, conv, `edit-${conv}`));       // the fix
  const win = R("Bash", "alpha-build", true, conv, `win-${conv}`);        // RECOVERY = durable win
  durableRecoveryH.add(String(win.h)); rows.push(win);
  rows.push(R("Bash", "lint-check", true, conv));                          // a step that only ever succeeds
}
// Trivial successes (low salience ground truth).
for (let i = 0; i < 5; i++) { const r = R("Read", `trivial-${i}.txt`, true, "s1", `triv-${i}`); trivialH.add(String(r.h)); rows.push(r); }
// A valuable one-shot placed INSIDE the capture window of the s2 recovery.
{ const r = R("Read", "KEY-INSIGHT.md", true, "s2", "v_insight", 5 * MIN); valuableOneShotH.add(String(r.h)); rows.push(r); }
// A distractor one-shot far from any win (different conv, isolated).
{ const r = R("Read", "DISTRACTOR.md", true, "s9", "v_distract", 999 * MIN); distractorOneShotH.add(String(r.h)); rows.push(r); }

const defenses = buildDefenses(rows); // fix-defense for "alpha-build" (recovered) ⇒ expects success
const tagged = tagExperience(rows, { defenses });

// Skills: one whose prediction is CONTRADICTED (alpha-build keeps failing), one CONFIRMED (lint-check only succeeds).
const skills = [
  { name: "building-alpha", body: "## Observed pattern\n```text\nalpha-build\n```\n" }, // GT: labile
  { name: "running-lint", body: "## Observed pattern\n```text\nlint-check\n```\n" },     // GT: stable
];
const GT_LABILE = ["building-alpha"];

// ── Metric 1: synaptic tagging — one-shot rescue vs v4 frequency threshold ───
const rescued = new Set(captureTagged(tagged).map((r) => String(r.h)));
const tagRecall = [...valuableOneShotH].filter((h) => rescued.has(h)).length / valuableOneShotH.size;
const distractorRescued = [...distractorOneShotH].some((h) => rescued.has(h));
// v4 baseline: a candidate must clear MIN_COUNT(3)×MIN_CONVS(2); a one-shot can never qualify.
const v4Candidates = new Set(detect(rows).candidates.map((c) => c.key));
const v4RescuesValuable = [...valuableOneShotH].some((h) => v4Candidates.has(h)); // structurally impossible → false

// ── Metric 2: reconsolidation — labile detection vs v4 (no mechanism) ────────
const flagged = new Set(labileSkills(skills, rows, defenses).map((l) => l.name));
const tp = [...flagged].filter((n) => GT_LABILE.includes(n)).length;
const fp = [...flagged].filter((n) => !GT_LABILE.includes(n)).length;
const recoPrecision = flagged.size ? tp / flagged.size : 1;
const recoRecall = GT_LABILE.length ? tp / GT_LABILE.length : 1;
// v4 has no reconsolidation: a retrieved skill is never reopened on prediction error → recall 0.
const v4RecoRecall = 0;

// ── Metric 3: prioritized replay ranking — salience vs uniform recency ───────
const K = 6;
const salienceTopK = replayQueue(tagged, K);
const recencyTopK = [...rows].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, K);
const salienceP = salienceTopK.filter((r) => durableRecoveryH.has(String(r.h))).length / K;
const recencyP = recencyTopK.filter((r) => durableRecoveryH.has(String(r.h))).length / K;

// ── Metric 4: salience separation — wins vs trivia ───────────────────────────
const winScores = tagged.filter((t) => durableRecoveryH.has(String(t.h))).map((t) => t.sal.score);
const trivScores = tagged.filter((t) => trivialH.has(String(t.h))).map((t) => t.sal.score);
const winSal = winScores.length ? +(winScores.reduce((a, b) => a + b, 0) / winScores.length).toFixed(2) : 0;
const trivSal = trivScores.length ? +(trivScores.reduce((a, b) => a + b, 0) / trivScores.length).toFixed(2) : 0;

// Axis 5: invocation/env gotcha — SAME base command fails, then succeeds re-run with a flag/env
// (no code edit). v4 repair-chains need an intervening FIX-edit, so they miss it entirely.
const gotchaRows = inferOutcomes([
  R("Bash", "cd <str> && pytest", undefined, "g", "gv1"),
  R("Read", "conftest.py", true, "g", "gr"),
  R("Bash", "cd <str> && pytest -x", undefined, "g", "gv2"),   // flag gotcha
  R("Bash", "make deploy", undefined, "g", "gm1"),
  R("Bash", "REGION=us make deploy", undefined, "g", "gm2"),   // env gotcha
]);
const gotchas = detectInvocationGotchas(gotchaRows);
const v4RepairOnGotcha = detectRepairChains(gotchaRows).length; // 0 — no fix-edit between
const engramGotcha = gotchas.length;

// ── Report ───────────────────────────────────────────────────────────────────
const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log("ENGRAM ablation benchmark — ENGRAM vs v4 baseline\n");
console.log(`1. Synaptic tagging (one-shot rescue)`);
console.log(`   ENGRAM rescue-recall=${pct(tagRecall)}  distractor-rescued=${distractorRescued}   |  v4 rescues one-shots=${v4RescuesValuable}`);
console.log(`2. Reconsolidation (labile detection)`);
console.log(`   ENGRAM precision=${pct(recoPrecision)} recall=${pct(recoRecall)} (fp=${fp})   |  v4 recall=${pct(v4RecoRecall)} (no mechanism)`);
console.log(`3. Prioritized replay (durable precision@${K})`);
console.log(`   ENGRAM salience=${pct(salienceP)}   |  uniform-recency=${pct(recencyP)}`);
console.log(`4. Salience separation (mean score)`);
console.log(`   win=${winSal}   trivia=${trivSal}   ratio=${trivSal ? (winSal / trivSal).toFixed(2) : "∞"}×`);
console.log(`5. Invocation/env gotcha (flag/env fix, no code edit)`);
console.log(`   ENGRAM learned=${engramGotcha} (${gotchas.map((g) => `${g.trigger} +${g.delta}`).join(", ")})   |  v4 repair-chains=${v4RepairOnGotcha}`);

const pass =
  tagRecall === 1 && !distractorRescued && !v4RescuesValuable &&        // 1: rescues the valuable, not the distractor; v4 can't
  recoPrecision === 1 && recoRecall === 1 && v4RecoRecall === 0 &&      // 2: perfect on this corpus; v4 0
  salienceP > recencyP &&                                               // 3: salience ranks durable higher than recency
  winSal > trivSal * 1.5 &&                                              // 4: wins clearly out-salient trivia
  engramGotcha >= 2 && v4RepairOnGotcha === 0;                          // 5: learns flag+env gotchas v4 repair-chains miss
console.log(`\n${pass ? "✅ ENGRAM beats v4 baseline on every axis" : "❌ benchmark assertion FAILED"}`);
process.exit(pass ? 0 : 1);
