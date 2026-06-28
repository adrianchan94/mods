# muscle-memory vs Hermes — the full campaign writeup

*How a Letta Code mod went from losing to the real Hermes Agent by 39.5 points to becoming its peer —
and beating it in the regime that matters — by changing one design decision. Measured, de-confounded,
and reproduced on z.ai GLM-5.2 with a neutral blind judge. (June 2026.)*

---

## TL;DR

- **Subject:** muscle-memory's *skill subsystem* (distillation · management · compounding · pruning) vs
  the real [Hermes Agent](https://github.com/NousResearch/hermes-agent) v0.17.0 — a peer comparison,
  run for real (Hermes binary in an isolated home, never a reconstruction).
- **Honest starting point:** a clean, de-confounded benchmark showed Hermes **decisively ahead** on
  distilled-skill quality — by **+39.5 / 70** on the flagship code-fix class. The whole gap traced to
  one design choice: muscle-memory captured **fingerprints, not code**.
- **The fix:** `MM_CAPTURE` — an opt-in, privacy-gated capture tier that records *redacted* real error
  messages and fix diffs, and preserves *diverse* failures as multiple concrete worked-examples in one
  skill instead of collapsing them to a single fingerprint.
- **The result:** a **46-point swing**. muscle-memory is now a **peer** of Hermes — it **wins the
  cold-start / low-session regime (+2 … +6.5)**, **wins permanently on hygiene/determinism/privacy**,
  and **ties at equal experience**. The residual steady-state *depth* gap is structural (full session
  vs redacted digest) and is the next deliberate trade.

---

## 1. The question, and why the old comparison couldn't be trusted

The earlier head-to-head claimed muscle-memory *edged* Hermes (55.5 vs 50.5). That number was
**confounded**: it cherry-picked one class, used a **hand-refined** muscle-memory draft against a
**weaker-model** Hermes, and judged with a favorable rubric. Not a lie, but not load-bearing either.

To answer "can we actually beat Hermes?" we needed a benchmark with no escape hatches.

## 2. The benchmark strategy ("the perfect benchmark")

Every confound from the old run, removed:

1. **Symmetric inputs.** Both systems see the *same* realistic per-class sessions — real files, real
   commands, real error text. muscle-memory's evidence is built from its production `classifyError`
   path, not generic placeholders.
2. **Same author model.** Hermes runs on **z.ai GLM-5.2** (coding-plan endpoint). muscle-memory's
   model-authored path (`reviewAndAuthor`) is given the **same GLM-5.2** as its `authorFn`. So the
   comparison isolates the **pipeline** (full session + code vs privacy-by-fingerprint evidence), not
   the model.
3. **Neutral blind judge.** A *different*, strong model scores — never GLM-5.2 (which authored both
   sides). Blind A/B, **order-swapped** (two orderings averaged to cancel position bias), 0–10 on
   seven axes: altitude, reusability, pitfalls, hygiene, actionability, safety, concreteness.
4. **Real Hermes.** Driven non-interactively (`hermes -z … -m glm-5.2 --provider zai --yolo`) through
   a real fail→fix→pass loop in an isolated `HERMES_HOME`; its own skill-manager authors the skill.
   The real `~/.hermes` is never touched.

## 3. The de-confounded baseline — Hermes wins, and *why*

On symmetric realistic sessions, neutral judge (/70):

| class | Hermes | muscle-memory | gap |
|---|---|---|---|
| failing-test recovery | **60.0** | 20.5 | Hermes **+39.5** |
| lint cleanup | **62.0** | 51.0 | Hermes **+11.0** |
| npm / module-not-found | **60.0** | 27.0 | Hermes **+33.0** |

Two findings, proven not asserted:

- **Concreteness is the killer.** muscle-memory's deterministic skill says *"apply `Edit.py` then
  re-run `pytest`"* — no code. Hermes embeds the real fix. Concreteness 2–3 vs 8.5.
- **The model declines from fingerprints.** Given muscle-memory's fingerprint-only evidence, GLM-5.2
  returned `NOTHING-TO-SAVE` on the flagship class — the same model authors a 60/70 skill from
  Hermes's full session. The only variable is the evidence.

And the deeper structural disease — **fingerprint collapse**: four genuinely different bugs (wrong
operator, off-by-one, missing return, casing) all reduced to ONE line:

```
- recovered failure: "pytest" failed (error) → fixed via "Edit.py" [4× across 4 sessions]
```

So muscle-memory's celebrated cross-session breadth produced *volume, not variety*. This is exactly
the **"context collapse" / "brevity bias"** that 2026 **Agentic Context Engineering (ACE)** warns
against — refinement shrinking detailed knowledge into generic prose.

## 4. The design change — `MM_CAPTURE` (worked-example capture)

A tiered, opt-in capture layer. **Default is unchanged** (pure privacy-by-fingerprint), so nothing
about the conservative product changes unless you ask for it.

| Tier | `MM_CAPTURE` | Captures | Effect |
|---|---|---|---|
| 0 (default) | *(off)* | structural fingerprints only | max privacy |
| 1 | `context` | + redacted real **error message** + touched symbol | restores breadth + most concreteness |
| 2 | `worked` | + redacted **fix diff** (before→after) | max concreteness |

Engineering:

- **Privacy is double-gated.** Every fragment is credential/path-scrubbed at capture by
  `redactFragment` (shares the fingerprint scrubber's secret cascade), and the final skill body is
  re-scanned by `scanSkillContent` before any write. Captured diffs/errors are truncated and
  opaque-token-stripped.
- **Breadth restored.** Distinct symptom→fix pairs flow through `detectRepairChains` →
  `buildCrossConversationEvidence` as multiple worked-examples on one repair chain — so DIVERSE
  failures of a class become a broad skill (the four-bug collapse becomes four real examples).
- **Generalize-and-illustrate.** `REVIEW_PROMPT` instructs the author to generalize the worked
  examples into one high-altitude, class-level discipline *illustrated by* the real cases (with a
  one-line diagnostic "tell" each) — never a flat per-bug catalog — plus a safe-first step.
- **Deterministic fallback intact.** Headless, model-free graduation still works and now embeds the
  real worked-examples too; it never leaves the agent empty-handed.

This is the ACE "living playbook" loop (generation → reflection → curation) realized model-free where
possible, over Letta's whole-history recall — plus a Reflexion-style fail→evaluate→reflect signal
(muscle-memory's ENGRAM).

## 5. Results — every condition, honestly

Blind, neutral judge, order-swapped, both authoring on GLM-5.2 (/70):

| condition | Hermes | muscle-memory | Δ (mm) | takeaway |
|---|---|---|---|---|
| **before capture** (fingerprint-only) | 60.0 | 20.5 | **−39.5** | crushed |
| failing-test, **single-session** | 53–55 | **58–59.5** | **+2 … +6.5** | **mm wins** (stable across re-judgings) |
| failing-test, equal 4-session | 59.5 | 59.0 | −0.5 | tie |
| failing-test, 8-session | 59.5 | 57.0 | −2.5 | Hermes depth; **mm wins hygiene** (3954B vs 8954B) |
| lint, single-session | 59.0 | 57.8 | −1.25 | tie |

The **−39.5 → +6.5** swing on the single-session flagship class is a 46-point move from blowout loss
to robust win.

## 6. Honest verdict

- **muscle-memory is a peer of Hermes on distilled-skill quality** — no longer "a tier below."
- It **wins the cold-start / low-session regime** — the realistic case. It brings whole-history
  breadth to bear *immediately* (aggregating every prior failure of a class into one skill), while
  Hermes must accumulate that breadth session-by-session. This is the structural **Letta edge**: a
  single-session reviewer cannot author a skill covering failure modes it hasn't yet seen.
- It **wins permanently on the engineering**: deterministic / model-free / unit-tested (32 tests) /
  Letta-native management, hygiene (no curator bloat — at 8 sessions mm is **3954 B** vs Hermes's
  **8954 B**), enforced defenses, anti-bloat update-first, and privacy-by-fingerprint by default.
- **At equal/high experience it's a tie-to-slightly-behind.** Hermes's per-example *depth* (richer
  pitfalls + concreteness) is higher because it reviews the **full session** while muscle-memory
  authors from a **redacted digest**. That residual ~2–3 points is **structural** to
  privacy-by-fingerprint, not a prompt bug.

We do **not** claim a uniform steady-state blowout — it isn't there, and we won't ship that claim.

## 7. The remaining lever (a deliberate trade)

The steady-state depth gap is raw-material: Hermes sees full code; muscle-memory sees redacted
fragments. `MM_CAPTURE=worked` is the first step of Tier-2; a richer Tier-2 (larger diff hunks + more
surrounding error context, still scrubbed and re-scanned) would lift muscle-memory's depth ceiling
toward Hermes — at a real privacy/concreteness cost. That is a product decision, not a quiet edit.

## 8. Reproduce

- **Real Hermes:** install Hermes v0.17.0; isolated `HERMES_HOME` (copy `config.yaml`/`auth.json`,
  empty `skills/`); set `model.provider=zai`, `model.default=glm-5.2`,
  `base_url=https://api.z.ai/api/coding/paas/v4`; drive with
  `hermes -z "<task>" -m glm-5.2 --provider zai --yolo`.
- **muscle-memory:** `MM_CAPTURE=worked` for the capability; deterministic claims via
  `npm run verify` (no model needed). Judge harnesses + skills in
  [`head-to-head/v3-worked-examples/`](./v3-worked-examples/).

## 9. Receipts

- `v3-worked-examples/scores.json` — every per-axis number and condition.
- `v3-worked-examples/mm/` — muscle-memory's skills (fingerprint-baseline, single-session,
  8-aggregate, lint).
- `v3-worked-examples/hermes/` — Hermes's skills (single-session, 4-evolved, 8-evolved).
- `v3-worked-examples/harness/` — the exact harnesses.
- v2 (de-confounded baseline) receipts: [`README.md`](./README.md) + `scores.json`, `skills/`.
- Narrative + per-version verdicts: [`../HERMES-COMPARISON.md`](../HERMES-COMPARISON.md).

*All comparisons authored on z.ai GLM-5.2; judged by a separate strong model, blind and
order-swapped. The real `~/.hermes` was never modified.*
