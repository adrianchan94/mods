import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const temp = mkdtempSync(join(tmpdir(), 'muscle-memory-demo-'));
const home = join(temp, 'home');
const memory = join(temp, 'memory');
mkdirSync(join(home, '.letta', 'muscle-memory'), { recursive: true });
mkdirSync(join(memory, 'skills'), { recursive: true });

// Seed a tiny experience log that mimics repeated real work: edit a memory doc, stage it, repeat across conversations.
const rows = [
  { ts: 1, conv: 'session-a', tool: 'Edit', fp: 'Edit(file_path,new_string,old_string) :: Edit <path>.md', tmpl: 'Edit <path>.md', ok: true },
  { ts: 2, conv: 'session-a', tool: 'Bash', fp: 'Bash(command) :: git add skills<path>', tmpl: 'git add skills<path>', ok: true },
  { ts: 3, conv: 'session-a', tool: 'Edit', fp: 'Edit(file_path,new_string,old_string) :: Edit <path>.md', tmpl: 'Edit <path>.md', ok: true },
  { ts: 4, conv: 'session-a', tool: 'Bash', fp: 'Bash(command) :: git add skills<path>', tmpl: 'git add skills<path>', ok: true },
  { ts: 5, conv: 'session-b', tool: 'Edit', fp: 'Edit(file_path,new_string,old_string) :: Edit <path>.md', tmpl: 'Edit <path>.md', ok: true },
  { ts: 6, conv: 'session-b', tool: 'Bash', fp: 'Bash(command) :: git add skills<path>', tmpl: 'git add skills<path>', ok: true },
  { ts: 7, conv: 'session-c', tool: 'Bash', fp: 'Bash(command) :: npm run build', tmpl: 'npm run build', ok: false },
  { ts: 8, conv: 'session-c', tool: 'Bash', fp: 'Bash(command) :: npm run build', tmpl: 'npm run build', ok: true },
  { ts: 9, conv: 'session-d', tool: 'Bash', fp: 'Bash(command) :: npm run build', tmpl: 'npm run build', ok: true }
];
writeFileSync(join(home, '.letta', 'muscle-memory', 'experience.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

// Make this process use the temp HOME/MEMORY_DIR before importing the bundled mod.
process.env.HOME = home;
process.env.MEMORY_DIR = memory;

const mod = await import('/tmp/muscle-memory-package-demo.mjs?t=' + Date.now());
const registered = {};
mod.default({
  capabilities: { tools: true, commands: false, events: { tools: false, lifecycle: false } },
  tools: { register(spec) { registered[spec.name] = spec; return () => {}; } },
});
const readTool = registered.muscle_memory_skill_read;
const writeTool = registered.muscle_memory_skill_write;
if (!readTool || !writeTool) throw new Error('expected read/write tools');
async function read(args) { return await readTool.run({ args, agent: { id: 'demo-agent' } }); }
async function write(args) { return await writeTool.run({ args, agent: { id: 'demo-agent' } }); }

const candidates = await read({ action: 'candidates' });
const draft = await read({ action: 'draft', candidate_key: 'Edit.md' });
const created = await write({ action: 'create_from_candidate', candidate_key: 'Edit.md' });
const loaded = await read({ action: 'load', name: draft.name });
const refined = await write({
  action: 'patch',
  name: draft.name,
  old: '- Patch this skill in place when a step is too vague, stale, or misses a failure mode.',
  replacement: '- After loading and using this skill through the normal Skill tool, patch it in place immediately if a step was too vague, stale, or misses a failure mode.',
});
const loadedAfterPatch = await read({ action: 'load', name: draft.name });
// Simulate the normal Skill-tool use event a real agent would create after loading the skill.
rows.push({ ts: 10, conv: 'session-demo', tool: 'Skill', fp: `Skill(skill) :: Skill ${draft.name}`, tmpl: `Skill ${draft.name}`, ok: true });
writeFileSync(join(home, '.letta', 'muscle-memory', 'experience.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const curate = await read({ action: 'curate' });
const skillPath = join(memory, 'skills', draft.name, 'SKILL.md');

console.log('muscle-memory demo');
console.log('temp:', temp);
console.log('\nCandidates:\n' + candidates);
console.log('\nDrafted skill:', draft.name);
console.log(String(created));
console.log('Refined:', String(refined));
console.log('Patch verified:', String(loadedAfterPatch).includes('After loading and using this skill through the normal Skill tool') ? 'yes' : 'no');
console.log('\nCurate:\n' + curate);
console.log('\nSkill path:', skillPath);
console.log('\nSkill excerpt:\n' + readFileSync(skillPath, 'utf8').split('\n').slice(0, 28).join('\n'));

if (!existsSync(skillPath) || !String(loaded).includes('muscle-memory provenance') || !String(loadedAfterPatch).includes('After loading and using this skill through the normal Skill tool') || !String(curate).includes('uses=1')) {
  console.error('demo failed');
  process.exit(1);
}
