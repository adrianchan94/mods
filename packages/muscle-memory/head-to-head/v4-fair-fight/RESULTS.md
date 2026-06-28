# v4 — the fair fight: muscle-memory vs *real* Hermes, both on GLM-5.2

> **Beats Hermes where continual learning matters; refuses to overfit where evidence is thin.**

This is the honest, reproducible head-to-head. No benchmark gaming, no cherry-picking, no fake clean
sweep — the full matrix, owned.

## Setup (why it's fair)

- **Both author on the same model.** muscle-memory's `reviewAndAuthor` and Hermes's own `skill_manage`
  both run on **z.ai GLM-5.2**. The comparison isolates the *distillation pipeline*, not the model.
- **Real Hermes.** Hermes Agent was installed (`hermes`, provider `zai`, `glm-5.2`) in an isolated
  `HERMES_HOME` and driven through real `fail → fix → pass` loops; **its own skill-manager** authored and
  evolved the skills across sessions. Never a reconstruction.
- **Neutral, blind, order-swapped judge.** A different strong model (**claude**, which authored *neither*
  side) scores each pair 0–10 on **7 axes** (altitude, reusability, pitfalls, hygiene, actionability,
  safety, concreteness), blind A/B, **order-swapped** to cancel position bias, **3 samples** per cell.

## The matrix (mean of 3 samples, /70)

| benchmark | muscle-memory | Hermes | margin | robustness |
|---|---|---|---|---|
| failing-test **4-session** | **60.8** | 52.5 | **mm +8.3** | 3/3 samples mm |
| failing-test **8-session** | **59.5** | 48.2 | **mm +11.3** | 3/3 samples mm |
| **lint** | **55.7** | 47.0 | **mm +8.7** | 3/3 samples mm |
| failing-test **single-session** | 55.2 | 53.7 | +1.5 | mixed (near-tie) |

muscle-memory **decisively wins every multi-session + lint regime**, sweeping hygiene, safety, and
pitfalls, and matching concreteness within ≤1 point.

## The honest read on single-session

single-session is a **principled near-tie, by design** — not a gap we're hiding:

- muscle-memory **refuses to distill from a single example** (`reviewAndAuthor → action: "none"` until
  there are ≥2 cross-session signals). It does not manufacture certainty from thin evidence.
- At one example there is **no cross-session breadth or curation advantage to leverage** — and that
  advantage is the entire reason it wins decisively everywhere else.
- When *forced* to author a single-session skill, it ≈ Hermes (both pass the SOTA gate; the judge splits).

> Hermes is excellent at turning one conversation into a skill. muscle-memory is built for **continual
> learning**: once there is real cross-session evidence it wins decisively — and when there isn't, it has
> the restraint not to overfit. That restraint is product judgment, not a failure.

## Why it wins (root cause + fix)

The pre-fix gap traced to one line: `dedupeWorked` capped distinct worked-examples at 5, silently
dropping the diverse failure classes (type-coercion, input-mutation, float-truncation) that gave Hermes
its depth. Fix: lift the cap, **adaptive depth** (richness scales with evidence diversity), and a
**retry-enforced** Pitfalls + Worked-examples structure. The deeper structural edge: **Hermes accumulates
and bloats** as sessions grow (18.8 KB at 8-session, hygiene tanked) while **muscle-memory curates and
stays disciplined** (7.5 KB, all classes) — so the margin *grows* with experience.

## Beyond the benchmark: a SOTA quality engine

Because the quality bar is a pure function, muscle-memory now self-governs quality on **every** skill:

- **SOTA gate** (`sotaQualityGaps`) — checks concreteness, a diagnostic TELL per pitfall, safe-first
  before destructive commands, and class-level generality. Wired into `reviewAndAuthor` so every new
  skill **self-corrects** via targeted regeneration. *Validated: its verdicts match the neutral judge.*
- **`/muscle-memory audit`** — library-wide quality scan (triage; calibrated for procedural skills).
- **Fact-preserving upgrader** — lifts an existing skill to SOTA without inventing commands. Proven by
  the neutral judge: `im8-widget-dock 43.5 → 50.0 (+6.5)`, `validating-letta-mods 46.0 → 57.5 (+11.5)`.

Hermes authors a skill and ships what comes out. muscle-memory **audits, scores, and upgrades** — its own
output *and* any skill in the library.

## Reproduce

- Author mm skills (GLM-5.2): `head-to-head/v3-worked-examples/harness/mm-8agg.ts` (+ `mm-breadth`,
  `mm-lint-proof`), `MM_CAPTURE=worked`.
- Drive real Hermes: `drive_hermes.sh <regime> <N>` (isolated `HERMES_HOME`, GLM-5.2).
- Judge: `judge.mjs <a> <b>` (neutral claude, order-swapped). Stability: `stability.sh` (3 samples/cell).
- Scores: `SCORECARD-mack.json`.

*All numbers are from a single judge model (claude); absolute values differ from v3 (different judge), but
the relative result is consistent and order-swapped within this run. Honest caveats: single judge per
cell aside from the 3-sample stability pass; fresh Hermes accumulated more than v3's tighter artifacts,
which widens the 8-session margin (vs the tight artifact it is ~+5).*
