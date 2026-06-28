---
name: fixing-failing-pytest-tests
description: Use when a pytest assertion fails and you need to diagnose the failing assertion, locate the source bug, and apply the minimal correct fix. Covers off-by-one loops, missing returns, type coercion, float truncation, input mutation, case-normalization gaps, and unsafe dict lookups.
---

## When to use

- A `pytest` run ends with an `AssertionError`, `TypeError`, `IndexError`, `KeyError`, or an unexpected `None`.
- The failure message shows `expected X, got Y` and the gap between `X` and `Y` hints at a specific bug class.
- You are about to edit the implementation under test (not the test) to make the assertion pass.

## Procedure

**Decision guide — start from the symptom, not the file.**

1. **Reproduce the exact failure.** Run the single failing test in quiet mode to capture the precise assertion line and the `expected` vs `got` values.

   ```bash
   pytest -q path/to/test_file.py::test_name
   ```

2. **Make a safety net before editing.** Stash or branch so a wrong edit is reversible. Do not skip this even for a one-line fix.

   ```bash
   git stash push -m "before-fix-attempt"   # or: git switch -c fix/wip
   ```

3. **Read the gap between expected and actual, then route to the matching pitfall below:**

   | Symptom shape | Likely class | Go to pitfall |
   |---|---|---|
   | `got None` | missing `return` | P1 |
   | `IndexError` | off-by-one loop bound | P2 |
   | `got 'PROD'`, expected `'prod'` | missing normalization | P3 |
   | `KeyError` | unsafe dict access | P4 |
   | `got '123'`, expected `6` | string/numeric type coercion | P5 |
   | Input or shared list changed unexpectedly | mutation of input | P6 |
   | `got 114`, expected `115` (cents/percent) | float→int truncation | P7 |
   | Arithmetic result has wrong sign/value | wrong operator | P8 |

4. **Inspect the implementation, not the test.** Open the function under test; confirm the test itself encodes the intended contract before changing source. **Change source, never the test** unless the test is provably wrong (rare).

5. **Apply the smallest reversible edit** that targets the diagnosed class — use the exact fix pattern from the matching pitfall.

6. **Re-run the single test, then the whole suite.**

   ```bash
   pytest -q path/to/test_file.py::test_name && pytest -q
   ```

7. **Commit only when green.** If still red, re-read the new symptom and re-route from step 3 — do not pile on speculative edits.

## Pitfalls

**P1 — Missing `return` (computed value discarded)**
Symptom: `assert f(x) == 42, got None`.
Fix: actually return the computed value.
```python
- result = compute(x)
+ return compute(x)
```
TELL: the function body assigns to a local but the last line is not a `return`.

**P2 — Off-by-one loop bound**
Symptom: `IndexError: list index out of range`.
Fix: iterate over valid indices, not one past the end.
```python
- for i in range(len(xs) + 1):
+ for i in range(len(xs)):
```
TELL: a `+ 1` (or `<=` instead of `<`) on the loop bound when indexing into a sequence.

**P3 — Case-normalization gap**
Symptom: `assert mode == 'prod', got 'PROD'`.
Fix: normalize at the boundary where raw input enters.
```python
- mode = raw
+ mode = raw.lower()
```
TELL: the "got" value differs from expected only by letter case.

**P4 — Unsafe dict lookup**
Symptom: `KeyError: 'b'`.
Fix: use `.get` (or an explicit default) for optional keys.
```python
- return d[k]
+ return d.get(k)
```
TELL: `d[k]` on a key that the test does not guarantee exists.

**P5 — String/numeric type coercion**
Symptom: `total(['1','2','3']) == 6, got '123'`.
Fix: convert each element to the intended numeric type before reducing.
```python
- return sum(items)
+ return sum(int(x) for x in items)
```
TELL: the "got" value is a concatenation where a numeric sum was expected.

**P6 — Mutation of input or shared state**
Symptom: `assert base == [1], got [1, 2]` after a call that should not have changed `base`.
Fix: build and return a new structure instead of mutating in place.
```python
- xs.append(x); return xs
+ return xs + [x]
```
TELL: the function calls `.append`/`.extend`/`.sort`/`[i]=` on an argument or module-level object.

**P7 — Float→int truncation (cents/percent math)**
Symptom: `cents(1.15) == 115, got 114`.
Fix: round before truncating, or use integer cents throughout.
```python
- return int(d * 100)
+ return round(d * 100)
```
TELL: the result is off by exactly one on values whose float representation is slightly below the integer (e.g. `1.15 * 100 == 114.999…`).

**P8 — Wrong operator / sign error**
Symptom: `assert add(2, 3) == 5, got -1`.
Fix: use the operator that matches the function's documented intent.
```python
- return a - b
+ return a + b
```
TELL: the result is arithmetically consistent with a different operator than the function name implies.

**Adjacent failure modes (also check):**

- **State/order dependence** — a test passes alone but fails in the full suite. TELL: green in isolation, red in `pytest -q`; look for module-level mutable state or a test that forgot to reset fixtures. Fix: isolate state per test, never mutate module globals.
- **Import/path errors** — `ModuleNotFoundError` or `ImportError` mid-run. TELL: the test collects fine but the function under test can't be imported; fix the import path or `sys.path`, do not inline the code.
- **Masked cascading failure** — the first assertion hides the real bug because an earlier helper returned `None`/wrong type. TELL: a downstream `AttributeError: 'NoneType'` or a type error one frame deeper than the line you're staring at. Fix the root (usually P1 or P5) first, then re-run before chasing the symptom.

## Verification

- The originally failing test now passes in isolation.
- `pytest -q` on the full file (and full suite) is green — no cascade, no order dependence.
- `git diff` shows only the source change that matches the diagnosed pitfall; the test file is unmodified.
- If a safety net was created, it is cleaned up (`git stash drop` only after the suite is green and committed).

## Worked examples (real cases)

1. **Wrong operator (P8)**
   - Symptom: `assert add(2, 3) == 5, got -1`
   - Fix: `- return a - b` → `+ return a + b`
   - TELL: function named `add` but returns a difference.

2. **Off-by-one (P2)**
   - Symptom: `IndexError: list index out of range`
   - Fix: `- for i in range(len(xs) + 1):` → `+ for i in range(len(xs)):`
   - TELL: `+ 1` on the index range.

3. **Missing return (P1)**
   - Symptom: `assert handle(x) == 42, got None`
   - Fix: `- result = compute(x)` → `+ return compute(x)`
   - TELL: local assigned, never returned.

4. **Case normalization (P3)**
   - Symptom: `assert mode == 'prod', got 'PROD'`
   - Fix: `- mode = raw` → `+ mode = raw.lower()`
   - TELL: only letter case differs.

5. **Unsafe dict access (P4)**
   - Symptom: `KeyError: 'b'`
   - Fix: `- return d[k]` → `+ return d.get(k)`
   - TELL: direct subscript on an unguarded key.

6. **Type coercion (P5)**
   - Symptom: `total(['1','2','3']) == 6, got '123'`
   - Fix: `- return sum(items)` → `+ return sum(int(x) for x in items)`
   - TELL: concatenation instead of summation.

7. **Input mutation (P6)**
   - Symptom: `assert base == [1], got [1, 2]`
   - Fix: `- xs.append(x); return xs` → `+ return xs + [x]`
   - TELL: in-place `.append` on an argument.

8. **Float truncation (P7)**
   - Symptom: `cents(1.15) == 115, got 114`
   - Fix: `- return int(d * 100)` → `+ return round(d * 100)`
   - TELL: off-by-one on a money/percent conversion.
