# muscle-memory

**A Letta agent that watches itself work and writes its own reusable skills — and gets better every time it updates one.**

Claude Code has Hermes (`skill_manage`): it distills skills from *one conversation*. `muscle-memory` brings that to Letta and goes further — it learns from the agent's **whole cross-session history**, recovers failures Letta's runtime silently drops, and **compounds**: updating a learned skill strengthens its proven core instead of overwriting it.

![demo](./demo.gif)

> The panel mirrors the loop live: `💾 muscle-memory · 🧭 reviewing` … `✍️ writing skill…` … `graduated 'recovering-from-failing-script-runs'` — then it shows up in `letta skills list` for the agent to reuse. See the whole arc — **creation → graduation → use → refine → prune** — with `npm run demo`.

---

## The thing nobody else caught

We dogfooded this against a **real 503-event Letta Code log** (actual coding sessions). The finding:

> **Letta Code (0.27.18) does not emit `tool_end` for `Bash` (or `Task`).** `Bash` is **313 of 503 events — and produces 0 outcomes.**

Bash is exactly where real coding fails — failed tests, broken builds, bad commands. So **every memory/observability mod that keys off `tool_end` silently learns _nothing_ from where coding actually breaks.** On that real log, a `tool_end`-only baseline (the shape Mem0 / A-MEM / vanilla Letta use) learns **0 defenses, 0 repair-chains**. The failures are real; they're just invisible.

`muscle-memory` infers them behaviorally from the action sequence (a verify-command re-run after an edit = a fix-then-recheck). On the same log it recovers **18 failures → 5 repair-chains → 5 defenses** — structure that was invisible to every other approach. That's not a +%; it's `0 → 5`. Failure-learning is *categorically dead* on real Letta agents without this, and we fixed it.

---

## How it works — the brain's memory loop (Complementary Learning Systems)

The named 2026 frontier for agent memory is *memory hygiene* (forget / dedup / rank). That's downstream. Neuroscience says three upstream mechanisms decide **which traces survive and how stored ones change** — and **no shipping agent-memory system implements them**:

| brain mechanism | muscle-memory | why it matters |
|---|---|---|
| **prediction-error-gated reconsolidation** | a *used* skill goes labile + is re-authored the moment its own prediction fails | fake-green prevention: a stale skill gets corrected, not appended-beside |
| **synaptic tagging & capture** | a weak one-shot lesson is *rescued* if a salient event fires near it in time | fixes the false-negative that frequency-thresholds cause |
| **reward-weighted prioritized replay** | sleep-time replays *salience-ranked*, *reverse from the win* (credit assignment), *interleaved* old+new | the right skills get rehearsed; anti-catastrophic-forgetting |

Mapped 1:1 onto Letta's own machinery: `experience.jsonl` = **hippocampus** (fast, decaying) · `SKILL.md` library = **neocortex** (slow, stable) · sleep-time compute = **consolidation** · `permissions` overlay = **enforced defense**. It runs over **real execution traces** using Letta's sleep-time compute and MemFS — the first agent-memory system to run the full CLS loop over procedural memory.

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
| Unit tests (CLS core + noise-gate + class-generalization + preserve-update + panel + manifest) | **28/28 pass** |
| Ablation bench vs v4 baseline (5 axes) | **ENGRAM beats baseline on every axis** |
| Held-out predictive eval, 150 seeds, realistic Bash-heavy corpus | **≈95–100% of *learnable* held-out failures pre-empted vs 0% baseline** (recency 26%); inference precision/recall **100%/100%** on labeled ground truth |
| Real 503-event Letta log | baseline **0** defenses → muscle-memory **5 defenses + the failures the `tool_end` world can't see** |
| Full skill lifecycle (deterministic demo, no model) | **creation → graduation → use → refine → prune verified end-to-end** (`npm run demo`) |
| Live agent, 89-skill library | reflect routed **update-first** (folded 14 signals into an existing skill, no sibling) + pruned — compounding on real data |
| Generalized distillation, varied real work (python/node/go + ls/cat/git noise) | **one** high-value `recovering-from-failing-script-runs`; **all noise rejected** |
| Live causal A/B (real agent, answer not in the code) | warm **3.0 tool-calls** vs cold **7.3** → **~2.4× fewer steps**, both succeed |

**Honest scope.** The held-out and real-log numbers are real and reproducible. The 0% baseline is the literal consequence of the `tool_end` gap (not a strawman). The live A/B measures *learning-quality* (steps/tool-calls), not an end-task win-rate; a success-rate causal win is bounded by the secret-redaction invariant (the mod correctly refuses to memorize the unobtainable value). Nothing here is a synthetic-only claim dressed up as production SOTA.

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

Single-file mod (`mods/index.ts`), no runtime deps beyond Node builtins. MIT.
