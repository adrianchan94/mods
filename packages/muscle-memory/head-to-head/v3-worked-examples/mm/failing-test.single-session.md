---
name: debugging-failing-tests
description: Use when a test suite reports failures (AssertionError, IndexError, unexpected None, etc.) and you need to localize the defect in source code, fix it minimally, and confirm green. Triggers on pytest/unittest/jest failures, CI red builds, or any assertion-vs-expected mismatch.
---

## When to use

- A test fails with an `AssertionError` or runtime error (`IndexError`, `KeyError`, `TypeError`) and the test itself is trusted.
- CI goes red and you need to find the smallest source change that flips it green.
- Multiple tests fail at once and you need to determine whether they share one root cause.

## Procedure

1. **Run the suite in quiet mode** to get a compact, scannable failure list.
   ```bash
   pytest -q
   ```

2. **Read the assertion to map expected vs. actual.** The diff *is* the bug specification — note the exact values.

3. **DECISION: is the test wrong or is the source wrong?**
   - If the test encodes a correct contract (the expected value is genuinely right) → fix **source**, not the test. Never edit a test to make it pass.
   - If the test itself has a typo/ambiguous contract → fix the test, but flag it explicitly.

4. **Localize the defect** by diffing the expected vs. actual at the call site, then trace into the implementation. Inspect before editing.

5. **Make the smallest reversible edit** to source. One logical change per pass.

6. **Re-run the single failing test first**, then the full suite.

   ```bash
   pytest -q path/to/test_file.py::test_name
   pytest -q
   ```

## Pitfalls

**Symptom: `assert f(2, 3) == 5` fails with `-1` → wrong operator in logic.**
*Tell:* The result equals a *different but structured* value (e.g., `a - b` instead of `a + b`).
*Fix:* Inspect every operator in the computation path; swap the incorrect one.
```python
- return a - b
+ return a + b
```

**Symptom: `IndexError: list index out of range` in a loop → off-by-one boundary error.**
*Tell:* The error occurs at the *last* or *first* iteration, not mid-loop.
*Fix:* Audit loop bounds — `range(len(xs) + 1)` overruns by one.
```python
- for i in range(len(xs) + 1):
+ for i in range(len(xs)):
```

**Symptom: `assert handle(x) == 42, got None` → missing `return`.**
*Tell:* Actual is `None` and the function has a computation whose result is assigned but never returned.
*Fix:* Return the computed value instead of (or in addition to) assigning it.
```python
- result = compute(x)
+ return compute(x)
```

**Symptom: `assert mode == 'prod', got 'PROD'` → case-normalization mismatch.**
*Tell:* The actual value differs from expected *only* in letter case.
*Fix:* Normalize input at the boundary, not at every comparison site.
```python
- mode = raw
+ mode = raw.lower()
```

**Symptom: You "fixed" a failure by editing the test's expected value.**
*Tell:* The diff touches the test file, not the source file.
*Fix:* Revert the test edit immediately; the test is the contract. Fix the source.

**Symptom: Fixing one failure reveals/creates N new failures.**
*Tell:* Pass count changes erratically across runs, or failures shift between functions.
*Fix:* Look for a shared dependency (a common helper, config value, or mutable global) whose incorrect behavior cascades. Fix the root; do not patch each downstream symptom.

## Verification

- The originally failing test passes **without** editing the test file.
- `pytest -q` is fully green (no regressions introduced).
- If multiple tests were failing, confirm they all pass from the **single** root-cause fix (strong signal you fixed the real defect, not a symptom).
