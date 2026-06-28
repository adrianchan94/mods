---
name: debugging-failing-tests
description: Use when a test suite reports failures — AssertionError, IndexError, KeyError, unexpected None, case/normalization mismatch. Guides you through diagnosing the failure class from error output, fixing the source (never the test), and confirming green.
---

## When to use
- A test run produces assertion failures, exceptions, or wrong return values.
- You need to identify whether the bug is wrong logic, off-by-one bounds, a missing return, a normalization gap, or unsafe dict/list access — and apply the minimal source fix.

## Procedure

1. **Capture the failure output.** Run quietly for a clean signal:
   ```bash
   pytest -q
   ```
   Read the assertion line: it states *expected vs actual* — that pair is your primary diagnostic.

2. **Diagnose the failure class** by matching the symptom (see Pitfalls for each and its tell):
   | Symptom signal | Failure class |
   |---|---|
   | Result has wrong sign/magnitude | Logic error (wrong operator/branch) |
   | IndexError at last/first position | Off-by-one bounds |
   | `None` where a value expected | Missing `return` |
   | Values differ only in case/whitespace | Normalization mismatch |
   | KeyError / IndexError mid-access | Unsafe dict/list access |

3. **Read source before editing.** Open the file under test, locate the expression producing the wrong result, and confirm it matches the failure class — never guess blindly.

4. **Apply the smallest fix to source only** (never the test — the test encodes the spec):
   ```python
   # logic — wrong operator
   - return a - b
   + return a + b

   # off-by-one — loop bound
   - for i in range(len(xs) + 1):
   + for i in range(len(xs)):

   # missing return — value computed but discarded
   - result = compute(x)
   + return compute(x)

   # normalization mismatch — canonicalize at ingestion
   - mode = raw
   + mode = raw.lower()

   # unsafe dict access — key may be absent
   - return d[k]
   + return d.get(k)
   ```

5. **Re-run the failing test first, then the full suite:**
   ```bash
   pytest -q path/to/test_file.py::test_name   # targeted
   pytest -q                                     # full regression
   ```

## Pitfalls

1. **Patching the test instead of the source.**
   *Tell:* The test file appears in `git diff`.*
   Fix: Revert test changes immediately — the test is the spec; always fix the implementation.

2. **Off-by-one loop bounds.**
   *Tell:* Failure at boundary (last or first element), not mid-sequence.*
   Fix: Remove `+ 1` from range upper bound; prefer `for x in xs:` over index-based loops when the index is unnecessary.

3. **Missing return statement.**
   *Tell:* `assert ... == 42, got None` — function computed but returned Python's implicit `None`.*
   Fix: Add `return` before the computed expression; check for early-return branches that bypass the main computation.

4. **Case/normalization mismatch.**
   *Tell:* Expected and actual differ only in case, whitespace, or trailing characters.*
   Fix: Normalize at the point of assignment/ingestion (`raw.lower().strip()`), not at comparison time.

5. **Unsafe dict/object access on optional keys.**
   *Tell:* `KeyError` on direct subscript `d[k]` rather than `.get(k)`.*
   Fix: Use `d.get(k)` (returns `None`) or `d.get(k, default)` for optional keys; reserve `d[k]` for keys that are contractually guaranteed.

6. **Masked cascading failures & test-order dependence.**
   *Tell:* Fixing one failure reveals several more, or tests pass individually but fail when run together.*
   Fix: Fix failures top-to-bottom (the first error often cascades). For pass-alone-fail-together, inspect shared module-level state, global mutation, or fixture leakage — isolate with `pytest -q single_file.py` to confirm.

## Verification
- All previously-failing tests pass AND no new tests break:
  ```bash
  pytest -q
  ```
- Confirm `git diff --stat` lists changes only in source files, never in test files.
