# Publishability preflight (MM_PUBLISH) — the skill supply chain

> Hermes authors skills. muscle-memory manages their **distribution**: staged → agent-specific →
> sanitized **shared Custom Skill** → reusable by other agents → usage/retire loop. Organizational
> learning, not just distillation.

A graduated skill is **agent-specific scar tissue**. A *published* (shared Custom Skills) skill must be
**portable, private-data-safe, reusable by other agents, and app-visible**. The preflight is the bridge
between "this agent learned" and "the mesh benefits".

## V1 — SHIPPED (read/preflight, pure, tested; never mutates by default)

Pure functions in `mods/index.ts` (exported on `__mm`, covered by `test/engram.test.ts`):

- **`publishHardBlocks(body)`** — detects actual secret VALUES (`sk-…`, `ghp_…`, AWS `AKIA…`, Slack
  tokens, PEM private keys, `*_API_KEY="<value>"`). A hard block: a published skill must never carry these.
- **`sanitizeForPublish(body)`** → `{ sanitized, replacements }` — swaps PRIVATE identifiers for
  placeholders while **preserving the mechanism/code/worked-examples** (sanitize identifiers, not lessons):
  | from | to |
  |---|---|
  | `/Users/<name>` | `<local path>` |
  | `~/.letta/.../agents/…` | `<agent memfs>` |
  | `agent-<uuid>` | `<agent id>` |
  | `chan2saucy` / `adrianchan` | `<user>` |
  | `IM8` / `Prenetics` | `<project>` |
  | `ZAI_API_KEY` / `OPENAI_API_KEY` / … | `PROVIDER_API_KEY` |
- **`publishabilityScore(skill)`** → `{ score 0-100, hardBlocks, issues[], recommended }` across 5 gates:
  - **privacy** (hard): secrets → `block`, score capped ≤15.
  - **portability**: −8 per sanitizable identifier kind present (publishable only after sanitization).
  - **quality**: reuses the SOTA gate (`sotaQualityGaps`) + requires When-to-use / Procedure / Pitfalls /
    Verification + a real description.
  - **reusability**: −10 one-off (GENERALITY); −5 risky ops without a when-not-to-use / scope guard.
  - **compounding**: −5 if no update/retire/anti-bloat criteria (won't stay healthy across agents).
- **`publishPlan(skill)`** — the full preflight: score + issues + sanitized preview + recommended action +
  current/recommended shelf.
- **`/muscle-memory publish <skill>`** — dry-run preflight command; emits a `skill_publish_preflight`
  receipt. Recommends `publish` (clean, ≥80, no identifiers) / `stage-sanitized` (default) / `block`.

Proven on a real skill: `cloud-agent-forensics` → 67/100, `stage-sanitized` (agent-id flagged + sanitized,
quality gaps surfaced) — not blind-published.

## Guardrails (enforced by design)

- Never auto-publishes; preflight is read/dry-run.
- Hard block on secrets — even sanitized.
- Sanitizes IDENTIFIERS only; never weakens rich worked examples into generic mush.
- This is **shared Custom Skills / publishability**, not an external marketplace submission.

## V1.1 — SHIPPED (the full supply chain; still no auto-publish, no remote push)

- **Auto-preflight after graduation** — when a skill graduates to the agent shelf, a read-only preflight
  fires automatically (`skill_publish_preflight`: quality+publishability score · tier · recommended shelf).
  Never auto-publishes.
- **`publishTier(plan)`** → `blocked` · `agent-local` · `team-shareable` (Custom-Skills-ready after
  sanitization) · `marketplace-candidate`.
- **`findSimilarSkills(name, desc, existing)`** — duplicate check vs shared Custom Skills (exact-name and
  topic-overlap) → recommends merge/update instead of a duplicate publish.
- **`/muscle-memory publish stage <skill>`** → `stageSanitizedPublish`: writes the sanitized SKILL.md
  (identifiers→placeholders, mechanism preserved) + provenance metadata + `PUBLISH-PLAN.json` to
  `$MM_STATE_DIR/publish-staged/<skill>/`; emits `skill_publish_staged`.
- **`/muscle-memory publish approve <skill>`** → `approveStagedPublish`: publishes the staged copy to
  `~/.letta/skills/<skill>/SKILL.md` with provenance frontmatter (`origin: muscle-memory`,
  `publishability_score`, `tier`, `privacy`, `published_at`); **re-preflights the staged copy and
  hard-blocks if a secret was injected (tamper guard)**; emits `skill_published`.
- **Visibility receipt** — `publishVisibilityReceipt` confirms the file exists on the shelf and prints the
  `/reload` hint (the app/skill index may lag until reload).

All validated end-to-end (stage → approve → on-shelf, sanitized, provenance, tamper-blocked) + regression
test. `head-to-head/effectiveness/` and the package tests cover it.

## NEXT (roadmap — not built, not claimed)
- The harness/context-vs-mod auto-router (separate lane).
