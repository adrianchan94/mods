#!/usr/bin/env node
// Kev-domain dogfood harness — proves muscle-memory learns from high-signal operator receipts,
// not only repeated shell/npm loops. No live model required; validates routing/gates deterministically.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const STATE = join(tmpdir(), 'mm-kev-domain-dogfood-' + process.pid);
mkdirSync(STATE, { recursive: true });
process.env.MM_STATE_DIR = STATE;
process.env.MEMORY_DIR = join(STATE, 'memory');
mkdirSync(join(process.env.MEMORY_DIR, 'skills'), { recursive: true });

const OUT = join(tmpdir(), 'mm-kev-domain-dogfood-bundle.mjs');
execFileSync('npx', ['--yes', 'esbuild', join(root, 'mods', 'index.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + OUT], { stdio: 'pipe' });
const { __mm: M } = await import(OUT + '?t=' + Date.now());

let ts = 1;
const rows = [
  { ts: ts++, conv: 'kev-shopify-visual', tool: 'visual_receipt', tmpl: 'visual_receipt im8health.com 2 viewports 4 selectors', ok: false, err: 'desktop annotated screenshot failed after mobile receipt succeeded' },
  { ts: ts++, conv: 'kev-claims', tool: 'im8_claims_lint', tmpl: 'im8_claims_lint supplement-copy 0 files', ok: true },
  { ts: ts++, conv: 'kev-release', tool: 'no_cap_gate_check', tmpl: 'no_cap_gate_check high-trust-claim', ok: true },
  { ts: ts++, conv: 'kev-release', tool: 'repo_radar_evidence', tmpl: 'repo_radar_evidence kev-duo-dogfood-release-readiness', ok: true }
];
writeFileSync(join(STATE, 'experience.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

// Legacy behavior: no repairs, no anti-patterns, no repeated template >=3 => this same Kev-domain work was invisible.
const legacySignalItems = 0;
const evidence = M.buildCrossConversationEvidence(M.loadExperience());
const evidenceHasVisual = /visual_receipt im8health\.com/.test(evidence.digest);
const evidenceHasClaims = /im8_claims_lint supplement-copy/.test(evidence.digest);
const evidenceHasNoCap = /no_cap_gate_check high-trust-claim/.test(evidence.digest);
const evidenceHasPartial = /failed\/partial receipt/.test(evidence.digest);

const authorFn = async () => `---
name: validating-shopify-visual-claims-with-receipts
description: Use when checking Shopify or IM8 visual/copy claims before saying done, ready, validated, safe, or PR-ready; trigger on visual_receipt, no-cap gates, claims lint, preview QA, or evidence-backed release checks.
---

## When to use
- Before claiming a Shopify/IM8 page, section, CTA, preview, or visual change is done or validated.
- When a browser receipt, screenshot, claims lint, no-cap check, or repo evidence result is partial, failed, or ambiguous.
- Before PR copy says evidence is packaged, visual rendering is proven, or supplement claims are safe.

## Procedure
1. Lock the exact claim: URL, viewport, selector, file, copy block, package artifact, or PR statement.
2. Collect proof using the strongest available receipt: visual receipt for pixels, DOM/computed boxes for layout, claims lint for copy triage, \`no_cap_gate_check\` for high-trust statements, and package/pack output for release claims.
3. Classify each proof as full, partial, failed, or proxy-only. A mobile receipt does not prove desktop. A linter pass does not prove legal clearance. A repo file does not prove npm package inclusion.
4. If any required proof is partial or missing, report the narrowed claim and the blocker instead of saying done.
5. Fix evidence-packaging gaps immediately when safe (for example, package.json files missing receipt artifacts), then rerun the same proof command.

## Pitfalls
- **Partial visual receipt overclaim** — mobile screenshot/crops can succeed while desktop annotated screenshot fails. Say "mobile/DOM receipt captured; desktop failed" instead of "mobile+desktop validated."
- **Claims-lint overreliance** — \`im8_claims_lint\` is triage only. Broad language like "Protects 9 Organ Systems" still needs substantiation/legal review even if the linter reports zero findings.
- **Source proof not packaged proof** — README/FRONTIER evidence in the repo does not prove npm tarball evidence. Run \`npm pack --dry-run\` and confirm the receipts are included.
- **No-cap mismatch** — do not claim ready/validated/safe unless the exact claim type has matching proof, not a neighboring proxy.

## Verification
- Screenshot/visual artifacts exist for every claimed viewport, or the claim explicitly says which viewport failed.
- Claims lint output is recorded with a human-review caveat for supplement/health language.
- \`no_cap_gate_check\` passes for the exact final statement.
- \`npm pack --dry-run\` includes every receipt/doc the PR or README cites.
- \`git diff --stat\` and \`git status --short --branch\` show only intentional files.
`;

const result = await M.runReflectiveReview({}, { mode: 'staged', minItems: 1, authorFn });
const wroteSkill = result.wrote && existsSync(join(result.wrote, 'SKILL.md'));
const skillText = wroteSkill ? readFileSync(join(result.wrote, 'SKILL.md'), 'utf8') : '';
const manifestDir = result.wrote ? join(result.wrote, 'references', 'evidence') : '';
const manifestExists = manifestDir && existsSync(manifestDir);
const summary = {
  generatedAt: new Date().toISOString(),
  legacySignalItems,
  newSignalItems: evidence.items,
  uplift: evidence.items - legacySignalItems,
  evidenceHasVisual,
  evidenceHasClaims,
  evidenceHasNoCap,
  evidenceHasPartial,
  action: result.action,
  skill: result.name,
  wroteSkill: !!wroteSkill,
  manifestExists: !!manifestExists,
  gates: {
    evidenceVisible: evidence.items >= 3 && evidenceHasVisual && evidenceHasClaims && evidenceHasNoCap && evidenceHasPartial,
    createdExpectedSkill: result.action === 'create' && result.name === 'validating-shopify-visual-claims-with-receipts',
    wroteSkill: !!wroteSkill,
    manifest: !!manifestExists,
    skillHasPitfalls: /Partial visual receipt overclaim/.test(skillText) && /Claims-lint overreliance/.test(skillText),
    security: M.scanSkillContent(skillText).ok,
    lint: M.lintSkillDraft({ name: result.name || '', description: result.description || '', body: result.body || '' }).ok
  },
  evidenceDigest: evidence.digest,
  stateDir: STATE
};
const outPath = join(root, 'kev-domain-dogfood-result.json');
writeFileSync(outPath, JSON.stringify(summary, null, 2));
mkdirSync(join(root, 'docs'), { recursive: true });
if (wroteSkill) writeFileSync(join(root, 'docs', 'kev-domain-dogfood-skill.md'), skillText);

const pass = Object.values(summary.gates).every(Boolean);
console.log(JSON.stringify(summary, null, 2));
if (!pass) process.exit(1);
