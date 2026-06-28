---
name: debugging-pytest-failures
description: Systematic approach to diagnosing and fixing failing pytest suites by correcting source (never tests).
---

# Debugging Failing pytest Suites

## When to use
- `pytest` (or `python3 -m pytest`) reports failures in an existing project.
- You must fix the SOURCE under test, never the tests themselves.

## Method
1. **Run the suite, capture the tail.** Always start with the real failure output, not assumptions:
   ```
   python3 -m pytest -q 2>&1 | tail -40
   ```
   `-q` keeps it compact; `tail` avoids truncation noise. Note exit code and count of failures.

2. **Read ONE failing test at a time.** Work first-to-last; a fix at the top often clears cascading failures. For the current failure, read the test file at the exact line pytest flags.

3. **Isolate the contract.** From the assertion, state in plain words what the function is SUPPOSED to return for the given input. This is the spec — it's authoritative; do not change it.

4. **Read the source under test.** Open the module the test imports from. Compare actual behavior to the stated contract.

5. **Classify the bug** — this drives the fix shape:
   - **Logic inversion / wrong operator** (e.g., `return a - b` where `+` was meant). Fix the operator.
   - **Off-by-one / boundary** (e.g., `<` vs `<=`, range end). Fix the comparison.
   - **Wrong variable / typo** (e.g., returns `b` instead of `result`). Fix the reference.
   - **Missing return / implicit None.** Add the return.
  - **Passthrough / missing transformation.** Function returns its input unchanged (`return raw`) when the contract requires a transform (lowercase, strip, map, filter). Spot it by asking "what should this DO to the input?" — if the answer is "nothing," you've found the bug. Add the transform inline.
  - **Floating-point truncation** (assertion is off by exactly 1, on a value derived from float arithmetic). Source uses `int(x)` (which truncates toward zero) on a float product that's microscopically below the intended integer — e.g., `1.15 * 100` evaluates to `114.99999999999999` in IEEE-754, so `int(1.15*100)` yields `114`, not `115`. Tell: the failure is `assert 114 == 115` (or analogous N vs N+1) on a function that multiplies/divides a decimal and casts with `int()`; the value is consistently LOW by 1, never high. Fix by replacing `int(x)` with `round(x)` (rounds to nearest, absorbing the representation error). For money/currency specifically, prefer `round()` or use `decimal.Decimal` to avoid float entirely. Do NOT "fix" by adding `+1` — that papers over the root cause and breaks for values that already round correctly.
  - **Type coercion missing** (a `TypeError` from a built-in like `sum`, `max`, `sorted`, `+`). The source passes raw, unconverted inputs (e.g., `sum(['1','2','3'])`) to a built-in that only works on one type. Tell: `TypeError: unsupported operand type(s)` on a call that looks syntactically fine — the input type is the bug, not the operator. Fix by coercing inputs before/inside the built-in (e.g., `sum(int(x) for x in items)`). Closely related to passthrough: both are "missing transformation," but coercion surfaces as an exception, passthrough as a wrong value.
  - **Exception raised** (traceback, not just wrong value). Read the traceback; fix the cause. A very common sub-case is **unsafe key access** — source uses `d[k]` (raises `KeyError` on missing keys) where the contract expects graceful lookup returning `None`; fix by switching to `d.get(k)` (or `d.get(k, default)`).
    - **Mutation of input / unwanted side effect** (function modifies a mutable argument in place when the contract requires it to stay pure). Tell: the test asserts the *original* input (or some prior state) is unchanged after the call — e.g. `assert base == [1]` fails showing `base` grew — yet the *return value* may be correct. This is NOT the same as wrong-value; the value is fine, the side effect is the bug. Fix by returning a new object instead of mutating: swap `xs.append(x); return xs` → `return xs + [x]` (lists), or copy first (`xs = list(xs)` / `xs.copy()`) then mutate the copy. Same shape bites dicts (`d[k] = v` in place), sets, and dataclasses with mutable defaults.
   - **Import error / missing symbol.** Check the module path and definition exists.
   - **State / order-dependence** (passes alone, fails in full run). Look for shared mutable globals or missing teardown.

6. **Patch the SOURCE only.** Never edit the test file. Use `patch` (targeted) or `write_file` (full rewrite for tiny modules).

