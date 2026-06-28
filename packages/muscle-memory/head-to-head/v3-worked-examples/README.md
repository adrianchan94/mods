# v3 — closing the gap: worked-example capture (MM_CAPTURE)

The de-confounded v2 run showed Hermes decisively ahead on distilled-skill quality, and traced the
*entire* gap to one design choice: muscle-memory captured **fingerprints, not code**, which (a) made
skills abstract and (b) collapsed diverse failures of one class into a single fingerprint line. v3 is
the design change that fixes both, and the honest measurement of how far it closes the gap.

## The change (gated, privacy-preserving)
`MM_CAPTURE` adds an opt-in capture tier (default still pure fingerprints):
- `context` — capture the **redacted real error message** + touched symbol.
- `worked` — also capture the **redacted fix diff** (before→after).

All fragments are credential/path-scrubbed at capture (`redactFragment`, shared with the fingerprint
scrubber) and the final skill body is re-scanned by `scanSkillContent` before any write. Distinct
symptom→fix pairs are preserved through `detectRepairChains` → `buildCrossConversationEvidence`, so a
class's DIVERSE failures become multiple concrete worked-examples in ONE skill — the cross-session
breadth a single-session reviewer structurally cannot produce.

## Results (blind, neutral judge, order-swapped, 7 axes /70; both author on GLM-5.2)

| condition | Hermes | muscle-memory | Δ (mm) |
|---|---|---|---|
| **before capture** (fingerprint-only) | 60.0 | 20.5 | **−39.5** |
| failing-test, **single-session** | 53–55 | **58–59.5** | **+2 to +6.5** ✅ |
| failing-test, equal 4-session | 59.5 | 59.0 | −0.5 (tie) |
| failing-test, 8-session | 59.5 | 57.0 | −2.5 |
| lint, single-session | 59.0 | 57.8 | −1.25 (tie) |

The −39.5 → +6.5 swing on the single-session failing-test class is the headline: a 46-point move that
turns a blowout loss into a robust win (stable across repeated judgings).

## Honest verdict
- **muscle-memory is now a peer of Hermes on distilled-skill quality** — no longer "a tier below."
- It **wins the cold-start / low-session regime** (the realistic case): it brings whole-history breadth
  to bear immediately, while Hermes must accumulate it session-by-session.
- It **wins permanently on hygiene** (deterministic aggregation stays tight — 3954B vs Hermes's
  8954B at 8 sessions — no curator drift/dup), determinism, model-free fallback, and privacy.
- At **equal/high experience it's a tie-to-slightly-behind**: Hermes's per-example *depth*
  (richer pitfalls + concreteness) is higher because it reviews the **full session** while
  muscle-memory authors from a **redacted digest**. That residual gap is structural to the
  privacy-by-fingerprint design; closing it fully needs richer capture (a deliberate trade), not a
  prompt tweak.

*Reproduce:* harnesses in `harness/`; real Hermes via its installer + isolated `HERMES_HOME` on
GLM-5.2; muscle-memory via `MM_CAPTURE=worked` + the deterministic suite (`npm run verify`).
