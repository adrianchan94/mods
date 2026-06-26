# muscle-memory dogfood completion audit

Generated: 2026-06-26

## Objective restated as concrete deliverables
Original ask: run a focused dogfood/optimization/upgrade loop that makes muscle-memory a Hermes-agent-killer and proves it upgrades our real work across the board with numbers and receipts.

Concrete success criteria:
1. Dogfood the mod on real work, not only synthetic tests.
2. Find and fix at least one real weakness discovered by dogfood.
3. Produce at least one meaningful skill/artifact that proves it upgrades Kev/Mack workflows.
4. Show numbers against Hermes or legacy behavior.
5. Include receipts in the package, not only in chat.
6. Keep no-cap honesty: do not overclaim visual validation, live UI, auto mode, or PR state.
7. Run deterministic gates after changes.
8. Prepare submission/PR narrative without opening/pushing until Adrian says “ship it.”

## Prompt-to-artifact checklist

| Requirement | Evidence artifact | Verification status |
|---|---|---|
| Dogfood on real work | `DOGFOOD-LOG.md` Shots 4-8 | Done: release packaging, IM8 visual/no-cap, claims lint, high-signal receipt lane, no-cap correction |
| Find/fix real weakness | `mods/index.ts` high-signal receipt lane; `DOGFOOD-LOG.md` Shot 6; staged anti-bloat Shot 12 | Done: rare operator receipt tools were invisible; now surfaced; staged update-first now sees/consolidates staged candidates |
| Kev-specific proof | `scripts/kev-domain-dogfood.mjs`; `kev-domain-dogfood-result.json`; `docs/kev-domain-dogfood-skill.md` | Done: legacy 0 signals → upgraded 4 signals; generated `validating-shopify-visual-claims-with-receipts` |
| Mack/self-referential proof | `DOGFOOD-LOG.md` earlier Shot 1 notes; existing staged/graduated validation skill referenced in log | Done per dogfood log; not re-run in this Kev slice |
| Hermes/benchmark numbers | `FRONTIER-EVIDENCE.md`; `coverage-benchmark-result.json`; `perf-improvement-result.json`; `benchmark-multidomain-result.json`; `runtime-crush-result.json` | Done: 20/20 vs 7/20 coverage, 33%→100% runtime lift, stable skill-quality win framed honestly |
| Package includes receipts | `npm pack --dry-run`; `final-gate-result.json` pack check; `package-smoke-result.json` | Done: tarball installs in throwaway consumer project; required receipts/artifacts included |
| No-cap visual honesty | `DOGFOOD-LOG.md` Shots 5 and 8; `docs/kev-domain-dogfood-skill.md`; no-cap gate pass on narrowed claim | Done: desktop visual receipt failure explicitly documented; no full visual validation claimed |
| Gate suite | `final-gate-result.json` | Done: `npm test`, `review:test`, `qa`, `hermes:parity`, `live:defense`, `dogfood:kev-domain`, manifest check, pack check all pass |
| Submission narrative | `PR-BODY-DRAFT.md`; README/FRONTIER updates; `HOMERUN-SCORECARD.md` | Done locally; no PR opened, no push performed |
| Live handler/current-process capture of new templates | `scripts/live-defense-correlation.mjs`; `final-gate-result.json`; `live-reload-dogfood-result.json` | Package-loaded handler proven and current post-/reload Kev process proven: high-signal templates captured live; staged reflect updated existing staged skill instead of creating sibling. |
| Literal “2 hour loop” | Time budget reports ~1748s at audit start | Not literally 2 hours yet; substantial loop done, but objective’s literal duration is not satisfied |

## HOMERUN scorecard
Source: `HOMERUN-SCORECARD.md` / `homerun-scorecard-result.json`

```txt
coverage: 20/20 vs 7/20 (2.86x)
runtime lift: 33% -> 100% (+67 pts)
skill quality: 38 vs 36.6, 3/5 domains won
runtime crush: 4/4 vs 3/4
real workflow routing: 2 UPDATE / 1 CREATE
Kev-domain dogfood: 0 -> 4 signals (+4)
```

## Final gate summary
Source: `final-gate-result.json`

```txt
pass: true
npm test: 0
npm run review:test: 0
npm run qa: 0
npm run hermes:parity: 0
npm run live:defense: 0
npm run dogfood:kev-domain: 0
validate-manifests: 0
npm pack --dry-run: 0, 43 files, required artifacts included
staleHits: []
Kev-domain proof: legacySignalItems 0, newSignalItems 4, uplift +4
```

## Remaining gaps / honest blockers

1. **Current-process reload boundary:** the upgraded mod file is installed at `~/.letta/mods/muscle-memory.ts`, and the package-loaded handler is now proven by `live:defense` to template `visual_receipt` events. However, the current Kev process was hot-loaded with the old handler; after install, rows for `repo_radar_evidence` and `no_cap_gate_check` still had `tmpl:null`. A `/reload` or fresh launch is required to prove live current-process capture specifically.
2. **Literal duration:** the active goal text says “full 2 hour loop”; the tracked time at this audit was ~1748 seconds (~29 minutes). We have strong receipts, but not a literal two-hour run yet.
3. **PR/commit state:** changes are intentionally uncommitted/unpushed. This respects the “don’t push/open PR until Adrian says ship it” guardrail, but it means the repo is not submitted yet.

## Audit verdict
The current state is a **strong checkpoint, not a final achieved goal** if the objective is interpreted literally as a two-hour loop plus live high-signal capture. The mod is materially upgraded and packaged with strong receipts. Next best action is `/reload` or fresh Kev launch, then run one live high-signal tool burst and manual reflect to prove the upgraded event templates in this actual running process.

| Complete loop works across multiple skills | `complete-loop-dogfood-result.json`; `scripts/complete-loop-dogfood.mjs` | PASS: update auto-graduates, high-confidence create auto-graduates, low-confidence create stages, manual graduate promotes, auto-prune retires stale managed skill, mesh/UI events update. |

| Separate non-mod workflow works | `separate-workflow-dogfood-result.json`; `scripts/separate-workflow-dogfood.mjs` | PASS: Shopify visual-claim skill created/graduated, UI/mesh updated, repeat evidence skipped, no Letta-mod skill staged. |

| Catalog publish works safely | `catalog-publish-dogfood-result.json`; `scripts/catalog-publish-dogfood.mjs` | PASS: SKILL.md-only mirror to global catalog, no evidence refs, private path skill blocked, UI/mesh publish events emitted. |
