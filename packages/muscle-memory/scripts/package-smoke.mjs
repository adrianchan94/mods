#!/usr/bin/env node
// Consumer tarball smoke: pack, install into a throwaway project, load the installed mod, and
// prove high-signal handler behavior from the installed package — not the source tree.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'mm-package-smoke-'));
const packDir = join(tmp, 'pack');
const consumer = join(tmp, 'consumer');
mkdirSync(packDir, { recursive: true });
mkdirSync(consumer, { recursive: true });

function run(name, cmd, args, cwd, maxBuffer = 25 * 1024 * 1024) {
  const start = Date.now();
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  return { name, cmd: [cmd, ...args].join(' '), cwd, exitCode: r.status, durationMs: Date.now() - start, outputTail: output.slice(-5000), stdout: r.stdout || '' };
}

const steps = [];
let tgz = '';
let requiredPresent = {};
let behavior = {};
steps.push(run('npm pack', 'npm', ['pack', '--pack-destination', packDir, '--silent'], root));
if (steps.at(-1).exitCode !== 0) finish(false);
const tgzName = steps.at(-1).stdout.trim().split(/\s+/).find((s) => s.endsWith('.tgz'));
tgz = tgzName ? join(packDir, tgzName) : '';
steps.push({ name: 'tarball exists', exitCode: tgz && existsSync(tgz) ? 0 : 1, durationMs: 0, outputTail: tgz });
if (steps.at(-1).exitCode !== 0) finish(false);
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ type: 'module', private: true }, null, 2));
steps.push(run('npm install tarball', 'npm', ['install', '--silent', tgz], consumer));
if (steps.at(-1).exitCode !== 0) finish(false);

const installed = join(consumer, 'node_modules', '@letta-ai', 'muscle-memory');
const required = [
  'package.json', 'mods/index.ts', 'README.md', 'HOMERUN-SCORECARD.md', 'homerun-scorecard-result.json',
  'final-gate-result.json', 'kev-domain-dogfood-result.json', 'docs/kev-domain-dogfood-skill.md',
  'scripts/kev-domain-dogfood.mjs', 'scripts/final-gate.mjs', 'scripts/scorecard.mjs'
];
requiredPresent = Object.fromEntries(required.map((f) => [f, existsSync(join(installed, f))]));
steps.push({ name: 'required installed files', exitCode: Object.values(requiredPresent).every(Boolean) ? 0 : 1, durationMs: 0, outputTail: JSON.stringify(requiredPresent, null, 2) });
if (steps.at(-1).exitCode !== 0) finish(false);

const bundle = join(tmp, 'installed-mod.mjs');
steps.push(run('bundle installed mod', 'npx', ['--yes', 'esbuild', join(installed, 'mods', 'index.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + bundle], consumer));
if (steps.at(-1).exitCode !== 0) finish(false);

process.env.MM_STATE_DIR = join(tmp, 'state');
process.env.MEMORY_DIR = join(tmp, 'memory');
mkdirSync(process.env.MM_STATE_DIR, { recursive: true });
mkdirSync(join(process.env.MEMORY_DIR, 'skills'), { recursive: true });
const mod = await import(bundle + '?t=' + Date.now());
const fp = mod.__mm.fingerprint('visual_receipt', { url: 'https://www.im8health.com', selectors: ['body', 'main'], viewports: [{ name: 'mobile' }, { name: 'desktop' }] });
const handlers = {};
const letta = {
  capabilities: { tools: true, commands: true, events: { tools: true, lifecycle: true }, ui: { panels: true } },
  events: { on: (name, fn) => { handlers[name] = fn; return () => {}; } },
  tools: { register: () => () => {} }, commands: { register: () => () => {} },
  ui: { openPanel: () => ({ update() {}, close() {} }) }
};
const dispose = mod.default(letta);
handlers.tool_start({ toolName: 'visual_receipt', args: { url: 'https://www.im8health.com', selectors: ['body', 'main'], viewports: [{ name: 'mobile' }, { name: 'desktop' }] }, conversationId: 'consumer-smoke' }, {});
const exp = readFileSync(join(process.env.MM_STATE_DIR, 'experience.jsonl'), 'utf8');
dispose?.();
behavior = {
  fingerprintTemplate: fp.tmpl,
  handlerCapturedTemplate: /visual_receipt im8health\.com 2 viewports 2 selectors/.test(exp)
};
steps.push({ name: 'installed mod high-signal behavior', exitCode: behavior.fingerprintTemplate === 'visual_receipt im8health.com 2 viewports 2 selectors' && behavior.handlerCapturedTemplate ? 0 : 1, durationMs: 0, outputTail: JSON.stringify(behavior, null, 2) });
finish(steps.every((s) => s.exitCode === 0));

function finish(pass) {
  const receipt = { generatedAt: new Date().toISOString(), pass, tmp, tarball: tgz, requiredPresent, behavior, steps: steps.map(({ stdout, ...s }) => s) };
  writeFileSync(join(root, 'package-smoke-result.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ pass, tmp, tarball: tgz, requiredPresent, behavior, steps: receipt.steps.map(s => ({ name: s.name, exitCode: s.exitCode, durationMs: s.durationMs })) }, null, 2));
  process.exit(pass ? 0 : 1);
}
