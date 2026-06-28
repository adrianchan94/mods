---
name: static-lint-before-done
description: Use when finishing an edit or declaring a coding task complete. Run a static linter on the changed file(s), fix every reported issue at its root cause, then re-run to confirm a clean pass. Triggers on: post-edit verification, "done", "complete", "ship it", pre-commit check, or any time you want to catch typos, dead code, and undefined names before runtime.
---

## When to use

- After **every** edit to source code, before declaring the task done.
- Before committing or telling the user the change is complete.
- When you suspect a typo, unused import, or dead variable crept in.
- Any language with a fast static checker (`pyflakes`, `flake8`, `ruff`, `eslint`, `tsc --noEmit`, `golangci-lint`, etc.).

## Procedure

1. **Run the linter scoped to the files you changed** — not the whole repo, to avoid noise from pre-existing issues you don't own.
   ```bash
   pyflakes path/to/changed_file.py   # one file
   # or
   ruff check path/to/changed_file.py
   ```

2. **If no output** → the file is clean. You're done.

3. **If output appears, classify and fix by category:**

   | Message pattern | Root-cause fix |
   |---|---|
   | `undefined name 'X'` | **Typo or missing import.** Fix the reference or add the import. This is a runtime `NameError` — always fix, never ignore. |
   | `'X' imported but unused` | **Remove the import line.** Do not suppress. |
   | `local variable 'X' assigned but never used` | **Decide:** if it's dead code, delete the assignment; if you meant to use/return it, wire it in. |
   | `redefinition of unused 'X' from line N` | **Delete the duplicate.** Keep one declaration. |

4. **Re-run the linter** on the same file(s) to confirm zero output.

5. **Only after a clean pass**, declare the task done.

## Pitfalls

1. **Suppressing the warning instead of fixing the cause.**
   *Symptom:* you add `# noqa`, `# type: ignore`, `// eslint-disable-next-line`, or wrap in `try/except` to silence the message.
   *Fix:* never suppress a lint message you introduced. Remove the dead code or fix the typo. Suppression is for pre-existing issues in code you can't refactor.

2. **"Undefined name" dismissed as a false positive.**
   *Symptom:* `pyflakes` says `undefined name 'reuslt'` and you assume it's defined elsewhere.
   *Fix:* it's almost always a **typo** (`reuslt` → `result`). Grep for the exact name to confirm it exists; if not, fix the spelling.

3. **Unused variable is a logic bug, not dead code.**
   *Symptom:* `tmp = compute()` flagged as unused, so you delete it — but `tmp` was supposed to be `return`ed.
   *Fix:* before deleting an unused local, check whether a downstream line should have referenced it. If the value is genuinely throwaway, remove the assignment.

4. **Linting the wrong file or stale buffer.**
   *Symptom:* linter reports clean, but the bug persists at runtime.
   *Fix:* confirm you're linting the exact file you edited, and that the file on disk matches your edit (save before linting).

5. **Fixing one error masks a cascade.**
   *Symptom:* first lint run shows one error; after fixing it, new errors appear.
   *Fix:* always **re-run** after each fix until you get a truly clean pass. One fix at a time, re-lint, repeat.

## Verification

```bash
pyflakes path/to/changed_file.py   # expect: no output, exit code 0
```

Zero output and exit code `0` = clean. Any output = not done yet.
