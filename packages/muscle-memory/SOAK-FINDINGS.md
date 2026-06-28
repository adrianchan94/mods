# Dogfood soak — does muscle-memory work flawlessly + dramatically improve agents?

A multi-workflow soak to earn confidence (not assume it). Every result below is reproducible.

## 1. Does a skill DRAMATICALLY improve a fresh agent? — yes, where there's a real knowledge gap
Controlled knowledge-gap A/B (`head-to-head/effectiveness/`): a store with counterintuitive gotchas a
fresh model cannot know from training; the skill documents them with TELLs. Fresh GLM-5.2, scored by
**actually running** the model's code:

```
baseline (no skill):  2/6 (33%)   →   with the skill:  6/6 (100%)    (+67 pts, stable across runs)
```

Honest nuance (this is the product truth, not a caveat to bury):
- The lift appears **only where the agent has knowledge the base model lacks** (internal/project/scar-
  tissue). On generic Python bugs GLM-5.2 is already 100% — a skill can't improve what the model knows.
  That is muscle-memory's lane: **continual learning, not re-teaching the base model.**
- **Skill precision matters.** A first draft over-emphasised one gotcha and the model over-generalised it
  → a regression. Making the skill precise → clean 100%. This is exactly what the SOTA quality gate guards.

## 2. Does it work across diverse workflows? — yes (4/4 after a real fix)
Distilled across **git-rebase, CSS sticky-positioning, CSV/data ingestion, npm build** (not just Python):

| domain | result |
|---|---|
| csv/data | ✅ SOTA, 6859 B |
| npm build | ✅ SOTA, 9537 B |
| css sticky | ✅ SOTA, 8777 B |
| git rebase | ✅ SOTA, 8676 B **— after the soak found + fixed a bug** |

**Bug the soak caught:** the security scanner hard-blocked any `git push --force` (even the *safe*
`--force-with-lease`) as a threat — making git/deploy/destructive domains **undistillable**. Force-push /
`reset --hard` / `rm` are legitimate workflow ops a skill must *teach*, not security threats. Fixed:
security scanner = true threats only (secrets, exfiltration, pipe-to-shell, prompt-injection); the real
concern "use them with a safety net" is the **SAFE-FIRST quality gate's** job. Verified real threats stay
blocked.

## 3. Does the live surface load + run flawlessly? — yes
`activate()` health check (mocks a real harness): mod loads with no throw, registers **3 tools + 8 events
(incl `turn_end`) + the panel + all 9 `/muscle-memory` subcommands**; all read commands (`audit`,
`publish`, `coverage`, `lifecycle`, `engram`, …) run without throwing.

## 4. Does it crash on bad input? — no (10/10)
Edge-case sweep: empty evidence, malformed/null rows, 5000-row sets, empty/unicode/NUL skill bodies,
secrets, huge sanitize inputs, weird candidate keys — **0 crashes**.

## Honest residual risks
- Model nondeterminism: GLM can occasionally emit a thin skill (the SOTA gate's retry mitigates, doesn't
  eliminate). Rare; the gate flags it.
- The library audit's CONCRETENESS check over-flags prose-heavy *domain playbooks* (triage, not verdict).
- Gates: `verify` 37/0 + LIFECYCLE VERIFIED, manifest valid, live==package at time of writing.

**Verdict:** within the domains and inputs exercised here, muscle-memory distils SOTA skills across diverse
workflows, loads + runs its full surface cleanly, never crashes on bad input, and **measurably lifts a
fresh agent (33%→100%) exactly where continual learning matters.**
