---
name: git-clean-commit
description: Stage and commit files with conventional, verifiable commit messages. Use when the user asks to commit, check in, or save changes to git.
---

# Clean Git Commit Workflow

## When to use
- User asks to "commit", "stage and commit", "check in", or "save changes to git"
- You need to turn untracked/modified files into a clean, reviewed commit

## Steps

1. **Inspect before committing.** Never commit blind. Run in one shot:
   ```
   git status && echo "---DIFF---" && git diff && echo "---UNTRACKED---" && git diff --no-index /dev/null <file> 2>/dev/null
   ```
   For untracked files, read their contents (use `read_file` or `cat`) so the commit message actually reflects what's being added.

2. **Stage only what should be committed.**
   - Single file / explicit set: `git add <file1> <file2>`
   - All tracked changes: `git add -u` (avoids accidentally sweeping in junk untracked files)
   - Avoid `git add -A` / `git add .` unless the user wants everything — it silently sweeps in stray files.

3. **Write a clear commit message.** Good practice:
   - Imperative mood: "Add", "Fix", "Refactor", "Remove" (not "Added" / "Adds")
   - ≤ ~50 chars in the subject line; wrap details in a body if needed (blank line after subject)
   - Prefix with type when the repo uses Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
   - Describe WHY / WHAT changed, not "update file"
   - For the root commit, "Add <thing> with initial content" is fine.

4. **Commit and verify in one command:**
   ```
   git commit -m "<subject>" && echo "---VERIFY---" && git log --oneline -3
   ```
   The `git log --oneline` confirms the commit actually landed with the hash and message you intended.

## Pitfalls
- Committing without inspecting the diff → surprises in history.
- `git add -A` pulling in `.env`, build artifacts, or editor swap files. Check for a `.gitignore`; if none exists, flag it.
- Vague messages ("update", "changes", "wip") — future-you won't remember what they meant.
- Forgetting to verify with `git log` — the commit can silently fail on hooks or pre-commit checks.

## Quick template (single untracked file)
```
git add <file>
git commit -m "Add <file> with <short description>"
git log --oneline -1   # verify
```
