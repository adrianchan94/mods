# The LIVE cut — real Letta TUI, real GLM-5.2 agent

`story-live.gif` / `story-live.cast` is a **real recording of the Letta TUI**: a fresh GLM-5.2 agent,
no scripting of its output. This is the viral asset; the deterministic `npm run demo:story` harness one
level up is the reproducible *receipt*.

What actually happened on camera (see `transcript.txt`):
1. **Rookie gets cooked** — agent runs `pytest` on `./checkout`, hits an `IndexError`, diagnoses
   *"classic off-by-one,"* edits the SOURCE (`range(len(x)+1)` → `range(len(x))`), re-runs → green.
2. **The L becomes film** — `💾 muscle-memory · graduated 'debugging-failing-tests' (new, 4 sessions/2 signals)`
   fires **autonomously, unprompted** (MM_REFLECT=auto). The agent never asked for a skill.
3. **New rookie inherits** — a new failure in `./cart`. The agent runs `Launching skill: debugging-failing-tests`,
   cites *"Textbook Pitfall #2 — float truncation,"* fixes `int(d*100)` → `round(d*100)`, pytest green.

Recorded via `record-story.sh` (tmux + asciinema, isolated `MM_STATE_DIR`/local backend; never touches the
real shelf). Rough cut — final viral edit/captions are Kev/Adrian's.
