# muscle-memory

**Every session becomes practice film.**

Built by **Adrian with Kev (Constellation agent) and Mack (local Letta agent).**

`muscle-memory` is a Hermes-inspired, Letta-native skill management mod.

It watches a Letta agent's real tool-use, finds reusable procedural lessons, updates existing skills instead of duplicating them, quality-gates drafts, safely stages portable Custom Skills, and prunes stale ones.

**The goal is not just to generate skills — it is to make skill libraries maintain themselves.**

![muscle-memory live demo](./demo.gif)

```txt
work → tape → lesson → skill → Custom Skill → better future agent
```

The first agent earns the lesson. The next agent inherits it.

---

## Why we built this

We are big fans of Letta's direction: persistent agents, MemFS, Skills, Custom Skills, and Mods give agents a real substrate for long-term improvement.

We also liked a core idea from Hermes Agent: skill distillation from agent experience. That felt too important to leave outside the Letta ecosystem.

So `muscle-memory` is our attempt to bring that idea into Letta in a native way — not as a replacement for Letta's primitives, but as a layer that helps them compound.

Letta provides the court. `muscle-memory` watches the game film.

---

## The problem

Skills are powerful because they are inspectable, portable, and reusable.

But over time, a skill shelf can turn into a storage unit:

- useful workflows stay buried in chat history
- repeated mistakes keep repeating
- duplicate skills pile up
- local scar tissue is too private to share
- stale skills keep pretending they still know ball
- humans end up manually writing, merging, sanitizing, and pruning everything

That is not a learning loop. That is a junk drawer with markdown.

`muscle-memory` adds **Skill Ops**: the lifecycle around learned skills.

---

## What it does

```txt
observe real tool-use
→ detect repeated workflows and recoveries
→ distill or update a skill
→ quality-gate the draft
→ graduate useful skills
→ preflight for sharing
→ stage a sanitized Custom Skill
→ approve publish
→ emit an honest visibility receipt
→ prune stale or duplicate skills
```

Not every rep becomes a skill.

Sometimes the best status is:

```txt
💾 muscle-memory · nothing to save
```

That is the point. Self-improvement needs taste, not just storage.

---

## The film room

While the agent works, `muscle-memory` watches the actual possession:

```txt
💾 muscle-memory · auto · watching
```

It tracks things like:

- test/build failures
- source edits
- verification reruns
- repeated recovery shapes
- tool sequences that actually matter
- staged, graduated, retired, and published skills

Example dashboard:

```txt
💾 muscle-memory · reflect staged
2567 reps observed
9 managed · 1 staged

squad distillations:
  kev   graduated running-recorded-agent-demos-safely
  mack  published my-cloud-audit
  demo  graduated debugging-failing-tests
```

That is the agent's practice film.

---

## Learns lessons, not commands

Real work is messy. The same literal command rarely repeats perfectly.

`muscle-memory` looks for the reusable shape:

```txt
python test fails → source edit → python test passes
node test fails   → source edit → node test passes
go test fails     → source edit → go test passes
```

Those can become one durable skill:

```txt
debugging-failing-tests
```

Bad skill:

```txt
when command X fails, do exact command Y
```

Good skill:

```txt
when a verification command fails, read the failure, fix the source, rerun the same command, and do not patch the test unless the test is genuinely wrong
```

The lesson is the pattern, not the keystrokes.

---

## Update-first, because skill bloat is real

Most generators create first and ask questions later.

`muscle-memory` searches the existing shelf first. If a skill already covers the territory, it updates that skill instead of spawning a sibling.

It also audits cross-shelf drift, so the same skill cannot quietly diverge between an agent-local shelf and the global Custom Skills shelf.

```txt
improve the library, don't grow a landfill
```

The roster has cuts.

---

## Quality gate before graduation

A skill has to earn its context.

Before graduation, drafts are checked for:

- concrete symptoms
- mechanism, not vibes
- safe-first procedure
- pitfalls
- verification
- reusable scope
- no destructive shortcuts
- no hollow checklist prose

Example:

```txt
SOTA quality gate: PASS
- concrete symptoms ✅
- safe-first procedure ✅
- verification ✅
- pitfalls ✅
```

Thin skills do not get a jersey.

---

## ENGRAM: choosing what tape is worth replaying

`muscle-memory` is not just a frequency counter.

ENGRAM is the consolidation layer: deterministic heuristics that decide which experiences deserve replay, which one-shot lessons should be rescued, and which existing skills need updating because reality contradicted them.

It includes:

