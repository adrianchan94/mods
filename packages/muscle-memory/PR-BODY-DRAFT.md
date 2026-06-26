## muscle-memory — self-evolving skill foundry for Letta Code

This mod turns Letta Code's persistent state into a Hermes-style self-improvement loop, but with Letta-native advantages: cross-conversation evidence, MemFS update-first routing, evidence manifests, failure-aware repair chains, visible review UI, and reversible staged writes.

### What it does
- Observes real tool use via `tool_start` / `tool_end` / lifecycle events.
- Aggregates cross-conversation evidence, including recovered failures and high-signal receipt workflows.
- Runs a reflective reviewer that creates or updates class-level `SKILL.md` files.
- Uses MemFS content-level search to patch existing skills instead of duplicating them.
- Writes evidence manifests beside generated skills.
- Adds advisory failure defenses from prior repair chains.
- Keeps full-auto off by default; staged/approval-safe is the normal mode.

### Why it beats a prompt-only Hermes clone
Hermes reviews one conversation. muscle-memory distills from the agent's whole cross-session history and git-versioned memory library. That gives it structural advantages Hermes cannot get from prompt polish alone:

- **Pitfall coverage:** 20/20 vs Hermes 7/20 (2.9×) on the packaged coverage benchmark.
- **Runtime lift:** 33% → 100% first-try correctness on Letta-specific pitfall tasks with the distilled skill loaded.
- **Update-first routing:** correctly updates existing skills in real-history workflows instead of spraying duplicates.
- **Receipt discipline:** every write can carry an evidence manifest; pack output includes the evidence files.

### Dogfood proof — the part we care about most
We dogfooded it on ourselves, not just synthetic tasks.

**Mack/local lane:** muscle-memory distilled `validating-letta-code-mod-packages` from real mod-dev work, then that skill was loaded through Letta's normal Skill tool and used to validate the mod itself.

**Kev/cloud/operator lane:** real IM8/Shopify-style work exposed a blind spot: rare but consequential receipt tools (`visual_receipt`, `im8_claims_lint`, `no_cap_gate_check`, `repo_radar_evidence`) were being observed but not surfaced to the reviewer because the old miner favored repeated shell/npm templates. We patched it with a high-signal receipt lane.

Receipt harness:

```bash
npm run dogfood:kev-domain
```

Result:

```txt
legacySignalItems: 0
newSignalItems: 4
uplift: +4
created skill: validating-shopify-visual-claims-with-receipts
```

Generated artifact: `docs/kev-domain-dogfood-skill.md`  
Machine-readable receipt: `kev-domain-dogfood-result.json`

Important no-cap note: the IM8 browser scenario is intentionally recorded as **partial**, not full visual validation. Mobile/DOM receipt succeeded; desktop annotated screenshot failed. The generated skill captures that exact overclaim guardrail.

### Scoreboard

The clean reviewer-facing scoreboard is `HOMERUN-SCORECARD.md`, generated from packaged receipts via `npm run scorecard`. Machine-readable version: `homerun-scorecard-result.json`. It summarizes: 20/20 vs 7/20 coverage, 33%→100% runtime lift, 38 vs 36.6 skill quality, 4/4 vs 3/4 runtime crush, 2 UPDATE / 1 CREATE real workflow routing, Kev-domain 0→4 signal uplift, and package-smoke PASS.

### Validation receipts
Current local gate after the dogfood upgrade:

```txt
npm test                  12/12 PASS
npm run review:test       64/64 PASS
npm run qa                55/55 PASS
npm run hermes:parity     44/44 PASS
npm run live:defense      14/14 PASS
npm run dogfood:kev-domain PASS
npm run dogfood:complete-loop PASS
npm run dogfood:separate-workflow PASS
npm run dogfood:catalog-publish PASS
npm run package:smoke    PASS
npm run live:reload-proof PASS
npm run scorecard         PASS
npm run final:gate        PASS
validate-manifests        PASS
npm pack --dry-run        includes DOGFOOD-LOG, FRONTIER-EVIDENCE, result JSONs, and Kev-domain skill artifact
```

### Files worth reviewing
- `mods/index.ts` — mod implementation and high-signal receipt lane.
- `package-smoke-result.json` — tarball install smoke: installed package bundles and captures high-signal handler behavior.
- `live-reload-dogfood-result.json` — local Kev live-state receipt: post-/reload high-signal templates + staged UPDATE anti-bloat + duplicate quarantine.
- `complete-loop-dogfood-result.json` — deterministic complete-loop receipt: update/create/stage/manual-graduate/auto-prune plus mesh/UI lifecycle events.
- `separate-workflow-dogfood-result.json` — separate-domain receipt: Shopify visual-claim skill generated/graduated, UI/mesh updated, repeat evidence skipped.
- `catalog-publish-dogfood-result.json` — catalog receipt: manual publish mirrors SKILL.md only to global custom skills and privacy-blocks non-portable content.
- `scripts/kev-domain-dogfood.mjs` — deterministic Kev-domain proof harness.
- `kev-domain-dogfood-result.json` — machine-readable proof: legacy 0 → upgraded 4 signals.
- `docs/kev-domain-dogfood-skill.md` — generated Shopify/no-cap receipt skill artifact.
- `DOGFOOD-LOG.md` — full dogfood journal, including catches and no-cap corrections.
- `FRONTIER-EVIDENCE.md` — benchmark/runtime/coverage evidence.

### Honest scope
- Pre-action defenses are advisory, not enforcement.
- Reflective review defaults to staged/approval-safe. Full auto is opt-in and budget-sensitive.
- The current running cloud process needs `/reload` or a fresh launch before it captures the newly-installed high-signal event templates live. The package-local harness proves the implementation independently.
- No production Shopify writes were performed.
