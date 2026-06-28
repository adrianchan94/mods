---
name: recovering-from-pyflakes-failures
description: Use when `pyflakes` fails (`error`) — recover by applying `Edit.py` then re-running `pyflakes`, never blind-retrying. Observed 3× across 3 sessions.
---

# recovering-from-pyflakes-failures

A recovery discipline distilled from 3 real `pyflakes` fix-then-recheck loops across 3 sessions. The fix is known — apply it instead of re-deriving.

## When to use
- `pyflakes` fails with `error`, or any check→fix→recheck loop on it.
- You're about to re-run `pyflakes` unchanged after it failed.

## Procedure (decision guide)
1. Run `pyflakes` and read the concrete error (expect `error`).
2. Do NOT blind-retry. Apply the known fix: `Edit.py` — addressing that specific error.
3. Re-run `pyflakes` to confirm it passes (exit 0).
4. Run once more to rule out a flaky pass.

## Worked example (observed)
- `pyflakes` failed (`error`) → `Edit.py` → re-ran `pyflakes` → PASS  (3× / 3 sessions)

## Pitfalls (symptom → fix)
- Re-running `pyflakes` unchanged → stays red; it won't pass until `Edit.py` is applied.
- Treating the first failure as noise → it's signal; the fix is known from 3 prior recoveries.

## Verification
- [ ] `pyflakes` failed before the fix (real error seen).
- [ ] `pyflakes` passes after `Edit.py` (exit 0).
- [ ] A second run also passes.
