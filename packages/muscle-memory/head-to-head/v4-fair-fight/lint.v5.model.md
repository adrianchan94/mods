---
name: fixing-pyflakes-lint-errors
description: Use when pyflakes reports violations (undefined names, unused imports, unused variables, redefined imports) in a Python file and you need to resolve each by its correct fix class. Triggered by lines like `undefined name`, `imported but unused`, `assigned but never used`, `redefinition of unused`, or `local variable ... is assigned but never used`.
---

## When to use

- You ran `pyflakes` (or a wrapper like `flake8` with pyflakes checks) and got one or more violations.
- You need to fix each violation by **editing the source file** (not silencing or disabling the check).
- The violations fall into pyflakes' core categories: undefined name, unused import, unused local variable, redefinition of unused import, or related classes.

## Procedure

**Classify each violation first, then apply the fix matching its class.** Each class has a different correct fix — applying the wrong one (e.g., deleting a variable that has side effects, or removing an import that is re-exported) causes silent regressions.

### Step 0 — Safety net

Before editing, ensure the change is reversible:

```bash
# If the repo is under git, stage or stash the current state:
git stash   # or: git add -A && git commit -m "checkpoint before lint fixes"
```

If not under version control, copy the file:

```bash
cp service.py service.py.bak
```

### Step 1 — Run pyflakes and list every violation

```bash
pyflakes <file_or_dir>
```

Capture all output. If multiple files are flagged, process file-by-file.

### Step 2 — Classify each violation by its message pattern

Match the message to one of the classes below, then follow the corresponding fix path:

| pyflakes message contains | Class | Fix path |
|---|---|---|
| `undefined name 'X'` | Undefined name (typo or missing import) | **A** |
| `'X' imported but unused` | Unused import | **B** |
| `local variable 'X' (is )?assigned but never used` | Unused local variable | **C** |
| `redefinition of unused 'X' from line N` | Duplicate / redefined import | **D** |
| `redefinition of function 'X'` | Duplicate function definition | **E** |
| `duplicate argument 'X' in function definition` | Duplicate parameter | **F** |

### Fix path A — Undefined name

1. Search the file for a similar identifier that the name is likely a typo of (e.g., `reuslt` → `result`).
2. If no obvious typo source exists, check whether a missing import or missing global/enclosing-scope definition is the cause.
3. **Safest fix**: correct the typo to the intended in-scope name.

```python
# Before:
print(reuslt)
# After:
print(result)
```

4. If the name genuinely does not exist in scope, add the missing import or definition — do **not** suppress the error.

### Fix path B — Unused import

1. Confirm the imported name is not used anywhere in the file — including string annotations, `__all__`, type comments (`# type: ...`), or conditional branches that pyflakes skips.
2. **Safest fix**: delete the import line entirely.

```python
# Before:
import os
# After:
# (line removed)
```

3. **Fallback** — if the import is intentionally re-exported (part of a public API), add it to `__all__` rather than removing it; pyflakes treats names in `__all__` as used.

### Fix path C — Unused local variable

1. Inspect the assignment expression for **side effects** (function calls, attribute writes, subscriptions).
2. If the right-hand side is side-effect-free (pure value, simple literal, arithmetic): delete the entire assignment line.
3. If the right-hand side has a side effect (e.g., `tmp = compute()` where `compute()` mutates state): either keep the call and remove the binding, or use the result.

```python
# Before (no side effect — safe to delete):
tmp = compute()
# After (if compute() is pure and result is genuinely unneeded):
pass  # or remove the line entirely

# Before (side-effectful call — preserve the call, drop the binding):
tmp = compute()
# After:
compute()
```

4. If the variable **should** have been used (logic bug), wire it into the return or downstream logic instead of deleting it.

### Fix path D — Duplicate / redefined import

1. Find both import lines (pyflakes reports the second with `redefinition of unused 'X' from line N`).
2. **Safest fix**: delete the duplicate line, keeping only the first import.

```python
# Before:
import json
import json
# After:
import json
```

3. If the two imports bring in different members from the same module, consolidate them into a single import statement.

### Fix path E — Duplicate function definition

1. Identify which definition is the intended one (check call sites, signatures, docstrings).
2. Remove the unintended duplicate.

### Fix path F — Duplicate parameter

1. Rename one of the duplicate parameters to a distinct, meaningful name.
2. Update references within the function body accordingly.

### Step 3 — Re-run pyflakes

```bash
pyflakes <file_or_dir>
```

All previously reported violations must be gone. See [Verification](#verification).

## Pitfalls

### Pitfall 1 — Undefined name is a typo, not a missing import

**Symptom:** `undefined name 'reuslt'` — a name that looks almost like a real identifier in the file.

**Fix:** Find the closest levenshtein match in scope and correct the spelling. Do **not** add a new import or define a placeholder.

**TELL:** The flagged name is a scrambled/misspelled variant of a name already defined earlier in the same file.

### Pitfall 2 — Removing an import that is secretly re-exported

**Symptom:** `'X' imported but unused` — but downstream modules do `from this_module import X`.

**Fix:** Add `'X'` to the module's `__all__` list instead of deleting the import.

**TELL:** The module is a public `__init__.py`, API facade, or contains an `__all__` declaration — the import is an intentional re-export, not dead code.

### Pitfall 3 — Deleting an unused variable that had a side effect

**Symptom:** `local variable 'tmp' (is )?assigned but never used` — the RHS is a function call with side effects.

**Fix:** Keep the call, drop the variable binding: change `tmp = compute()` to `compute()`.

**TELL:** The right-hand side of the assignment is a function call or method invocation, not a literal or arithmetic expression.

### Pitfall 4 — Duplicate import lines mistaken for two different imports

**Symptom:** `redefinition of unused 'json' from line 1` — the same module imported twice on consecutive lines.

**Fix:** Delete the second (redundant) import line; keep only the first.

**TELL:** pyflakes explicitly names the earlier line number in the message — both lines import the identical name from the same module.

### Pitfall 5 — Fixing one violation masks another on the same line

**Symptom:** After fixing one pyflakes error and re-running, a **new** violation appears on the same or adjacent line that was not reported before.

**Fix:** Re-read the pyflakes output after each fix batch; do not assume a single run catches everything.

**TELL:** The initial pyflakes run reported fewer violations than expected for a line with multiple issues (e.g., a duplicate import where one copy was also unused).

## Verification

1. **Re-run pyflakes on the same file or directory** — it must produce zero output (exit code 0):

```bash
pyflakes <file_or_dir> && echo "CLEAN" || echo "VIOLATIONS REMAIN"
```

2. **Diff the changes** to confirm no unintended edits:

```bash
git diff <file>
```

3. **If the module has tests**, run them to confirm no behavioral regression — especially important when you removed a variable with a side-effectful RHS or changed a return expression:

```bash
python -m pytest tests/ -k <relevant_test>
```

4. **Restore / clean up** the safety-net backup:

```bash
rm <file>.bak   # if you made a manual copy
# or drop the stash if you no longer need it:
git stash drop  # only after verification passes
```

## Worked examples (real cases)

### Case 1 — Typo in undefined name

**Symptom:** `service.py:11: undefined name 'reuslt'`

**Fix:**
```python
# Before:
print(reuslt)
# After:
print(result)
```

**TELL:** `reuslt` is a scrambled spelling of `result`, which is defined earlier in the same scope.
