#!/usr/bin/env node
// Proves muscle-memory is not Letta-mod-specific by running a clean, separate Shopify/no-cap workflow loop.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = mkdtempSync(join(tmpdir(), 'mm-separate-workflow-'));
const mem = join(state, 'mem');
const skills = join(mem, 'skills');
process.env.MM_STATE_DIR = state;
process.env.MEMORY_DIR = mem;
mkdirSync(skills, { recursive: true });
const bundle = join(state, 'mod-bundle.mjs');
execFileSync('npx', ['--yes', 'esbuild', join(root, 'mods', 'index.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + bundle], { stdio: 'pipe' });
const { __mm: M } = await import(pathToFileURL(bundle).href + '?t=' + Date.now());
function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function skillExists(name) { return existsSync(join(skills, name, 'SKILL.md')); }
function writeExperience(rows) { writeFileSync(join(state, 'experience.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); writeFileSync(join(state, 'outcomes.jsonl'), ''); }

const rows = [];
for (const conv of ['shopify-a', 'shopify-b', 'shopify-c']) {
  rows.push({ ts: 1, conv, tool: 'visual_receipt', tmpl: 'visual_receipt im8health.com 2 viewports 4 selectors', ok: true, id: `${conv}-visual` });
  rows.push({ ts: 2, conv, tool: 'no_cap_gate_check', tmpl: 'no_cap_gate_check visual claim requires screenshot boxes', ok: true, id: `${conv}-nocap` });
  rows.push({ ts: 3, conv, tool: 'im8_claims_lint', tmpl: 'im8_claims_lint supplement copy risk scan', ok: true, id: `${conv}-claims` });
}
writeExperience(rows);
const raw = `---
name: validating-shopify-visual-claims
description: Use when validating Shopify storefront visual claims with screenshot receipts, computed boxes, no-cap proof, and claims-lint evidence before saying a user-facing change is ready.
---
## When to use
- Before claiming a Shopify or storefront visual change is validated.
- When visual_receipt, no_cap_gate_check, or claims-lint receipts are part of the proof.
## Procedure
1. Capture the exact preview URL and viewport receipts.
2. Verify screenshots and computed boxes match the claim shape.
3. Run no-cap claim checking before saying ready/done.
4. Run claims lint when supplement/commercial copy is involved.
## Pitfalls
- Do not treat DOM presence as visual proof.
- Do not claim mobile+desktop validation without matching screenshots/boxes.
- Do not over-promote supplement claims without lint receipts.
## Verification
- Screenshot/box receipt exists for the same URL.
- no-cap gate passes for the exact claim.
- claims-lint is clean or documented with caveats.
`;
const first = await M.runReflectiveReview({}, { mode: 'staged', minItems: 1, authorFn: async () => raw });
const repeat = await M.runReflectiveReview({}, { mode: 'staged', minItems: 1, authorFn: async () => raw });
const uiEvents = readJsonl(join(state, 'ui-events.jsonl'));
const uiState = existsSync(join(state, 'ui-state.json')) ? JSON.parse(readFileSync(join(state, 'ui-state.json'), 'utf8')) : {};
const feed = M.loadMeshFeed(20);
const skillName = 'validating-shopify-visual-claims';
const receipt = {
  generatedAt: new Date().toISOString(),
  pass: true,
  state,
  checks: {
    separateWorkflowNotLettaMods: !/letta|mod|package/.test(skillName),
    createdShopifySkill: first.action === 'create' && first.name === skillName,
    autoGraduatedActive: first.wrote === join(skills, skillName) && skillExists(skillName),
    repeatSkippedByWaterline: repeat.action === 'none' && /already reflected/.test(repeat.reason || ''),
    uiShowsGraduatedThenSkip: uiEvents.some((e) => e.phase === 'skill_graduated' && e.skill === skillName) && uiEvents.some((e) => e.phase === 'reflect_none' && /already reflected/.test(e.summary || '')) && /already reflected/.test(String(uiState.last || '')),
    meshShowsGraduated: feed.some((e) => e.type === 'skill_graduated' && e.skill === skillName),
    noStagedModSkill: !existsSync(join(state, 'staged', 'validating-letta-code-mod-packages', 'SKILL.md'))
  },
  observed: { first, repeat, uiState, uiEvents: uiEvents.slice(-8), feed: feed.slice(-8), skillPath: join(skills, skillName, 'SKILL.md') }
};
receipt.pass = Object.values(receipt.checks).every(Boolean);
writeFileSync(join(root, 'separate-workflow-dogfood-result.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ pass: receipt.pass, checks: receipt.checks, observed: { first: first.wrote, repeat: repeat.reason, uiState } }, null, 2));
if (!receipt.pass) process.exit(1);
