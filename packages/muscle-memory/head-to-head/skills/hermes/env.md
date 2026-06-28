---
name: debug-by-env-not-by-edit
description: When a script fails with an env/config guard failure, satisfy the requirement through the environment or inputs — not by editing source code. Use when a program exits with a message naming a missing env var, config file, CLI flag, or argument, especially under a "do not edit run.py"-style constraint.
---

# Debug by environment, not by edit

## When to use
A program fails at startup with a guard check like:
- `FATAL: APP_MODE=prod required`
- `Set DATABASE_URL before running`
- `usage: script.py --config <path>`
- `error: missing required argument: X`

...especially when you are instructed NOT to edit the source.

## Procedure
1. Run the script. Capture stderr and the exit code.
2. READ the error literally — it names the exact requirement (env var, flag, file).
3. If the requirement is ambiguous, read the source (e.g. `read_file run.py`) to see the exact check: the variable name, the comparison value, the accepted values.
4. Satisfy the requirement WITHOUT editing source:
   - Env var: `APP_MODE=prod python3 run.py`
   - Flag: `python3 run.py --config config.yaml`
   - File: create the file it's looking for via `write_file`.
5. Re-run. Confirm the success line prints and exit code is 0.

## Key principle
The error message is a spec. It tells you precisely what the program needs.
The fastest fix is usually to give it what it asked for, not to rewrite the
question. Mutating source to bypass a guard is a last resort, and is forbidden
when the task constrains edits.

## Pitfalls
- Don't guess the required value — read the source to confirm exact strings
  (e.g. `prod` vs `production`, case sensitivity).
- Some guards check multiple conditions; satisfy all of them.
- Env vars set inline (`VAR=x cmd`) only apply to that one invocation — fine for
  a one-shot run, but for repeated runs export them or use a wrapper.
- If the guard is itself a bug (the program should not require it), that's a
  separate decision for the human — flag it, don't silently strip it.

## Verification
After applying the env/input fix, re-run the exact original command form
(`python3 run.py` with the env/flag prepended) and confirm:
- The expected success output prints.
- Exit code is 0.
