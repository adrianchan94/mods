# muscle-memory

**A self-evolving skill foundry for [Letta Code](https://github.com/letta-ai/letta-code).**

![muscle-memory demo](./docs/demo.gif)

> *muscle-memory **distills a class-level skill from your whole history, live** (the real SKILL.md, written on screen) — Hermes's self-improvement function, **but better**: cross-conversation recall, MemFS update-first (patch, don't duplicate), evidence manifests, env-noise filter. Then proves it: **captures 20/20 hard-won pitfalls vs Hermes's 7/20** and **lifts the agent 33%→100%.** Every number is backed by included receipts; the reel runs the actual pipeline. (`docs/demo.gif`)*

muscle-memory watches your agent's real tool-use, then *reflectively distills* it into reusable, **class-level** skills — the same loop Hermes Agent pioneered, rebuilt to exploit the things only Letta has: **cross-conversation recall** and a **searchable, git-versioned memory filesystem (MemFS)**. It observes, distills, curates, and defends — all reversible, gated, and receipted.

> **Benchmarked head-to-head against Hermes's *own* skill-review prompt** (pulled from their source). Authors ran on the same frontier author model for both sides; the judge is **GPT-5.x via OpenAI OAuth**. The current evidence package shows two no-cap claims: **pitfall coverage crushes Hermes 20/20 vs 7/20 (2.9×)** because muscle-memory sees cross-conversation history, and refined skill quality is **consistently ahead but modest** (~39 vs ~36, with judge variance). See [`FRONTIER-EVIDENCE.md`](./FRONTIER-EVIDENCE.md), `benchmark-multidomain-result.json`, `coverage-benchmark-result.json`, `runtime-crush-result.json`, `perf-improvement-result.json`, and the Kev-domain dogfood receipt `kev-domain-dogfood-result.json`.

## Does it actually make the agent better? (measured, yes)
A skill is only worth distilling if it *improves runtime performance*. So we measured it: an A/B where the agent does Letta-specific pitfall tasks (the `ctx.args` arg pattern, backup-naming, `/reload` semantics) **without** the distilled skill vs **with** it in context, on a real model (`npm run perf`):

| task | baseline | with the distilled skill |
|---|---|---|
| `ctx.args` (Letta-internal) | 0% | **100%** |
| `/reload` needed for new tools | 0% | **100%** |
| backup naming (model already knew) | 100% | 100% (no regression) |
| **first-try correctness (aggregate)** | **33%** | **100% (+67 pts)** |

The skill takes the agent from **33% → 100%** first-try correctness on real knowledge-gap tasks, with **zero regression** on what it already knew. Receipt: `perf-improvement-result.json`.


## Dogfooded on our real operator workflows
This is not just a benchmark harness. During live duo dogfood, Kev ran IM8/Shopify operator work — visual/no-cap receipts, claims-copy triage, and release evidence packaging — and found a real blind spot: high-value one-off receipt tools were not being surfaced to the reflective reviewer.

The fix added a high-signal receipt lane for tools like `visual_receipt`, `im8_claims_lint`, `no_cap_gate_check`, `repo_radar_evidence`, `kev_final_buzzer_gate`, `im8_theme_done_gate`, `im8_product_intel`, and `im8_write_plan`. The package includes a deterministic proof harness:

```bash
npm run dogfood:kev-domain
```

Receipt: `kev-domain-dogfood-result.json` shows the old path would surface **0** durable signals for this Kev workflow, while the upgraded path surfaces **4** (`+4 uplift`) and distills `validating-shopify-visual-claims-with-receipts`. Generated artifact: [`docs/kev-domain-dogfood-skill.md`](./docs/kev-domain-dogfood-skill.md).

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
💾 muscle-memory · reflect staged · done
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
If you install/drop the mod into an already-running Letta Code process, run `/reload` or restart before expecting new event templates/tools to be live. The mod observes future events; hot-loaded old sessions keep their previous handler code.

