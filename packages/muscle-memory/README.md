# muscle-memory

**Every session becomes practice film.**

Built by **Adrian Chan + Kev**. Mack handled heavyweight validation and package-closing assists.

`muscle-memory` is a Hermes-inspired, Letta-native skill management mod.

It watches a Letta agent's real tool-use, finds reusable procedural lessons, updates existing skills instead of duplicating them, quality-gates drafts, safely stages portable Custom Skills, and prunes stale ones.

**The goal is not just to generate skills — it is to make skill libraries maintain themselves.**

![muscle-memory live demo](./demo.gif)

```txt
agent work → practice film → reusable skills → safer sharing → better future agents
```

The first agent earns the lesson. The next agent inherits it.

---

## What the real logs taught us

We dogfooded `muscle-memory` against a real 503-event Letta Code log from actual coding sessions.

The useful finding: Letta gives us enough event tape to build a richer learning layer on top of the harness.

In that log, many important coding lessons happened around shell/test runs — failed tests, broken builds, bad commands, then source edits and verification reruns. Those recoveries are easy for humans to see in the sequence, but they are not always represented as a tidy, already-labeled `tool_end` outcome.

So `muscle-memory` adds behavioral repair-chain inference:

```txt
verify command fails
→ source edit happens
→ same verify command passes
= reusable recovery pattern
```

On the real log, that recovered structure like:

```txt
18 inferred failures → 5 repair chains → 5 defensive lessons
```

The point is collaborative: Letta provides the raw game film; `muscle-memory` turns more of that film into coachable tape.

That is the product gap this mod explores.

---

## How it works — the brain's memory loop (Complementary Learning Systems)

Most agent-memory work focuses on hygiene after capture: forget, dedupe, rank, retrieve. `muscle-memory` adds a complementary layer for procedural skills: decide which traces should survive, when stored skills should change, and what deserves replay.

| brain mechanism | muscle-memory | why it matters |
|---|---|---|
| **prediction-error-gated reconsolidation** | a *used* skill goes labile + is re-authored the moment its own prediction fails | fake-green prevention: a stale skill gets corrected, not appended-beside |
| **synaptic tagging & capture** | a weak one-shot lesson is *rescued* if a salient event fires near it in time | fixes the false-negative that frequency-thresholds cause |
| **reward-weighted prioritized replay** | sleep-time replays *salience-ranked*, *reverse from the win* (credit assignment), *interleaved* old+new | the right skills get rehearsed; anti-catastrophic-forgetting |

Mapped onto Letta's own machinery: `experience.jsonl` as fast, decaying experience tape; `SKILL.md` as stable procedural memory; sleep-time/idling as consolidation; and permission hooks as optional defenses. The important bit is practical, not mystical: real execution traces can become better reusable procedures.

### Compounds truly
An UPDATE never destroys a proven skill: ambiguous overlap **refuses** an autonomous create (anti-bloat), the model is shown the existing skill and told to **patch, not rewrite**, frontmatter provenance is **preserved**, and a section-level diff makes any destructive rewrite reviewable. Reconsolidation routes a contradicted skill as a *labile UPDATE* — so re-learning **strengthens** the skill instead of spawning a sibling.

### Learns the lesson, not the command
Real agent work is *varied* — the same literal command rarely recurs across sessions, so a per-command memory learns almost nothing. muscle-memory **generalizes**: a recovery seen as `python3` fails → edit → re-run **and** `node` fails → edit → re-run is the *same shape*, so they merge into ONE mature, cross-language skill — `recovering-from-failing-script-runs` ("re-run, read the error, edit the source, re-run — regardless of language"). The brain generalizes from instances; so does this. It's how the mod learns high-value skills from realistic, non-repetitive work where a literal-match system stays empty.

### Selective — a lean, high-signal library beats a bloated one
Most tool-use is noise: `ls`, `cat`, the universal edit→run loop. muscle-memory **refuses** to distill it — shell-noise templates and trivial primitive-pair sequences never become skills. What graduates carries a real, non-obvious lesson (a recovery, a gotcha, a distinctive ritual). The agent's skill shelf stays small and every entry earns its context.

### Reliable & safe by construction
- **Deterministic-first, headless-safe**: the skill always ships synchronously even if the process exits right after; model-authored richer skills are a best-effort upgrade on top.
- **No freeze**: every UI phase is finite + a stalled model stream is bounded (60s) + stale phases self-heal on reload. (Fixes a real hour-long "✍️ writing skill…" freeze.)
- **Enforced defenses**: a recurring, never-recovered failure becomes a real `permissions` ask/deny *before* the tool runs — not an advisory note.
- **Never persists secrets**: redaction is allow-listed; it learns *legal tendencies* (flags, modes, recurring fixes), never credentials.

---

## Receipts (all reproducible — `npm run verify`)

| check | result |
|---|---|
| Unit tests (7 files across core/detect/gate/publish/engram/autopilot/ui) | **41/41 pass** |
| Ablation bench (5 axes) | ENGRAM beats the v4 baseline on every tested axis |
| Held-out predictive eval, 150 seeds, realistic Bash-heavy corpus | ≈94% of *learnable* held-out failures pre-empted; inference precision/recall 100%/100% on labeled ground truth |
| Real 503-event Letta log | behavioral inference recovered 18 failures → 5 repair chains → 5 defensive lessons from ordinary tool-use tape |
| Full skill lifecycle (deterministic demo, no model) | creation → graduation → use → refine → prune verified end-to-end (`npm run demo`) |
| Live dogfood library | update-first routing, pruning, publish preflight, and cross-shelf duplicate detection exercised on real agent skills |
| Generalized distillation, varied real work (python/node/go + ls/cat/git noise) | **one** high-value `recovering-from-failing-script-runs`; **all noise rejected** |
| Live causal A/B (real agent, answer not in the code) | warm **3.0 tool-calls** vs cold **7.3** → **~2.4× fewer steps**, both succeed |

