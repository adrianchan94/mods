# Effectiveness: does a distilled skill dramatically improve a fresh agent?

A controlled **knowledge-gap** A/B. `gizmo.py` is a small store with three COUNTERINTUITIVE behaviors a
fresh model cannot know from training (buffered writes need `commit()`; `fetch()` returns a `Box` you
must `.unwrap()`; a missing key *raises*). `gizmo-skill.md` is the kind of skill muscle-memory distils,
documenting those gotchas with diagnostic TELLs. `gap-ab.mjs` runs a fresh **GLM-5.2** one-shot on 6 tasks,
BASELINE (signatures only) vs WITH-SKILL, and scores by **actually running** the model's `solve(g)`.

## Result (GLM-5.2, stable across runs)

```
baseline (no skill):  2/6 (33%)   — model guesses the obvious usage; the gotchas defeat it
with the skill:       6/6 (100%)  — the skill supplies the exact missing knowledge
lift: +67 pts
```

## Two honest findings

1. **Skills lift where there's a real knowledge gap, not on generic tasks.** On common Python bugs GLM-5.2
   already scores 100% — a skill can't improve what the model already knows. The dramatic lift appears
   precisely where the agent has accumulated knowledge the model lacks (internal/project/scar-tissue).
   This is muscle-memory's lane: continual learning, not re-teaching the base model.
2. **Skill PRECISION matters.** A first draft over-emphasised "`fetch()` returns a Box → `.unwrap()`", and
   the model over-generalised it to `fetch_or` (which returns the value directly) → a regression. Making
   the skill precise (a distinct pitfall for the `fetch_or` case) flipped it to a clean 100%. This is
   exactly what the SOTA quality gate guards against.
