---
name: recovering-from-pytest-failures
description: Use when `pytest` fails (`assertion`) — recover by applying `Edit.py` then re-running `pytest`, never blind-retrying. Observed 3× across 3 sessions.
---

# recovering-from-pytest-failures

A recovery discipline distilled from 3 real `pytest` fix-then-recheck loops across 3 sessions. The fix is known — apply it instead of re-deriving.

## When to use
- `pytest` fails with `assertion`, or any check→fix→recheck loop on it.
- You're about to re-run `pytest` unchanged after it failed.

## Procedure (decision guide)
1. Run `pytest` and read the concrete error (expect `assertion`).
2. Do NOT blind-retry. Apply the known fix: `Edit.py` — addressing that specific error.
3. Re-run `pytest` to confirm it passes (exit 0).
4. Run once more to rule out a flaky pass.

## Worked example (observed)
- `pytest` failed (`assertion`) → `Edit.py` → re-ran `pytest` → PASS  (3× / 3 sessions)

## Pitfalls (symptom → fix)
- Re-running `pytest` unchanged → stays red; it won't pass until `Edit.py` is applied.
- Treating the first failure as noise → it's signal; the fix is known from 3 prior recoveries.

## Verification
- [ ] `pytest` failed before the fix (real error seen).
- [ ] `pytest` passes after `Edit.py` (exit 0).
- [ ] A second run also passes.
