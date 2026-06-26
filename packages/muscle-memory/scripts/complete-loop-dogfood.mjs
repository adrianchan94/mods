#!/usr/bin/env node
// Deterministic complete-loop dogfood: distill → validate → graduate → stage → manual graduate → prune.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = mkdtempSync(join(tmpdir(), 'mm-complete-loop-'));
const mem = join(state, 'mem');
const skills = join(mem, 'skills');
process.env.MM_STATE_DIR = state;
process.env.MEMORY_DIR = mem;
mkdirSync(skills, { recursive: true });
const bundle = join(state, 'mod-bundle.mjs');
execFileSync('npx', ['--yes', 'esbuild', join(root, 'mods', 'index.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + bundle], { stdio: 'pipe' });
const imported = await import(pathToFileURL(bundle).href + '?t=' + Date.now());
const M = imported.__mm;
const activate = imported.default;
const staged = join(state, 'staged');
const meshFeed = join(state, 'mesh-skill-feed.jsonl');

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function writeExperience(rows, outcomes = []) {
  writeFileSync(join(state, 'experience.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(state, 'outcomes.jsonl'), outcomes.map((r) => JSON.stringify(r)).join('\n') + (outcomes.length ? '\n' : ''));
}
function skillExists(dir, name) { return existsSync(join(dir, name, 'SKILL.md')); }
function mock(body = {}) {
  return async (_sys, user) => {
    const m = user.match(/UPDATE-FIRST[\s\S]*?"([a-z0-9-]+)"/);
    const name = body.name || (m ? m[1] : 'validating-loop-workflows');
    return body.raw || `---\nname: ${name}\ndescription: Use when validating complete-loop muscle-memory workflows with receipts, graduation checks, staged review, and prune safety before claiming the loop is live.\n---\n## When to use\n- validating complete-loop workflows\n## Procedure\n1. run the deterministic loop\n2. inspect artifacts\n## Pitfalls\n- do not claim app-visible skill availability without active skills-dir proof\n## Verification\n- graduated skill exists in active skill directory\n`;
  };
}
function managedSkill(name, desc = 'Use when testing complete-loop managed skill lifecycle behavior with reversible prune safety.') {
  M.writeSkill(skills, name, `---\nname: ${name}\ndescription: ${desc}\n---\n\n## When to use\n- lifecycle testing\n## Procedure\n1. verify state\n## Verification\n- receipt exists\n<!-- muscle-memory provenance: complete loop test -->\n`);
}

// 1) UPDATE existing → auto-graduate
managedSkill('validating-loop-workflows');
const updateRows = ['u1', 'u2', 'u3'].map((conv, i) => ({ ts: i, conv, tool: 'Bash', tmpl: 'complete loop validate graduate prune workflow', id: `${conv}-update` }));
writeExperience(updateRows);
const beforeUpdate = readFileSync(join(skills, 'validating-loop-workflows', 'SKILL.md'), 'utf8');
const update = await M.runReflectiveReview({}, { mode: 'staged', minItems: 1, authorFn: mock({ name: 'validating-loop-workflows' }) });
const afterUpdate = readFileSync(join(skills, 'validating-loop-workflows', 'SKILL.md'), 'utf8');
const updateRepeat = await M.runReflectiveReview({}, { mode: 'staged', minItems: 1, authorFn: mock({ name: 'validating-loop-workflows' }) });

// 2) high-confidence CREATE → auto-graduate
const highRows = ['h1', 'h2', 'h3'].flatMap((conv, i) => [
  { ts: 10 + i * 2, conv, tool: 'Bash', tmpl: 'aurora renderer proof capture pipeline', id: `${conv}-h1` },
  { ts: 11 + i * 2, conv, tool: 'Bash', tmpl: 'aurora renderer proof capture pipeline', id: `${conv}-h2` }
]);
writeExperience(highRows);
const highCreate = await M.runReflectiveReview({}, { mode: 'staged', minItems: 1, authorFn: mock({ name: 'capturing-aurora-renderer-proofs', raw: `---\nname: capturing-aurora-renderer-proofs\ndescription: Use when capturing aurora renderer proof pipelines with repeated command receipts, artifact checks, and final proof before claiming a rendering workflow is ready.\n---\n## When to use\n- capturing aurora renderer proof workflows\n## Procedure\n1. run the aurora proof capture pipeline\n2. inspect artifacts\n## Pitfalls\n- do not claim visual proof without the matching artifact\n## Verification\n- proof artifacts exist and final gate passes\n` }) });

// 3) low-confidence CREATE → staged
const lowRows = [
  { ts: 30, conv: 'l1', tool: 'visual_receipt', tmpl: 'visual_receipt weak.example 1 viewports 1 selectors', id: 'l1' },
  { ts: 31, conv: 'l2', tool: 'visual_receipt', tmpl: 'visual_receipt weak.example 1 viewports 1 selectors', id: 'l2' }
];
writeExperience(lowRows);
const lowCreate = await M.runReflectiveReview({}, { mode: 'staged', minItems: 1, authorFn: mock({ name: 'validating-weak-visual-receipts', raw: `---\nname: validating-weak-visual-receipts\ndescription: Use when validating weak visual receipt patterns that have some evidence but should be reviewed before becoming app-visible.\n---\n## When to use\n- validating weak visual receipts\n## Procedure\n1. inspect evidence\n## Pitfalls\n- do not over-promote weak patterns\n## Verification\n- reviewer accepts the skill\n` }) });
const lowCreateWasStaged = lowCreate.action === 'create' && lowCreate.wrote === join(staged, 'validating-weak-visual-receipts') && skillExists(staged, 'validating-weak-visual-receipts') && !skillExists(skills, 'validating-weak-visual-receipts');

// 4) manual graduate staged → active
const registeredTools = [];
const disposers = [];
const mockLetta = {
  capabilities: { tools: true, commands: true, events: { tools: true, lifecycle: true }, ui: { panels: true } },
  events: { on: () => () => {} },
  commands: { register: () => () => {} },
  tools: { register: (t) => { registeredTools.push(t); return () => {}; } },
  ui: { openPanel: () => ({ update() {}, close() {} }), closePanel() {} }
};
disposers.push(activate(mockLetta));
const writeTool = registeredTools.find((t) => t.name === 'muscle_memory_skill_write');
const manualGraduate = await writeTool.run({ args: { action: 'graduate', name: 'validating-weak-visual-receipts' } });
for (const d of disposers) try { if (typeof d === 'function') d(); } catch {}

// 5) stale skill → auto-prune
managedSkill('old-unused-loop-prune');
managedSkill('old-pinned-loop-keep');
managedSkill('old-used-loop-keep');
M.writeSkill(skills, 'hand-authored-loop-keep', `---\nname: hand-authored-loop-keep\ndescription: Hand-authored skill should not be pruned by muscle-memory.\n---\n\n## Procedure\n1. keep\n`);
const oldTs = Date.now() - 31 * 86400000;
writeFileSync(join(state, 'skill-usage.json'), JSON.stringify({
  'old-unused-loop-prune': { created: oldTs, uses: 0, state: 'active' },
  'old-pinned-loop-keep': { created: oldTs, uses: 0, pinned: true, state: 'active' },
  'old-used-loop-keep': { created: oldTs, uses: 2, lastActivity: Date.now(), state: 'active' },
  'hand-authored-loop-keep': { created: oldTs, uses: 0, state: 'active' }
}, null, 2));
const prune = M.runAutonomousPrune({}, { maxRetire: 1 });

const feed = M.loadMeshFeed(50);
const uiEvents = readJsonl(join(state, 'ui-events.jsonl'));
const uiState = existsSync(join(state, 'ui-state.json')) ? JSON.parse(readFileSync(join(state, 'ui-state.json'), 'utf8')) : {};
const uiSummary = M.summarizeReflectActions(uiEvents, 'verbose');
const receipt = {
  generatedAt: new Date().toISOString(),
  pass: true,
  state,
  checks: {
    updateAutoGraduated: update.action === 'update' && update.wrote === join(skills, 'validating-loop-workflows') && afterUpdate !== beforeUpdate && skillExists(skills, 'validating-loop-workflows'),
    handledEvidenceSkipsRepeat: updateRepeat.action === 'none' && /already reflected/.test(updateRepeat.reason || ''),
    highCreateAutoGraduated: highCreate.action === 'create' && highCreate.wrote === join(skills, 'capturing-aurora-renderer-proofs') && skillExists(skills, 'capturing-aurora-renderer-proofs') && !skillExists(staged, 'capturing-aurora-renderer-proofs'),
    lowCreateStaged: lowCreateWasStaged,
    manualGraduatePromoted: /graduated 'validating-weak-visual-receipts'/.test(String(manualGraduate)) && skillExists(skills, 'validating-weak-visual-receipts') && !skillExists(staged, 'validating-weak-visual-receipts'),
    autoPruneRetiredOne: prune.retired.length === 1 && prune.retired[0] === 'old-unused-loop-prune' && !skillExists(skills, 'old-unused-loop-prune') && existsSync(prune.retiredPaths[0] || ''),
    pruneGuardsKeptSafeSkills: skillExists(skills, 'old-pinned-loop-keep') && skillExists(skills, 'old-used-loop-keep') && skillExists(skills, 'hand-authored-loop-keep'),
    meshGraduatedEvents: feed.filter((e) => e.type === 'skill_graduated').length >= 3,
    meshRetiredEvent: feed.some((e) => e.type === 'skill_retired' && e.skill === 'old-unused-loop-prune'),
    uiGraduatedEvents: uiEvents.filter((e) => e.phase === 'skill_graduated').length >= 3,
    uiRetiredEvent: uiEvents.some((e) => e.phase === 'skill_retired' && e.skill === 'old-unused-loop-prune'),
    uiStateUpdated: uiState.phase === 'done' && /retired 'old-unused-loop-prune'/.test(String(uiState.last || '')),
    uiSummaryShowsLifecycle: /graduated/.test(uiSummary) && /retired/.test(uiSummary)
  },
  observed: { update, updateRepeat, highCreate, lowCreate, lowCreateWasStaged, manualGraduate: String(manualGraduate), prune, feed: feed.slice(-12), uiEvents: uiEvents.slice(-12), uiState, uiSummary }
};
receipt.pass = Object.values(receipt.checks).every(Boolean);
writeFileSync(join(root, 'complete-loop-dogfood-result.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ pass: receipt.pass, checks: receipt.checks, observed: { update: update.wrote, highCreate: highCreate.wrote, lowCreate: lowCreate.wrote, manualGraduate: String(manualGraduate), prune } }, null, 2));
if (!receipt.pass) process.exit(1);