**Honest scope.** The held-out and real-log numbers are real and reproducible. The baseline comparison is scoped to outcome-labeled events vs behavioral inference on this log. The live A/B measures *learning-quality* (steps/tool-calls), not an end-task win-rate; a success-rate causal win is bounded by the secret-redaction invariant (the mod correctly refuses to memorize the unobtainable value). Nothing here asks you to trust vibes over receipts.

---

## Install

```bash
letta install <this-package>      # or add to your Letta mods dir
letta /reload
```

Then just work. It captures your tool-use, and at sleep-time / session-close it consolidates. Defaults are conservative and reversible.

### Modes (env)
- `MM_AUTOPILOT=auto` — autonomously graduate *verified* repairs (default: stage for one-tap review).
- `MM_REFLECT=auto|staged|off` — model-authored class-level skills at idle (default off; deterministic capture always runs).
- `MM_CAPTURE=context|worked|off` — opt-in concreteness: capture **redacted** worked-examples (real error message; `worked` also adds the fix diff) so distilled skills carry concrete symptom→fix illustrations and DIVERSE failures of one class stay distinct instead of collapsing to a single fingerprint (default off = pure privacy-by-fingerprint; credentials/paths are always scrubbed at capture and the skill body is re-scanned before any write).
- `MM_GUARD=ask|deny|off` — enforce learned anti-patterns as `permissions` before execution (default off).
- `MM_NATIVE=blocks,passages` — project the consolidated skill index into the agent's core memory + archival (opt-in).
- `MM_PUBLISH=auto` — promote graduated skills to the shared shelf (`~/.letta/skills`) so they appear under the app's **Custom Skills**, reusable by every agent (default off — graduation is agent-scoped; publishing is a deliberate promotion).

> **Where a skill lives:** *staged* (pending) → *graduated* into the **agent's own** MemFS skills (that agent reuses it immediately) → *published* to the shared shelf under **Custom Skills** (reusable for all). `MM_PUBLISH=auto` (or the `publish` action / 1-tap) does the last hop.

### Commands
- `/muscle-memory lifecycle` — the whole cycle at a glance: staged → active (earning) → idle (prune candidates) → retired
- `/muscle-memory audit` — **SOTA quality audit** of your whole skill library: which are top-tier vs need upgrading, and why (concreteness / diagnostic TELLs / safe-first / generality)
- `/muscle-memory publish <skill>` — **publishability preflight** (read-only): score 0-100, tier (`agent-local` / `team-shareable` / `marketplace-candidate` / `blocked`), what to sanitize, duplicate-skill warnings
- `/muscle-memory publish stage <skill>` — write a **sanitized** review copy (identifiers→placeholders, mechanism preserved) + provenance metadata to `$MM_STATE_DIR/publish-staged/`
- `/muscle-memory publish approve <skill>` — publish the staged copy to shared **Custom Skills** (`~/.letta/skills/`); re-preflights + hard-blocks injected secrets; prints a visibility receipt
- `/muscle-memory engram` — the consolidation plan (salience-ranked replay + reconsolidation flags), read-only
- `/muscle-memory coverage` — which task-classes have a defending skill
- `/muscle-memory staged` — skills waiting for one-tap graduation
- `/muscle-memory events` — recent captured tool-use

### The skill supply chain (what makes this more than a distiller)
`learn → quality-gate → graduate → auto-preflight → stage (sanitized) → approve → shared Custom Skill → reuse → retire`. A graduated skill is agent-specific scar tissue; muscle-memory scores its **publishability**, **sanitizes identifiers** (never the mechanism/worked-examples), and promotes the good ones to portable Custom Skills other agents reuse — gated, reversible, never auto-published. See [`PUBLISH-PREFLIGHT-SPEC.md`](./PUBLISH-PREFLIGHT-SPEC.md).

## Verify it yourself

```bash
npm run verify   # transpile + 41 unit tests + 5-axis bench + 150-seed eval + full-lifecycle demo
```

No runtime dependencies beyond Node builtins. MIT.

## Project structure

A layered, single-responsibility module tree (`core ← detect ← gate/publish/engram/lifecycle ← autopilot ← index`):

```
mods/
  core.ts        paths · redaction · hashing · io · skill-file helpers · content scan · ui-events · mesh
  detect.ts      fingerprints · templates · sequences · repair-chains · outcome inference · evidence
  gate.ts        SOTA quality gate · library audit · cross-shelf dedup · draft authoring
  publish.ts     the publish supply chain (preflight → stage → approve → visibility) + catalog
  engram.ts      the CLS loop — prioritized replay · reconsolidation · defenses · neocortex bridge
  lifecycle.ts   registry · curation · usage tracking · coverage · pruning · telemetry
  autopilot.ts   autopilot · update-first routing · reviewAndAuthor · the autonomous reflect loop
  ui.ts          the live panel renderer
  index.ts       the mod entry: activate(), event handlers, command dispatch, tool registration
```

The package ships the source modules (the Letta CLI bundles them on load); the public API is the mod
entry plus a `__mm` test surface.
