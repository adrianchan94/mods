#!/usr/bin/env node
// Regression test for the AUTONOMOUS turn_end nudge (the headline capability): muscle-memory must
// distill on its own after a turn — fire when MM_REFLECT is on + a mature pattern emerged, stay silent
// when off, and dedupe an already-handled signature. Mocks the Letta event system + asserts via the ledger.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const STATE = join(tmpdir(), 'mm-pkg-auton-' + process.pid);
const SCOPE = join(STATE, 'agent');
mkdirSync(join(SCOPE, 'skills'), { recursive: true });
process.env.MM_STATE_DIR = STATE;
process.env.MEMORY_DIR = SCOPE;

const OUT = join(tmpdir(), 'mm-pkg-auton-' + process.pid + '.mjs');
execFileSync('npx', ['--yes', 'esbuild', join(here, '..', 'mods', 'index.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + OUT], { stdio: 'pipe' });
const mod = await import(OUT + '?t=' + Date.now());

// seed mature evidence: 3 sessions x 3 durable repair chains (distinct fix verbs)
const P = [['Edit', 'Edit f.sh', 'a filename with spaces split into separate arguments and clobbered the wrong file'],
           ['Bash', 'sed -i s/a/b/ f.sh', 'two items shared a key so one silently overwrote the other'],
           ['Bash', 'patch f.sh fix.diff', 'only matched one extension and skipped the rest']];
const exp = [], out = []; let i = 0; const cmd = 'bash f.sh dir';
for (const c of ['mon', 'tue', 'wed']) for (const [t, m, e] of P) {
  const a = `${c}-${i++}`; exp.push({ ts: i, conv: c, tool: 'Bash', tmpl: cmd, id: a }); out.push({ id: a, conv: c, tool: 'Bash', ok: false, err: e, ts: i });
  const x = `${c}-${i++}`; exp.push({ ts: i, conv: c, tool: t, tmpl: m, id: x }); out.push({ id: x, conv: c, tool: t, ok: true, ts: i });
  const p = `${c}-${i++}`; exp.push({ ts: i, conv: c, tool: 'Bash', tmpl: cmd, id: p }); out.push({ id: p, conv: c, tool: 'Bash', ok: true, ts: i });
}
writeFileSync(join(STATE, 'experience.jsonl'), exp.map((r) => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(join(STATE, 'outcomes.jsonl'), out.map((r) => JSON.stringify(r)).join('\n') + '\n');

const handlers = {};
const letta = {
  capabilities: { events: { lifecycle: true }, ui: { panels: false }, commands: false, tools: false },
  events: { on: (name, fn) => { handlers[name] = fn; return () => {}; } },
  ui: {}, tools: { register: () => {} }, commands: { register: () => {} },
};
mod.default(letta);

const fired = () => existsSync(join(STATE, 'ui-events.jsonl')) && readFileSync(join(STATE, 'ui-events.jsonl'), 'utf8').includes('review_started');
const clear = () => { try { rmSync(join(STATE, 'ui-events.jsonl')); } catch {} };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const checks = [];
const ok = (name, pass) => checks.push({ name, pass });

ok('turn_end handler registered by activate()', typeof handlers.turn_end === 'function');
if (typeof handlers.turn_end === 'function') {
  clear(); delete process.env.MM_REFLECT;
  await handlers.turn_end({ agentId: 'demo' }, {}); await wait(400);
  ok('MM_REFLECT off -> autonomous nudge stays silent', !fired());

  clear(); process.env.MM_REFLECT = 'auto';
  await handlers.turn_end({ agentId: 'demo' }, {}); await wait(800);
  ok('MM_REFLECT=auto + mature -> distills autonomously (no command)', fired());

  clear();
  await handlers.turn_end({ agentId: 'demo' }, {}); await wait(500);
  ok('already-handled signature -> deduped (no re-review)', !fired());
}

for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}`);
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} autonomy checks`);
process.exit(failed.length ? 1 : 0);
