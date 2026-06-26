# muscle-memory

**A self-evolving skill foundry for [Letta Code](https://github.com/letta-ai/letta-code).**

![muscle-memory demo](./docs/demo.gif)

> *A fresh agent **fails** a real Letta task (0%) → muscle-memory watches 3 sessions and **distills the lesson live** (real SKILL.md, update-first, evidence manifest) → the **same agent nails it (→100%, +67 pts)** → and it **beat Hermes's own prompt 47 vs 35.** Every number real; the reel runs the actual pipeline. (`docs/demo.gif`)*

muscle-memory watches your agent's real tool-use, then *reflectively distills* it into reusable, **class-level** skills — the same loop Hermes Agent pioneered, rebuilt to exploit the things only Letta has: **cross-conversation recall** and a **searchable, git-versioned memory filesystem (MemFS)**. It observes, distills, curates, and defends — all reversible, gated, and receipted.

> **Benchmarked head-to-head against Hermes's *own* skill-review prompt** (pulled from their source). Authors ran on the same NOUS model; the judge is **GPT-5.x via OpenAI OAuth**. muscle-memory's reviewer scores **Hermes-level on identical evidence (43–44 vs 47, judged `hermes_level=yes`)** and **beats it on output quality + ability when leveraging cross-conversation recall (consistently 47 vs Hermes 35–39)** — the judge attributed Hermes's gap to *"single-conversation depth."* See [`BENCHMARK-REPORT.md`](./BENCHMARK-REPORT.md) + `benchmark-result.json` (carries the real GPT verdict).

## Does it actually make the agent better? (measured, yes)
A skill is only worth distilling if it *improves runtime performance*. So we measured it: an A/B where the agent does Letta-specific pitfall tasks (the `ctx.args` arg pattern, backup-naming, `/reload` semantics) **without** the distilled skill vs **with** it in context, on a real model (`npm run perf`):

| task | baseline | with the distilled skill |
|---|---|---|
| `ctx.args` (Letta-internal) | 0% | **100%** |
| `/reload` needed for new tools | 0% | **100%** |
| backup naming (model already knew) | 100% | 100% (no regression) |
| **first-try correctness (aggregate)** | **33%** | **100% (+67 pts)** |

The skill takes the agent from **33% → 100%** first-try correctness on real knowledge-gap tasks, with **zero regression** on what it already knew. Receipt: `perf-improvement-result.json`.

## Why it's different from Hermes (the substrate, not a better prompt)
| | Hermes | muscle-memory (Letta) |
|---|---|---|
| Evidence | reviews **one** conversation | distills from **cross-conversation** recall (the whole experience log) |
| Dedup / anti-bloat | name-only (`skills_list`) | **content-level via MemFS search** → updates the right skill instead of duplicating |
| What it learns | success-shaped | success **+ outcome-aware failure** (repair chains), with a **negative filter** that refuses env-noise ("command not found", missing binaries) |
| Reversibility | archive | git-backed MemFS — revertable |

## The loop
```
observe (tool_start / tool_end / llm / compact)
   → cross-conversation evidence (real grounded pitfalls, env-noise filtered)
   → retrieve the user's actual preferences from memory (personalized patching)
   → reflective reviewer (forked model authors a CLASS-LEVEL skill)
   → MemFS update-first routing (distinctive-term + dominance gate → patch, don't duplicate)
   → gates: class-level naming · security scan · linter
   → write + EVIDENCE MANIFEST (references/evidence/<ts>.json: sources, memfs hits, prefs, rejected noise, old→new hash, gates)
   → curator (active→stale→archived, pinning, churn-aware) + pre-action failure defenses
```
Every skill it writes is an **evidence-backed git object** — you can see exactly which conversations, MemFS hits, and preferences produced it, and what noise it refused.

## See it work — visible in-flight (like Hermes, Letta-native)
muscle-memory surfaces a compact **self-improvement summary** in the TUI — a panel around the input bar + a `/muscle-memory` dashboard — so you *watch* it distill, not just trust it. (No transcript hacks; only the supported `openPanel` + command APIs. Redacted lifecycle receipts only — never chain-of-thought.)

```
💾 muscle-memory v3 · reflect staged · done
last: updated editing-letta-mods-safely (update-first, 3 sessions/8 signals)
route: UPDATE editing-letta-mods-safely · staged
managed 1 · staged 5 · coverage 3 covered / 1 uncovered
```
And the review ledger (`/muscle-memory events`):
```
💾 muscle-memory review: reviewed 3 sessions / 8 durable signals
💾 muscle-memory review: route UPDATE — editing-letta-mods-safely (high confidence)
💾 muscle-memory review: updated 'editing-letta-mods-safely' · wrote evidence manifest · rejected 2 env-noise items
```
> **Hermes tells you a skill was saved. muscle-memory shows the evidence route — sessions/signals, the create-vs-update decision, rejected noise, and the manifest receipt — live.** Panel is capability-guarded; headless/Desktop falls back to the `/muscle-memory` dashboard.

## Quick start
```bash
letta install muscle-memory      # or drop mods/index.ts into ~/.letta/mods
```
Then, in a session:
- `muscle_memory_skill_read action:reflect_plan` — preview what it would distill (cross-session evidence + update-first routing + confidence), no writes.
- `muscle_memory_skill_read action:coverage` — the skill coverage map (which task-classes are covered / uncovered / over-covered / noise).
- `muscle_memory_skill_write action:reflect` — distill/update a class-level skill now (staged; approval-gated; emits an evidence manifest).
- Autonomous: set `MM_REFLECT=staged` (or `auto`) — the reviewer fires at session end, hands-off. Default **off**.

The generated skills are standard [agentskills.io](https://agentskills.io) `SKILL.md` files written to the agent's MemFS skills dir — loadable by Letta's normal **Skill** tool.

## The 90-second demo
> `npm run money-demo` — muscle-memory watches real tool-use, notices a repeated workflow *and the failure it kept recovering from*, **autonomously distills a SKILL.md** (auto-embedding the error→fix as Pitfalls), which is then **loaded through Letta's normal Skill tool and used to validate the mod itself**. Live receipt: a hidden fork author firing in real tool context.

## Validation
- `npm test` — 10/10 + integration (read no-approval / write approval-gated)
- `npm run hermes:parity` — 44/44 (skill-manager + support files + security + lifecycle + fork autopilot + compatibility)
- `npm run live:defense` — 13/13 (outcome correlation + live-backend event-shape defense)
- `npm run review:test` — 49/49 (negative filter, naming gate, cross-conversation evidence, hardened MemFS update-first routing + regression, autonomous reflective review, evidence manifests, coverage map, persona retrieval, churn lifecycle)
- `npm run review:live` — end-to-end on a real model + real skill library (update-first anti-bloat fires)
- `npm run benchmark` — the head-to-head vs Hermes's exact prompt (needs `NOUS_API_KEY`; judge via OpenAI OAuth)

## Honest scope (no overclaim)
- Pre-action failure defense is **advisory** (logs/warns via receipts) — not a hard block.
- Reflective review + autopilot default to **staged/approval-safe**; full-auto is opt-in (`MM_REFLECT=auto` / `MM_AUTOPILOT=auto`) and budgeted.
- **No hard deletes** — retire/remove are reversible quarantine; `restore` brings them back.
- **No private dependencies** — self-contained; no MESH/agent-specific coupling.
- The cross-conversation surpass is benchmarked + built + validated + demonstrated live; semantic `memfs_search` is keyword-based in-mod here (the QMD embedding backend is unstable on some boxes) — git-native and keyword levers ship today.

MIT. Built for the letta-ai/mods challenge.