Then, in a session:
- `muscle_memory_skill_read action:reflect_plan` — preview what it would distill (cross-session evidence + update-first routing + confidence), no writes.
- `muscle_memory_skill_read action:coverage` — the skill coverage map (which task-classes are covered / uncovered / over-covered / noise).
- `muscle_memory_skill_write action:reflect` — distill/update a class-level skill now (staged; approval-gated; emits an evidence manifest).
- Autonomous: set `MM_REFLECT=staged` (or `auto`) — the reviewer fires **on its own after each turn** (a Hermes-style background nudge), *and* at session end. No "make a skill" command — it watches, and the moment a mature cross-session pattern emerges it distills it hands-off. A maturity gate + signature-dedup mean it fires once per newly-matured pattern (never every turn), and an in-flight guard keeps it off the critical path. Default **off**.

The generated skills are standard [agentskills.io](https://agentskills.io) `SKILL.md` files written to the agent's MemFS skills dir — loadable by Letta's normal **Skill** tool.

## The 90-second demo
> `npm run money-demo` — muscle-memory watches real tool-use, notices a repeated workflow *and the failure it kept recovering from*, **autonomously distills a SKILL.md** (auto-embedding the error→fix as Pitfalls), which is then **loaded through Letta's normal Skill tool and used to validate the mod itself**. Live receipt: a hidden fork author firing in real tool context.

## Validation
- `npm test` — 12/12 + integration (read no-approval / write approval-gated)
- `npm run hermes:parity` — 44/44 (skill-manager + support files + security + lifecycle + fork autopilot + compatibility)
- `npm run live:defense` — 14/14 (outcome correlation + live-backend event-shape defense)
- `npm run review:test` — 64/64 (negative filter, naming gate, cross-conversation evidence, hardened MemFS update-first routing + regression, autonomous reflective review, evidence manifests, coverage map, persona retrieval, churn lifecycle, live panel mirror, mesh feed)
- `npm run review:live` — end-to-end on a real model + real skill library (update-first anti-bloat fires)
- `npm run benchmark:coverage` — pitfall coverage benchmark (20/20 vs 7/20 receipt)
- `npm run benchmark:multidomain` — multi-domain quality benchmark (frontier author + GPT judge)
- `npm run runtime:crush` — runtime comparison against Hermes-style skill
- `npm run dogfood:kev-domain` — Kev-domain operator proof (legacy 0 signals → upgraded 4 signals; distills Shopify visual/no-cap receipt skill)
- `npm run package:smoke` — packs + installs the tarball into a throwaway consumer project, then proves the installed mod captures high-signal receipt templates
- `npm run live:reload-proof` — local Kev live-state receipt after `/reload`: verifies high-signal templates + staged UPDATE anti-bloat in the current process
- `npm run scorecard` — generates `HOMERUN-SCORECARD.md` + `homerun-scorecard-result.json` from packaged receipts
- `npm run final:gate` — deterministic final gate + pack/stale/artifact check, writes `final-gate-result.json`
- `npm run benchmark` — legacy head-to-head harness (requires a configured model API key; judge via OpenAI OAuth)

## Honest scope (no overclaim)
- Pre-action failure defense is **advisory** (logs/warns via receipts) — not a hard block.
- Reflective review + autopilot default to **staged/approval-safe**; full-auto is opt-in (`MM_REFLECT=auto` / `MM_AUTOPILOT=auto`) and budgeted.
- **No hard deletes** — retire/remove are reversible quarantine; `restore` brings them back.
- **No private dependencies** — self-contained; no MESH/agent-specific coupling.
- The cross-conversation surpass is benchmarked + built + validated + demonstrated live; semantic `memfs_search` is keyword-based in-mod here (the QMD embedding backend is unstable on some boxes) — git-native and keyword levers ship today.

MIT. Built for the letta-ai/mods challenge.