- **prediction-error reconsolidation** — when a skill's expectation fails, update the proven playbook instead of adding a random sibling
- **synaptic tagging/capture** — rescue rare but important one-shot lessons near high-salience failures
- **prioritized replay** — spend reflection on the most useful tape first

Plain English:

```txt
watch the possessions that actually change tomorrow's game
```


---

## How it works — the brain's memory loop

Most agent-memory work focuses on hygiene after capture: forget, dedupe, rank, retrieve. `muscle-memory` adds a complementary layer for procedural skills: decide which traces should survive, when stored skills should change, and what deserves replay.

| brain mechanism | muscle-memory | why it matters |
|---|---|---|
| **prediction-error-gated reconsolidation** | a used skill goes labile + is re-authored when its own prediction fails | fake-green prevention: a stale skill gets corrected, not duplicated |
| **synaptic tagging & capture** | a weak one-shot lesson is rescued if a salient event fires near it in time | fixes the false-negative that frequency thresholds cause |
| **reward-weighted prioritized replay** | sleep-time replays salience-ranked, reverse from the win, interleaved old+new | the right skills get rehearsed; less catastrophic forgetting |

Mapped onto Letta's own machinery: `experience.jsonl` as fast, decaying experience tape; `SKILL.md` as stable procedural memory; sleep-time/idling as consolidation; and permission hooks as optional defenses. The important bit is practical, not mystical: real execution traces can become better reusable procedures.

---

## From local scar tissue to Custom Skill

A local skill often contains fingerprints:

```txt
/Users/adrian/project
agent-71b0883e...
ZAI_API_KEY
private project names
```

A shared Custom Skill needs to keep the lesson but lose the private residue.

`muscle-memory` adds a gated publish flow:

```txt
graduate
→ auto-preflight
→ stage sanitized copy
→ approve publish
→ visibility receipt
```

Example sanitization:

```txt
/Users/adrian/project      → <local path>
agent-71b0883e...          → <agent id>
ZAI_API_KEY                → PROVIDER_API_KEY
private project names      → <project>
```

The lesson survives. The fingerprints don't.

---

## Honest visibility receipts

Publishing is not just "file written."

When a skill is visible in the live agent-scoped skill index:

```txt
✓ confirmed live
```

When a Custom Skill was written to the global shelf but the current session has not refreshed:

```txt
on disk — /reload to surface
```

No fake readiness claims. No victory lap before the replay confirms it.

---

## Install

Before upstream npm publication, install from GitHub:

```bash
letta install git:github.com/adrianchan94/muscle-memory
/reload
```

If accepted into the official Letta mods catalog, the intended install path is:

```bash
letta install npm:@letta-ai/muscle-memory
/reload
```

---

## Quick start

Conservative staged mode:

```bash
MM_REFLECT=staged MM_AGENT=demo letta
```

Automatic demo mode:

```bash
MM_REFLECT=auto MM_AGENT=demo letta
```

Optional worked-example capture:

```bash
MM_CAPTURE=context
# or
MM_CAPTURE=worked
```

Recommended defaults:

```bash
MM_REFLECT=staged
MM_CAPTURE=off
MM_PUBLISH=off
```

---

## Commands

```txt
/muscle-memory
```

Dashboard: mode, recent events, managed skills, squad distillations, observed reps, and top repeated patterns.

```txt
/muscle-memory lifecycle
```

Full lifecycle view: staged → active → idle/prune candidates → retired. `skills` is an alias of `lifecycle`.

```txt
/muscle-memory engram
```

Read-only consolidation plan: salience-ranked replay and reconsolidation flags.

```txt
/muscle-memory events
/muscle-memory squad
/muscle-memory staged
/muscle-memory coverage
/muscle-memory audit
```

Audit checks quality gaps, stale skills, duplicate coverage, and cross-shelf divergence.

```txt
/muscle-memory publish <skill>
/muscle-memory publish stage <skill>
/muscle-memory publish approve <skill>
```

Read-only preflight → sanitized staged copy → approved shared Custom Skill.

---

## Agent-callable tools

```txt
muscle_memory_skill_read
muscle_memory_skill_write
muscle_memory_lifecycle_run
```

Read-only inspection, approval-gated skill writes, and safe lifecycle operations.

---

## Environment variables

```txt
MM_REFLECT=off|staged|auto
MM_CAPTURE=off|context|worked
MM_AGENT=<name>
MM_AUTOPILOT=staged|auto
MM_PUBLISH=off|auto
MM_STATE_DIR=<path>
```

`MM_PUBLISH=auto` is explicit opt-in. Default publishing is off, and auto-publish still runs privacy/lint gates.

