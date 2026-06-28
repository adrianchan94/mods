---
name: cleaning-linter-findings-safely
description: How to clear pyflakes/flake8/ruff findings without deleting needed functionality. Triage by category, verify with re-run, never blanket-fix.
---

# Cleaning Linter Findings Safely

Linter output is a checklist, not a command. Each finding needs a category-specific fix; blanket-deleting code is how you lose functionality.

## Workflow

1. **Capture the full report first.** Run the linter, save exit code + output before touching anything.
   ```
   python3 -m pyflakes <file>; echo "EXIT: $?"
   ```
2. **Read the file fully** before fixing — a "useless" variable may be a typo masking real intent.
3. **Triage each finding by category** (table below). Decide the fix, don't guess.
4. **Patch minimally** — smallest diff that resolves the finding.
5. **Re-run the linter.** Target is a clean exit 0. If new findings appear, you introduced something — fix forward.
6. **Sanity-run the code** if there's a runnable entrypoint (`python3 <file>`, pytest). Lint-clean ≠ behavior-correct.

## Triage cheat sheet (pyflakes / flake8 / ruff F-rules)

| Finding pattern | Real cause | Safe fix |
|---|---|---|
| `imported but unused` | Dead import, or used only for side effects (e.g. `import schemas`) | Remove the import. If it's a side-effect import, move it with a `# noqa: F401` and a comment explaining why. |
| `local variable assigned but never used` | Often a **typo downstream** (name misspelled where it's read), sometimes genuinely dead code | Search the scope for a similar name BEFORE deleting. Fix the typo → variable becomes used. Only delete if truly dead. |
| `undefined name` | Typo, missing import, or missing global | Fix the spelling, or add the missing import. Never "fix" by assigning a dummy value — that hides the bug. |
| `redefinition of unused name` | Two imports/defs with same name | Keep the intended one; remove the duplicate or alias it. |
| `star import` (F403) / `unable to detect undefined names` (F405) | `from x import *` | Replace with explicit imports of the names actually used. |
| `line too long` (E501) | Style only | Wrap, don't truncate logic. |

## Rules that prevent regressions

- **Typo before deletion.** "unused variable" + "undefined name" in the same scope = almost always a typo. Fix the spelling, don't delete the assignment.
- **Don't "fix" a NameError by inventing a value.** If a name is undefined, the fix is to make the *intended* name reachable — correct the typo or add the missing import. Adding `result = None` to silence the linter reintroduces the bug.
- **One logical change per patch.** If you fix imports and logic in the same diff, a regression hides more easily.
- **Side-effect imports are real functionality.** SQLAlchemy declarative bases, Pydantic model registration, feature-flag plugins — these look "unused" but must run. Use `# noqa: F401` with a comment, don't delete.
- **Re-run after every patch batch**, not just at the end.

## Quick verification snippet

```bash
# before and after
python3 -m pyflakes service.py && echo "CLEAN" || echo "FINDINGS REMAIN"
```

Exit 0 from the linter is the gate. For behavior, also run the module / test suite if one exists.
