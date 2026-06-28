# muscle-memory vs the real Hermes Agent — skill distillation, measured

> **🏆 v4 — the fair fight (latest, supersedes v3).** With *real* Hermes installed and driven through its
> own skill-manager on **GLM-5.2**, a neutral order-swapped judge, **3 samples per cell**: muscle-memory
> **decisively wins** every regime where continual learning applies — failing-test **4-session +8.3**,
> **8-session +11.3**, **lint +8.7** (all 3/3 robust) — and single-session is a **principled near-tie/
> abstention** (mm refuses to distill from one example by design). **Beats Hermes where continual learning
> matters; refuses to overfit where evidence is thin.** Full matrix + reproduction:
> [`head-to-head/v4-fair-fight/RESULTS.md`](./head-to-head/v4-fair-fight/RESULTS.md). v4 also adds a
> **SOTA quality gate** (self-corrects every distilled skill; verdicts validated against the neutral
> judge), a `/muscle-memory audit` command, and a proven fact-preserving skill **upgrader**.

> **⚠️ Update (de-confounded v2 below).** The single-class "55.5 vs 50.5 muscle-memory edge" in this section is **superseded** — it used a hand-refined mm draft vs a weaker-model Hermes on one cherry-picked class. A symmetric, same-model (GLM-5.2), neutral-blind-judge run across 5 classes ([`head-to-head/`](./head-to-head/)) shows **Hermes decisively ahead on distilled-skill quality**. Then **v3** (worked-example capture, `MM_CAPTURE`) closes the gap: muscle-memory goes from −39.5 to a **peer** of Hermes — winning the cold-start regime (+2 to +6.5 single-session) and hygiene, tying at equal experience. See *v3* below + [`head-to-head/v3-worked-examples/`](./head-to-head/v3-worked-examples/).

> **Full campaign writeup:** [`head-to-head/CAMPAIGN.md`](./head-to-head/CAMPAIGN.md) — the whole story end-to-end (benchmark strategy, de-confounding, the design change, every result, honest verdict).

**Scope:** the *skill subsystem* (distillation · management · compounding · quality · pruning), not the whole agent. Hermes Agent ([NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent), v0.17.0) is a mature standalone agent; muscle-memory is a Letta Code **mod** that was explicitly *modeled on* Hermes's pattern. So this is a peer comparison, run for real.

## Method (real Hermes, not a reconstruction)
- Ran **real Hermes v0.17.0** in an isolated `HERMES_HOME` (real provider via OpenRouter; the real `~/.hermes` was never touched).
- Drove it through a fail→fix→pass coding task → captured its **actual distilled skill** (`test-driven-debugging`).
- Compared against muscle-memory's **actual distilled skill** for the same class (`recovering-from-failing-script-runs`).
- Blind judge (Skill A/B), **order-swapped**, strongest available judge model, 0–10 per axis.

## Result — and the refinement it forced
**Baseline (before refinement):** Hermes **60** vs muscle-memory **40.5**. muscle-memory *lost decisively* — its deterministic skill was abstract (concreteness 2.5 vs 9), duplicated its description verbatim in the body, and carried double provenance comments (hygiene 3.5 vs 9). Honest, and it drove real fixes.

