---
name: failing-test-debugging-loop
description: Disciplined fail->fix->pass workflow for any failing pytest/test suite. Read the failing test AND the implementation side-by-side, fix the source (never the test), then re-run to confirm green. Not bug-specific — applies to any code-under-test.
---

# Failing Test Debugging Loop

A repeatable, zero-guesswork procedure for turning a red test suite green without editing tests.

## When to use
- A test suite (pytest, unittest, jest, etc.) is failing and you need to diagnose and fix.
- You must change source code to match test expectations — NOT the other way around.
- Time pressure: this loop is fast because it refuses to speculate before reading.

## The loop (in strict order)

1. **Run the suite, capture the actual failure.** Never assume the cause from the test name alone. Read the traceback: which assertion failed, with what inputs and expected vs actual values? pytest's `-q` is enough; use `-x` to stop at first failure if there's cascading noise.
2. **Open the failing test AND the implementation side-by-side.** This is the single most important step. The bug is almost always the gap between what the test asserts and what the source computes. Reading only one side leads to guessing.
   - Confirm the test's *expectation* is correct/sensible before touching source. (If the test itself is genuinely wrong, that's a different conversation with the author — out of scope here. Default: trust the test.)
3. **Form the minimal hypothesis.** State in one sentence what the source does wrong. e.g. "add() subtracts instead of adding." Resist scope creep — don't refactor, don't "improve while we're here."
4. **Make the smallest possible source edit.** Use a targeted patch, not a rewrite. One logical change.
5. **Re-run the FULL suite, not just the one test you touched.** A fix can break a sibling. Confirm `[100%] ... passed`.
6. **If still red: loop back to step 2.** Do not pile on changes. Re-read the side-by-side with the new failure in mind.

## Hard rules
- **Never edit the test to make it pass.** Tests encode the spec. If source and test disagree, source is wrong by default.
- **Never "fix" by deleting an assertion, commenting out a test, or loosening a comparison.** This is the classic anti-pattern; it produces green lies.
- **One change per loop iteration.** Stacking multiple speculative edits destroys your ability to know which one fixed (or broke) what.
- **Read before you patch.** The traceback tells you WHAT failed; only reading source + test tells you WHY.

## Pitfalls
- Assuming the bug from the test name → wrong fix, wasted cycle. Always read both files.
- "Improving" unrelated code mid-fix → new failures, confused bisect.
- Editing tests because "the test looks buggy" without confirming with the author → silently weakens coverage.
- Trusting a single passing test run as "done" when other tests in the suite might regress → always re-run all.

## Verification
After step 5: the full suite must report all passed. If only the targeted test is green, keep going — a sibling may have regressed.

## Why this works
Every red test is a delta between spec (test) and implementation (source). The fastest path to green is to read both deltas directly, make one minimal correction, and let the suite confirm. Speculation and refactors add variables; this loop removes them.
