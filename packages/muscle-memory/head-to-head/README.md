# De-confounded head-to-head — real Hermes vs muscle-memory, same model, same sessions

This directory is the receipt for the de-confounding run that corrects the earlier broadened
comparison (which fed muscle-memory thin *synthetic* logs while Hermes ran *real* sessions).

## What was fixed vs the earlier run
1. **Symmetric inputs.** Both systems saw the SAME realistic per-class sessions (real files,
   real commands, real error text). muscle-memory's evidence is built from the production
   `classifyError` path, not generic placeholders.
2. **Same author model.** Hermes ran on **z.ai GLM-5.2** (coding-plan endpoint). muscle-memory's
   model-authored path (`reviewAndAuthor`) was given the **same** GLM-5.2 as its `authorFn`. So the
   comparison isolates the *pipeline* (full session + code vs privacy-by-fingerprint evidence),
   not the model.
3. **Neutral blind judge.** Scoring used a different, strong model (not GLM-5.2, which authored both
   sides), blind A/B, **order-swapped** (two orderings averaged) to cancel position bias, 0–10 on 7
   axes.

## Method
- Real Hermes v0.17.0, isolated `HERMES_HOME` per class, GLM-5.2, driven non-interactively
  (`hermes -z "<task>" -m glm-5.2 --provider zai --yolo`) through a real fail→fix→pass loop, then
  asked to author a skill via its own skill-manager. Real `~/.hermes` never touched.
- muscle-memory: realistic Letta-shaped rows → `buildCrossConversationEvidence` →
  (a) `reviewAndAuthor` model-authored path on GLM-5.2, and (b) the deterministic shipped draft
  (`draftWithRepair`). Harnesses in `harness/`.
- 5 classes: failing-test recovery, lint cleanup, npm/module-not-found, env/flag gotcha, git commit.

## Results (blind, order-swapped, 7 axes, /70)
| class | Hermes | muscle-memory | gap | mm artifact judged |
|---|---|---|---|---|
| failing-test | **60.0** | 20.5 | Hermes **+39.5** | deterministic draft (model path returned NOTHING-TO-SAVE) |
| lint | **62.0** | 51.0 | Hermes **+11.0** | model-authored (mm's best path) |
| npm / module-not-found | **60.0** | 27.0 | Hermes **+33.0** | deterministic draft (model path declined) |

Per-axis killer: **concreteness** — mm 2.0–3.0 (deterministic) / 7.0 (model) vs Hermes 7.5–8.5.
Full per-axis numbers + both orderings in `scores.json`.

## Authoring behavior (5/5)
- **Hermes:** authored a rich, concrete skill for ALL 5 classes (env: `debug-by-env-not-by-edit`;
  git: `git-clean-commit`).
- **muscle-memory model-authored (GLM-5.2):** authored only **lint** (`pyflakes-fix-and-verify`).
  Returned `NOTHING-TO-SAVE` for failing-test, npm, and git — the fingerprint evidence is too
  abstract for a strong model to author a durable skill from.
- **muscle-memory deterministic:** always emits a thin "recovery-fingerprint" skill for a durable
  repair (failing-test, lint, npm) — never leaves the agent empty-handed, but the artifact is
  abstract (no code) and scores far below a model-authored skill.
- **env:** muscle-memory routes the invocation gotcha to an **enforced defense**
  (`python3 ⇒ invoke with APP_MODE=prod`), not an advisory skill — a different (arguably stronger)
  surface, but not a "skill" in this comparison.

## Honest verdict
On a strong model, with symmetric realistic sessions and a neutral blind judge, **Hermes decisively
leads on distilled-skill quality** across every head-to-head class. This **refutes** the earlier
"55.5 vs 50.5 muscle-memory edge," which was confounded (one cherry-picked class, a hand-refined mm
draft, and a weaker Hermes model). The entire gap traces to one variable: muscle-memory captures
**fingerprints, not code**, by privacy design — so the same author model cannot reach Hermes-level
concreteness from mm's evidence, and on thin cases declines to author at all.

muscle-memory's real, unchanged edges are **orthogonal to prose quality**: deterministic /
model-free / unit-tested / Letta-native skill *management*, privacy-by-fingerprint (no code/secrets
captured), enforced defenses for invocation gotchas, anti-bloat update-first, and graceful
deterministic fallback when no model is available. It is **not** "a tier above on skill quality."

The one evidence-backed lever to close the quality gap is **allow-listed capture of the concrete
fix** (a redacted diff hunk / before→after line) so distilled skills carry Hermes-level code — a
deliberate change to the privacy-by-fingerprint contract, not a quiet edit.
