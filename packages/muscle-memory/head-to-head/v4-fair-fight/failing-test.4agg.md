---
name: debugging-failing-tests
description: Use when a test suite (pytest, unittest, etc.) reports assertion failures, IndexError/KeyError, unexpected None returns, or case/whitespace string mismatches, and you need to diagnose and fix the *source* bug (not the test). Triggers: red test run, "AssertionError", "IndexError: list index out of range", "got None", expected-vs-actual diff visible in output.
---

## When to use

- A test run (e.g. `pytest -q`) shows red, with an expected-vs-actual diff or a runtime exception (`IndexError`, `KeyError`, `TypeError`).
- You can read the failing assertion and map it to a *symptom class* (wrong value, None, off-by-one index, case mismatch).
- The test is correct; the production code is wrong. (If you suspect the test, stop — that is a different skill.)

## Procedure (decision guide: symptom → safest fix path)

1. **Safety net first.** Before editing source, record recoverability: `git stash` your WIP, or commit a WIP commit, or `git tag pre-fix`. Name it so a wrong edit is reversible.
2. **Reproduce in isolation.** Run the single failing test, not the whole suite, so the signal is clean:
   ```bash
   pytest path/to/test_file.py::test_name -q
   ```
3. **Read the assertion and classify the symptom.** Use the expected-vs-actual diff to pick the fix path:
   - **Actual is a *related-but-wrong* value** (sign flipped, wrong op, inverted condition) → [Wrong-operator / inverted-logic] pitfall. Inspect the function body's operators and boolean conditions.
   - **Actual is `None`** → [Missing return] pitfall. Trace every code path; look for `x = compute(...)` that should be `return compute(...)`.
   - **Runtime `IndexError`/`KeyError` on the last iteration** → [Off-by-one bound] pitfall. Check `range(...)`, slicing endpoints, and `len(...)` arithmetic.
   - **Expected vs actual differ only by case or whitespace** → [Unnormalized string] pitfall. Add `.lower()`/`.strip()` at the assignment, not at the comparison site.
   - **Test passes alone, fails in the full suite (or vice versa)** → [State/order dependence] pitfall. Look for module-level mutables, caches, or global state.
4. **Change source, not tests.** Tests encode the spec; the bug is in production code. If you feel the urge to edit the test, re-read step 3.
5. **Make the smallest reversible edit.** One operator, one keyword, one `.lower()` — then re-run the single test before touching anything else.
6. **Re-run the single test → then the file → then the whole suite** (see Verification).

## Pitfalls

- **Wrong operator / inverted-logic.** *Symptom:* expected value and actual value are related by a different operation (e.g. expected `5`, got `-1`; or condition fires when it shouldn't). *Fix:* locate the arithmetic/boolean operator in the function body and correct it (`-`→`+`, `>`→`<`, `and`↔`or`). *TELL:* actual looks like the inputs were combined by a *different but plausible* operator.
- **Off-by-one loop bound.** *Symptom:* `IndexError: list index out of range` (or a silent extra/missing iteration). *Fix:* correct the bound — `range(len(xs))`, not `range(len(xs) + 1)`; check slicing `[i:i+k]` endpoints. *TELL:* the exception fires on the *last* iteration, at `i == len(xs)`.
- **Missing `return` statement.** *Symptom:* actual is `None` when a concrete value was expected; the function visibly computes but discards the result. *Fix:* ensure the value is returned on every path — `return compute(x)` rather than `result = compute(x)`; check early-return branches too. *TELL:* actual is `None` *and* the relevant expression is evaluated but its result is unused.
- **Unnormalized string (case/whitespace).** *Symptom:* `assert mode == 'prod'` fails with `got 'PROD'`; the strings are equal modulo case. *Fix:* normalize at the assignment source (`mode = raw.lower()`), not by loosening the assertion. *TELL:* expected and actual are identical after `.lower().strip()`.
- **State / order dependence (adjacent).** *Symptom:* test passes in isolation, fails in the full suite (or the reverse). *Fix:* eliminate shared mutable state — module-level lists/dicts, caches, class attributes mutated in `__init__`; add a reset or make the function pure. *TELL:* running the file alone is green; running the directory is red.
- **Mutable default argument (adjacent).** *Symptom:* a function returns accumulated/stale data across calls. *Fix:* replace `def f(xs=[])` with `def f(xs=None): if xs is None: xs = []`. *TELL:* failure depends on call count or call order of the same function.
- **Identity vs equality / float exactness (adjacent).** *Symptom:* `assert x == y` fails for values that "should" be equal (NaN, floats, custom objects). *Fix:* use `pytest.approx` for floats, `==` instead of `is` for value types, or define `__eq__`. *TELL:* the repr of expected and actual look identical but the comparison is still False.

## Verification

1. Re-run the originally-failing test in isolation:
   ```bash
   pytest path/to/test_file.py::test_name -q
   ```
   → green.
2. Re-run the whole file to catch local regressions:
   ```bash
   pytest path/to/test_file.py -q
   ```
3. Re-run the full suite to catch distant regressions caused by your edit:
   ```bash
   pytest -q
   ```
   → all green, no new failures.
4. If multiple tests were red, use `-x` to stop at the first remaining failure and repeat the Procedure:
   ```bash
   pytest -q -x
   ```
5. Confirm the safety net is no longer needed only *after* the full suite is green; then it can be dropped (`git tag -d pre-fix`) or kept as a checkpoint.

## Worked examples (real cases)

1. **Wrong operator.**
   - Symptom: `AssertionError: assert add(2, 3) == 5, got -1`
   - Fix:
     ```diff
     - return a - b
     + return a + b
     ```
   - TELL: actual `-1` = the inputs combined by subtraction instead of addition.

2. **Off-by-one loop bound.**
   - Symptom: `IndexError: list index out of range`
   - Fix:
     ```diff
     - for i in range(len(xs) + 1):
     + for i in range(len(xs)):
     ```
   - TELL: crash occurs when `i == len(xs)` — the loop ran one step too far.

3. **Missing return.**
   - Symptom: `AssertionError: assert handle(x) == 42, got None`
   - Fix:
     ```diff
     - result = compute(x)
     + return compute(x)
     ```
   - TELL: actual is `None`; the value is computed and bound but never returned.

4. **Unnormalized string case.**
   - Symptom: `AssertionError: assert mode == 'prod', got 'PROD'`
   - Fix:
     ```diff
     - mode = raw
     + mode = raw.lower()
     ```
   - TELL: expected and actual match after lowercasing — pure normalization gap.
