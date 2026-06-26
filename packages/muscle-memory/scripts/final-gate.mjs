#!/usr/bin/env node
// Final package gate — runs the non-model deterministic gates and writes one machine-readable receipt.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '..', '..');
const outPath = join(root, 'final-gate-result.json');
const commands = [
  { name: 'npm test', cmd: 'npm', args: ['test'] },
  { name: 'npm run review:test', cmd: 'npm', args: ['run', 'review:test'] },
  { name: 'npm run qa', cmd: 'npm', args: ['run', 'qa'] },
  { name: 'npm run hermes:parity', cmd: 'npm', args: ['run', 'hermes:parity'] },
  { name: 'npm run live:defense', cmd: 'npm', args: ['run', 'live:defense'] },
  { name: 'npm run dogfood:kev-domain', cmd: 'npm', args: ['run', 'dogfood:kev-domain'] },
  { name: 'npm run dogfood:complete-loop', cmd: 'npm', args: ['run', 'dogfood:complete-loop'] },
  { name: 'npm run dogfood:separate-workflow', cmd: 'npm', args: ['run', 'dogfood:separate-workflow'] },
  { name: 'npm run dogfood:catalog-publish', cmd: 'npm', args: ['run', 'dogfood:catalog-publish'] },
  { name: 'npm run package:smoke', cmd: 'npm', args: ['run', 'package:smoke'] },
  { name: 'npm run scorecard', cmd: 'npm', args: ['run', 'scorecard'] }
];
const results = [];
for (const c of commands) {
  const start = Date.now();
  const r = spawnSync(c.cmd, c.args, { cwd: root, encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  results.push({ name: c.name, exitCode: r.status, durationMs: Date.now() - start, stdoutTail: output.slice(-6000) });
  if (r.status !== 0) break;
}

const manifestScript = join(repo, 'scripts', 'validate-manifests.mjs');
let manifest = { name: 'validate-manifests', exitCode: null, skipped: true, reason: 'repo-level script not present' };
if (existsSync(manifestScript)) {
  const start = Date.now();
  const r = spawnSync('node', [manifestScript], { cwd: repo, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  manifest = { name: 'validate-manifests', exitCode: r.status, durationMs: Date.now() - start, stdoutTail: output.slice(-3000) };
}

const packStart = Date.now();
const packRun = spawnSync('npm', ['pack', '--dry-run'], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const packOutput = `${packRun.stdout || ''}${packRun.stderr || ''}`;
const requiredPackFiles = [
  'DOGFOOD-LOG.md', 'FRONTIER-EVIDENCE.md', 'README.md', 'MOD.md',
  'kev-domain-dogfood-result.json', 'final-gate-result.json', 'homerun-scorecard-result.json', 'package-smoke-result.json', 'live-reload-dogfood-result.json', 'complete-loop-dogfood-result.json', 'separate-workflow-dogfood-result.json', 'catalog-publish-dogfood-result.json',
  'HOMERUN-SCORECARD.md', 'docs/kev-domain-dogfood-skill.md', 'scripts/kev-domain-dogfood.mjs', 'scripts/final-gate.mjs', 'scripts/scorecard.mjs', 'scripts/package-smoke.mjs', 'scripts/live-reload-proof.mjs', 'scripts/complete-loop-dogfood.mjs', 'scripts/separate-workflow-dogfood.mjs', 'scripts/catalog-publish-dogfood.mjs',
  'benchmark-multidomain-result.json', 'coverage-benchmark-result.json', 'perf-improvement-result.json',
  'replicate-workflows-result.json', 'runtime-crush-result.json'
];
const pack = {
  name: 'npm pack --dry-run', exitCode: packRun.status, durationMs: Date.now() - packStart,
  includes: Object.fromEntries(requiredPackFiles.map((f) => [f, packOutput.includes(f)])),
  totalFiles: Number((packOutput.match(/total files:\s+(\d+)/i) || [])[1] || 0),
  stdoutTail: packOutput.slice(-6000)
};

const staleTerms = ['47 vs 35', '47v35', '49/49', 'BENCHMARK-REPORT'];
const grepFiles = ['README.md', 'FRONTIER-EVIDENCE.md', 'DOGFOOD-LOG.md', 'PR-BODY-DRAFT.md', 'docs/kev-domain-dogfood-skill.md'];
const staleHits = [];
for (const f of grepFiles) {
  try {
    const text = await import('node:fs').then(fs => fs.readFileSync(join(root, f), 'utf8'));
    for (const term of staleTerms) if (text.includes(term)) staleHits.push({ file: f, term });
    if (/(^|[^-])\bbenchmark-result\.json\b/.test(text)) staleHits.push({ file: f, term: 'benchmark-result.json' });
    if (/[^A-Z]validated mobile\+desktop(?![^\n]*\bNOT\b)/i.test(text) && !/NOT \"validated mobile\+desktop\"/.test(text)) staleHits.push({ file: f, term: 'validated mobile+desktop overclaim' });
  } catch {}
}

const packageSmoke = await import('node:fs').then(fs => JSON.parse(fs.readFileSync(join(root, 'package-smoke-result.json'), 'utf8'))).catch(() => null);
const dogfood = await import('node:fs').then(fs => JSON.parse(fs.readFileSync(join(root, 'kev-domain-dogfood-result.json'), 'utf8'))).catch(() => null);
const completeLoop = await import('node:fs').then(fs => JSON.parse(fs.readFileSync(join(root, 'complete-loop-dogfood-result.json'), 'utf8'))).catch(() => null);
const separateWorkflow = await import('node:fs').then(fs => JSON.parse(fs.readFileSync(join(root, 'separate-workflow-dogfood-result.json'), 'utf8'))).catch(() => null);
const catalogPublish = await import('node:fs').then(fs => JSON.parse(fs.readFileSync(join(root, 'catalog-publish-dogfood-result.json'), 'utf8'))).catch(() => null);
const pass = results.every((r) => r.exitCode === 0)
  && (manifest.skipped || manifest.exitCode === 0)
  && pack.exitCode === 0
  && Object.values(pack.includes).every(Boolean)
  && staleHits.length === 0
  && dogfood?.legacySignalItems === 0 && dogfood?.newSignalItems === 4 && dogfood?.gates && Object.values(dogfood.gates).every(Boolean)
  && completeLoop?.pass === true && completeLoop?.checks && Object.values(completeLoop.checks).every(Boolean)
  && separateWorkflow?.pass === true && separateWorkflow?.checks && Object.values(separateWorkflow.checks).every(Boolean)
  && catalogPublish?.pass === true && catalogPublish?.checks && Object.values(catalogPublish.checks).every(Boolean)
  && packageSmoke?.pass === true && packageSmoke?.behavior?.handlerCapturedTemplate === true;

const receipt = {
  generatedAt: new Date().toISOString(),
  pass,
  commands: results,
  manifest,
  pack,
  staleScan: { terms: staleTerms, hits: staleHits },
  packageSmoke: packageSmoke ? { pass: packageSmoke.pass, handlerCapturedTemplate: packageSmoke.behavior?.handlerCapturedTemplate, tarball: packageSmoke.tarball } : null,
  completeLoopDogfood: completeLoop ? { pass: completeLoop.pass, checks: completeLoop.checks } : null,
  separateWorkflowDogfood: separateWorkflow ? { pass: separateWorkflow.pass, checks: separateWorkflow.checks } : null,
  catalogPublishDogfood: catalogPublish ? { pass: catalogPublish.pass, checks: catalogPublish.checks } : null,
  kevDomainDogfood: dogfood ? {
    legacySignalItems: dogfood.legacySignalItems,
    newSignalItems: dogfood.newSignalItems,
    uplift: dogfood.uplift,
    skill: dogfood.skill,
    gates: dogfood.gates
  } : null,
  caveats: [
    'Does not run model/API benchmarks; uses packaged benchmark result receipts.',
    'Does not claim full IM8 visual validation; Shot 5 desktop visual receipt failed and is documented partial.',
    'Current hot-loaded Kev process needs /reload or fresh launch before live event capture uses the patched high-signal templates.'
  ]
};
writeFileSync(outPath, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ pass: receipt.pass, outPath, commands: results.map(r => ({ name: r.name, exitCode: r.exitCode, durationMs: r.durationMs })), pack: { exitCode: pack.exitCode, totalFiles: pack.totalFiles, allRequiredIncluded: Object.values(pack.includes).every(Boolean) }, staleHits, kevDomain: receipt.kevDomainDogfood }, null, 2));
if (!pass) process.exit(1);
