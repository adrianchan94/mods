---
name: recovering-from-node-failures
description: Use when `node` fails (`cannot-find`) — recover by applying `npm install` then re-running `node`, never blind-retrying. Observed 3× across 3 sessions.
---

# recovering-from-node-failures

A recovery discipline distilled from 3 real `node` fix-then-recheck loops across 3 sessions. The fix is known — apply it instead of re-deriving.

## When to use
- `node` fails with `cannot-find`, or any check→fix→recheck loop on it.
- You're about to re-run `node` unchanged after it failed.

## Procedure (decision guide)
1. Run `node` and read the concrete error (expect `cannot-find`).
2. Do NOT blind-retry. Apply the known fix: `npm install` — addressing that specific error.
3. Re-run `node` to confirm it passes (exit 0).
4. Run once more to rule out a flaky pass.

## Worked example (observed)
- `node` failed (`cannot-find`) → `npm install` → re-ran `node` → PASS  (3× / 3 sessions)

## Pitfalls (symptom → fix)
- Re-running `node` unchanged → stays red; it won't pass until `npm install` is applied.
- Treating the first failure as noise → it's signal; the fix is known from 3 prior recoveries.

## Verification
- [ ] `node` failed before the fix (real error seen).
- [ ] `node` passes after `npm install` (exit 0).
- [ ] A second run also passes.