**Refinement** (commit `6fd6c96`): deduped description↔body, added a `Worked examples` block citing the real captured commands, sharpened pitfalls (incl. the real `go`/exit-0-but-wrong-output insight Hermes's skill lacked), fixed a publish double-provenance bug.

**After refinement:** muscle-memory **55.5** vs Hermes **50.5** — muscle-memory's **model-free, deterministic** skill now *edges* Hermes's **model-authored** one (blind, order-swapped):

| axis | Hermes | muscle-memory | note |
|---|---|---|---|
| altitude | 6.0 | **8.0** | language-agnostic discipline vs a python-specific recipe |
| reusability | 6.0 | **9.0** | applies across languages |
| pitfalls | 7.0 | **8.5** | the exit-0/wrong-output insight Hermes lacked |
| hygiene | 8.0 | **8.5** | dedup + single provenance |
| actionability | 8.0 | 8.0 | tie |
| safety | 7.0 | 7.5 | ~tie |
| **concreteness** | **8.5** | 6.0 | **Hermes still leads** — it has real `calc.py` code; muscle-memory captures fingerprints, not code |

A second, independent check (Hermes's *real review doctrine* vs muscle-memory's `REVIEW_PROMPT`, same cross-session evidence, 5 domains, blind): muscle-memory **58.8 vs 50.6, 10–0** — consistent, modest quality edge (safety-first + actionability).

## Management (compounding / anti-bloat / pruning)
Tested directly: gave real Hermes a *second*-language (node) recovery after the python one. **Hermes did NOT fragment** — its model-driven update-first patched the existing skill (added a CommonJS/ESM pitfall). So both systems consolidate; they are **management peers** (muscle-memory ported this from Hermes). Differences that remain real:
- muscle-memory generalizes **deterministically** (class-merge) and names language-agnostically from inception; Hermes generalizes by **model judgment** and kept the python-anchored name.
- muscle-memory's distill + generalize + gate + prune run **model-free and unit-tested (28 tests)**; Hermes's skill review is a **model fork per turn** (non-deterministic, not reproducible).

## Honest verdict
After real refinement, muscle-memory is **measurably ahead of Hermes on distilled-skill quality for this class (55.5 vs 50.5, and 58.8 vs 50.6 at prompt level), and categorically ahead on the engineering of skill management** — deterministic, unit-tested, model-free, Letta-native. It is **not a blowout "tier above" on raw prose quality**: Hermes is genuinely strong, the margin is modest, and Hermes still **leads on concreteness** (it embeds real code; muscle-memory's privacy-by-fingerprint design captures commands + error classes, not code).

**The one real lever to a decisive quality lead:** allow-listed capture of the *concrete fix* (a redacted diff hunk / before→after line) so distilled skills carry Hermes-level code examples *and* keep muscle-memory's cross-session breadth + determinism. That is a deliberate change to the privacy-by-fingerprint contract — a design decision, not a quiet edit.

*Reproduce:* real Hermes via its installer + `HERMES_HOME` isolation; muscle-memory's deterministic claims via `npm run test`/`bench`/`eval`/`demo` (no model needed).

## Broadened head-to-head v2 — DE-CONFOUNDED, 5 classes, same model (z.ai GLM-5.2), neutral blind judge
The earlier broadened run was **confounded**: muscle-memory got thin *synthetic* logs while Hermes ran *real* sessions, and mm's deterministic draft was compared against Hermes's full model-authored skill. This run fixes all three: **symmetric realistic sessions**, the **same author model** for both (GLM-5.2 — mm's `reviewAndAuthor` `authorFn` is GLM-5.2, Hermes runs on GLM-5.2), and a **neutral** strong judge (not GLM-5.2), blind A/B, order-swapped. Full receipts in [`head-to-head/`](./head-to-head/) (skills, `scores.json`, harnesses).

**Blind judge (order-swapped, 7 axes, /70) — the 3 classes where both ship a skill:**

| class | Hermes | muscle-memory | gap | mm artifact |
|---|---|---|---|---|
| failing-test recovery | **60.0** | 20.5 | Hermes **+39.5** | deterministic draft (model path → `NOTHING-TO-SAVE`) |
| lint cleanup | **62.0** | 51.0 | Hermes **+11.0** | model-authored (mm's best path) |
| npm / module-not-found | **60.0** | 27.0 | Hermes **+33.0** | deterministic draft (model path declined) |

Per-axis, **concreteness** is the killer: mm 2.0–3.0 (deterministic) / 7.0 (model) vs Hermes 7.5–8.5.

**Authoring behavior (5/5):**
- **Hermes:** authored a rich, concrete skill for **all 5** classes (incl. env `debug-by-env-not-by-edit`, git `git-clean-commit`).
- **muscle-memory, model-authored (GLM-5.2):** authored only **lint**; returned `NOTHING-TO-SAVE` for failing-test, npm, git — its fingerprint evidence is too abstract for a strong model to author from. (Reproducible at temperature 0.)
- **muscle-memory, deterministic:** always emits a thin recovery-fingerprint skill for a durable repair (never leaves the agent empty-handed), but it is abstract (no code) and scores far below a model-authored skill.
- **env:** mm routes the invocation gotcha to an **enforced defense** (`python3 ⇒ invoke with APP_MODE=prod`), not an advisory skill — different surface, arguably stronger, but not a "skill" here.

**The correction this forced:** the earlier "55.5 vs 50.5 muscle-memory edge" is **refuted**. It came from one cherry-picked class, a *hand-refined* mm draft, and a weaker Hermes model. On a strong model with symmetric sessions and a neutral judge, **Hermes decisively leads on distilled-skill quality** across every head-to-head class. The whole gap traces to one variable — muscle-memory captures **fingerprints, not code** (privacy by design) — so the same author model cannot reach Hermes-level concreteness from mm's evidence, and on thin cases declines to author at all.

**Net (honest):** muscle-memory is **not "a tier above on skill quality" — it is behind Hermes on quality, clearly.** Its real, unchanged edges are **orthogonal to prose quality**: deterministic / model-free / 28-unit-tested / Letta-native skill *management*, privacy-by-fingerprint (no code/secrets captured), enforced defenses, anti-bloat update-first, and graceful deterministic fallback with no model. The one evidence-backed lever to a quality lead is **allow-listed capture of the concrete fix** (a redacted diff hunk / before→after line) — a deliberate change to the privacy-by-fingerprint contract, not a quiet edit.


## v3 — closing the gap with worked-example capture (MM_CAPTURE)
v2 traced the entire quality gap to one design choice: muscle-memory captured **fingerprints, not code**, which made skills abstract AND collapsed diverse failures of a class into one fingerprint line. v3 adds an **opt-in, privacy-gated capture tier** (`MM_CAPTURE=context|worked`, default off) that records the **redacted** real error message (`context`) and fix diff (`worked`) — scrubbed at capture and re-scanned before any write — and preserves DIVERSE symptom→fix pairs as multiple concrete worked-examples in ONE skill (the cross-session breadth a single-session reviewer can't produce).

Blind, neutral-judge, order-swapped, both authoring on GLM-5.2 (full receipts: [`head-to-head/v3-worked-examples/`](./head-to-head/v3-worked-examples/)):

| condition | Hermes | muscle-memory | Δ (mm) |
|---|---|---|---|
| before capture (fingerprint-only) | 60.0 | 20.5 | **−39.5** |
| failing-test, **single-session** | 53–55 | **58–59.5** | **+2 … +6.5** ✅ |
| failing-test, equal 4-session | 59.5 | 59.0 | −0.5 (tie) |
| failing-test, 8-session | 59.5 | 57.0 | −2.5 |
| lint, single-session | 59.0 | 57.8 | −1.25 (tie) |

**Verdict (honest):** the design change turns the blowout loss into a **peer** result. muscle-memory now **beats Hermes in the cold-start / low-session regime** — it aggregates the whole history into a broad skill immediately, while Hermes accumulates breadth session-by-session — and **wins permanently on hygiene** (3954B vs Hermes's 8954B at 8 sessions; no curator drift), determinism, model-free fallback, and privacy. At equal/high experience it's a tie-to-slightly-behind: Hermes's per-example **depth** is higher because it reviews the **full session** while muscle-memory authors from a **redacted digest**. That residual gap is structural to privacy-by-fingerprint; closing it fully is a deliberate capture-richness trade (`MM_CAPTURE=worked` is the first step), not a prompt tweak. 28→32 tests; `npm run verify` green.