---

## Safety model

`muscle-memory` is intentionally conservative.

It does **not**:

- auto-publish by default
- silently install new mods
- claim global Custom Skill visibility without checking what the current session can see
- preserve raw secrets in skills
- treat every repeated command as skill-worthy
- overwrite good existing skills without review
- implement the future router over memory/tools/guards/mods

It does:

- stage review-worthy changes
- update existing skills before creating duplicates
- hard-block secret-shaped values during publishing
- sanitize private identifiers before sharing
- emit lifecycle receipts
- keep artifacts inspectable and git-backed
- tell you when `/reload` is needed instead of pretending live visibility

---

## Hermes-inspired, Letta-native

Hermes Agent has a great skill-distillation idea: agent experience can become reusable procedural memory.

We wanted that pattern inside Letta, because Letta already has the primitives that make it feel native: MemFS, Skills, Custom Skills, Mods, tool events, and long-lived agents.

`muscle-memory` focuses on the lifecycle around that idea:

```txt
distill
update
quality-gate
graduate
preflight
stage
publish
confirm
prune
```

The point is not to replace Hermes.

The point is to bring a skill-distillation workflow into Letta's own ecosystem and make it play nicely with Letta's strengths.

For deeper benchmark notes, see [`HERMES-COMPARISON.md`](./HERMES-COMPARISON.md).

---

## Validation

```bash
npm run verify
```

Current gate:

```txt
41 pass
0 fail
LIFECYCLE VERIFIED
```

Covers:

- 9-module bundle/transpile
- 7-file unit suite
- ENGRAM benchmark
- held-out eval
- deterministic lifecycle demo
- publish supply chain
- cross-shelf duplicate detection
- secret/publish hard blocks

Package hygiene:

```txt
0 runtime dependencies
Node >=20
lean npm pack (~359KB unpacked)
hero GIF excluded from npm tarball
```

---

## Project structure

```txt
mods/core.ts        shared primitives, redaction, state helpers
mods/detect.ts      outcome inference, repair-chain detection, worthiness filters
mods/engram.ts      consolidation/replay/reconsolidation mechanics
mods/gate.ts        quality gates, audit, cross-shelf duplicate checks
mods/publish.ts     publishability, sanitization, staged approve flow
mods/lifecycle.ts   registry, graduation, retirement, visibility helpers
mods/autopilot.ts   reflection routing, update-first policy, evidence manifests
mods/ui.ts          panel rendering
mods/index.ts       Letta mod entrypoint: tools, commands, events, activation
```

---

## Receipts

All reproducible from source:

```txt
npm run verify
npm pack --dry-run
```

Recent gates:

```txt
41/41 tests passing
bundle builds from 9 modules
pack scanner clean
0 runtime dependencies
Custom Skill publish flow tested
cross-shelf duplicate audit tested
live TUI demo recorded from a real Letta session
```

The benchmark docs are receipts, not marketing commandments. The product pitch is simpler:

```txt
Letta gives agents durable memory and skills.
muscle-memory helps keep those skills learning, clean, and shareable.
```

---

## Limitations

`muscle-memory` is not a magic recursive self-improvement engine.

It is a bounded, inspectable skill lifecycle mod.

Known boundaries:

- full improvement router is roadmap, not shipped
- global Custom Skills may require `/reload` before the current session sees them
- live model A/B receipts are separate from deterministic demo scoreboards
- publishability is for shared Custom Skills, not automatic external marketplace submission
- quality gates reduce bad skills but do not replace human judgment for high-stakes workflows

---

## Roadmap

Near-term:

- fresh-agent reuse receipts across more task classes
- cleaner Custom Skill publish review UX
- dashboard empty-state polish

Future:

```txt
skill vs memory vs guard vs tool vs eval vs mod vs prune
```

For now, the shipped product stays skill-centered and safe.

---

## Source of truth

Standalone public install repo:

```txt
https://github.com/adrianchan94/muscle-memory
```

Canonical Letta Mods submission branch:

```txt
https://github.com/adrianchan94/mods/tree/mm-v4-ace/packages/muscle-memory
```

Until the package is accepted upstream, the fork branch is the integration source of truth.

---

## The thesis

Manual skill management does not scale.

Agents should not need humans to notice every repeated workflow, write every skill, merge every duplicate, sanitize every shared lesson, and prune every stale playbook.

`muscle-memory` turns lived agent work into a maintained skill library.

```txt
work → lesson → skill → Custom Skill → better future agent
```

Every session becomes practice film.
