---
name: pyflakes-fix-and-verify
description: Iterative cycle for resolving Python lint errors reported by pyflakes — run pyflakes, apply targeted fix, re-run pyflakes to confirm clean before moving on. Triggers: pyflakes reports errors, Python file was just edited, debugging service.py or other Python modules.
---

## When to use

- After editing a Python file (especially `service.py`) and before committing or moving on.
- When pyflakes or any similar linter reports undefined names, unused imports, or syntax issues.
- When a Python module fails at runtime and you need to catch obvious errors fast.

## Procedure

1. **Run pyflakes on the target file.**
   ```
   pyflakes service.py
   ```

2. **Read every reported error** before touching code. Group them: syntax errors first (they may cascade), then undefined names, then unused imports.

3. **Fix the root cause, not the symptom.**
   - `undefined name 'X'` — check whether it's a typo of an existing name, a missing import, or a genuinely unimplemented function. Add the correct import or fix the spelling; do not stub it.
   - `local variable assigned but never used` — remove the dead line or actually use the variable.
   - `imported module unused` — remove the import line.
   - `duplicate function argument` / syntax errors — fix the syntax, then expect cascade errors to disappear.

4. **Re-run pyflakes on the same file immediately.**
   ```
   pyflakes service.py
   ```
   Do NOT assume the first edit resolved everything. If new or different errors appear, repeat from step 3.

5. **Confirm a clean run** (empty output = pass) before considering the file done.

## Pitfalls

- **Symptom: you fix one error, assume the file is clean, and the next tool fails on a remaining error.**
  Fix: Always re-run pyflakes after every edit batch. One `pyflakes` invocation only tells you about the *current* state, not whether your edit worked.

- **Symptom: pyflakes reports many errors on the same line or nearby lines, and you fix them one at a time.**
  Fix: Look for a single root cause (often a syntax error or a missing import). Fix that first, re-run — multiple cascade errors often disappear together.

- **Symptom: you "fix" an undefined-name error by adding a stub or placeholder, and pyflakes goes quiet but the code is now wrong.**
  Fix: `undefined name` means the name doesn't exist in scope. Resolve it with a real import, a correct variable reference, or a real function — never a no-op stub just to silence the linter.

- **Symptom: you remove an "unused import" but it was needed at runtime via dynamic use (getattr, plugin loading).**
  Fix: Search the file for any string-based or indirect references before deleting. If uncertain, keep the import and add `# noqa` with a comment explaining the dynamic use.

## Verification

- Final `pyflakes service.py` produces **zero output** (no errors, no warnings).
- If the file is an entry point or service, run it once to confirm no import-time crash:
  ```
  python -c "import service"