7. **Re-run the full suite** (not just the one test) to confirm green and catch regressions:
   ```
   python3 -m pytest -q 2>&1 | tail -10
   ```

## Pitfalls
- **Don't "fix" the test to match broken source.** The test is the spec. If the test genuinely seems wrong, stop and confirm with the user — but default to trusting it.
- **Don't fix only the first failure and assume the rest follow.** Re-run the whole suite; some failures are independent.
- **Watch for `-q` hiding detail.** If a failure is unclear, drop the flag or add `-x` (stop at first) / `--tb=long`.
- **Silent None returns.** A function with no `return` yields `None`; pytest shows `None != expected` — easy to misread as "missing value" when it's really a missing return statement.
- **Shared fixtures / module-level state.** A test passing in isolation but failing in the full run usually means leaked state — check fixtures' `yield`/teardown and module-level mutables.

## Examples (real cases)
- `calc.py::add` returned `a - b`; test asserted `add(2,3)==5` but got `-1`.
  - Bug class: wrong operator (logic inversion).
  - Fix: `return a + b`. Suite went green on re-run.
- `parser.py::last3` raised `IndexError: list index out of range`; test asserted `last3([1,2,3,4])==[2,3,4]`.
  - Bug class: off-by-one / boundary — loop used `range(len(xs)+1)`, walking one index past the last element.
  - Fix: `range(len(xs))`. Suite went green on re-run.
  - Tell: an `IndexError` inside an indexed loop is almost always an off-by-one in the range/condition — check the bound first before anything else.
- `handler.py::handle` returned `None`; test asserted `handle(21)==42`.
  - Bug class: missing return / implicit None.
  - Tell: assertion reads `assert None == expected` AND the function body clearly computes the right value into a local but has no `return` line — that gap is the whole bug. Scan for the last assignment before end-of-function; if the value you'd want is sitting in a local with no `return` in front, add it.
  - Fix: add `return result`. One-line patch, suite went green on re-run.
- `config.py::norm` returned `'PROD'` (the raw input); test asserted `norm('PROD')=='prod'`.
  - Bug class: passthrough / missing transformation — assignment was `mode = raw`, no lowercasing.
  - Fix: `mode = raw.strip().lower()`. Suite went green on re-run.
- `lookup.py::get` raised `KeyError: 'b'`; test asserted `get({'a':1}, 'b') is None`.
  - Bug class: unsafe key access — source did `return d[k]`.
  - Tell: a `KeyError` on a lookup function whose test asserts `is None` means the contract is "missing key → None", not "missing key → crash". Swap `d[k]` for `d.get(k)`.
  - Fix: `return d.get(k)`. Suite went green on re-run.
- `sum2.py::total` raised `TypeError: unsupported operand type(s) for +: 'int' and 'str'`; test asserted `total(['1','2','3'])==6`.
  - Bug class: type coercion missing — source did `return sum(items)` with string items.
  - Tell: a `TypeError: unsupported operand type(s)` on a call that's syntactically correct (`sum(items)` looks fine) means the input type is the bug. Built-ins like `sum`, `max`, `sorted` only work on one type; if the test feeds strings, coerce before use.
  - Fix: `return sum(int(x) for x in items)`. Suite went green on re-run.

- `acc.py::add_item` mutated its input: `base=[1]; add_item(base,2); assert base==[1]` failed showing `[1,2]`.
  - Bug class: mutation of input / unwanted side effect — body was `xs.append(x); return xs`.
  - Tell: the return value was correct; only the side effect failed the assertion. When a test checks an input *after* the call (not the return), suspect mutation. Lists, dicts, sets, and mutable default args are the usual victims.
  - Fix: `return xs + [x]` (non-mutating). Suite went green on re-run.

- `money.py::cents` returned `114`; test asserted `cents(1.15)==115`.
  - Bug class: floating-point truncation — body was `return int(d*100)`.
  - Tell: `1.15 * 100` is `114.99999999999999` in IEEE-754; `int()` truncates toward zero, dropping it to `114`. Classic "off by exactly 1, always low" signature on any decimal→integer conversion via `int()`.
  - Fix: `return round(d*100)`. Suite went green on re-run. (For production money code, prefer `decimal.Decimal`.)

## Verification
- Exit code 0 from `python3 -m pytest -q`.
- Output ends with `N passed` and no `FAILED` summary lines.
