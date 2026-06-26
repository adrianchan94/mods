#!/usr/bin/env node
// Deterministic publish dogfood: active MemFS skill -> global catalog mirror, privacy-clean SKILL.md only.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = mkdtempSync(join(tmpdir(), 'mm-catalog-publish-'));
const mem = join(state, 'mem');
const skills = join(mem, 'skills');
const catalog = join(state, 'global-skills');
process.env.MM_STATE_DIR = state;
process.env.MEMORY_DIR = mem;
process.env.MM_GLOBAL_SKILLS_DIR = catalog;
mkdirSync(skills, { recursive: true });
const bundle = join(state, 'mod-bundle.mjs');
execFileSync('npx', ['--yes', 'esbuild', join(root, 'mods', 'index.ts'), '--bundle', '--platform=node', '--format=esm', '--outfile=' + bundle], { stdio: 'pipe' });
const imported = await import(pathToFileURL(bundle).href + '?t=' + Date.now());
const M = imported.__mm;
const activate = imported.default;
function writeSkill(name, body) { M.writeSkill(skills, name, body); }
function readJsonl(path) { if (!existsSync(path)) return []; return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l)=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean); }
const portable = `---\nname: validating-portable-catalog-skills\ndescription: Use when validating whether a learned skill is portable, privacy-clean, and safe to mirror into a visible custom skill catalog.\n---\n\n## When to use\n- Before publishing a learned skill into a global custom skill catalog.\n## Procedure\n1. Check portability and privacy.\n2. Publish only SKILL.md, not evidence receipts.\n## Pitfalls\n- Do not publish private paths, internal hosts, secrets, or agent-specific receipts.\n## Verification\n- Catalog root contains SKILL.md only and no references/evidence folder.\n<!-- muscle-memory provenance: catalog publish dogfood -->\n`;
writeSkill('validating-portable-catalog-skills', portable);
mkdirSync(join(skills, 'validating-portable-catalog-skills', 'references', 'evidence'), { recursive: true });
writeFileSync(join(skills, 'validating-portable-catalog-skills', 'references', 'evidence', 'private.json'), JSON.stringify({ private: '/Users/example/secret' }));
const registered = [];
const disposers = [];
const mockLetta = { capabilities: { tools: true, commands: true, events: { tools: true, lifecycle: true }, ui: { panels: true } }, events: { on: () => () => {} }, commands: { register: () => () => {} }, tools: { register: (t) => { registered.push(t); return () => {}; } }, ui: { openPanel: () => ({ update() {}, close() {} }), closePanel() {} } };
disposers.push(activate(mockLetta));
const lifecycle = registered.find((t) => t.name === 'muscle_memory_lifecycle_run');
const published = await lifecycle.run({ args: { action: 'publish', name: 'validating-portable-catalog-skills' } });
writeSkill('private-publish-blocked', `---\nname: private-publish-blocked\ndescription: Use when testing catalog publish privacy blocks for local machine paths.\n---\n\n## Procedure\n1. Read /Users/chan2saucy/private/path\n## Verification\n- blocked\n<!-- muscle-memory provenance: private publish dogfood -->\n`);
const blocked = await lifecycle.run({ args: { action: 'publish', name: 'private-publish-blocked' } });
for (const d of disposers) try { if (typeof d === 'function') d(); } catch {}
const uiEvents = readJsonl(join(state, 'ui-events.jsonl'));
const feed = M.loadMeshFeed(20);
const catalogSkill = join(catalog, 'validating-portable-catalog-skills', 'SKILL.md');
const receipt = {
  generatedAt: new Date().toISOString(),
  pass: true,
  checks: {
    lifecycleToolNoApproval: lifecycle?.requiresApproval === false,
    publishedPortableSkill: /published 'validating-portable-catalog-skills'/.test(String(published)) && existsSync(catalogSkill),
    copiedOnlySkillMd: !existsSync(join(catalog, 'validating-portable-catalog-skills', 'references')),
    catalogContentPrivacyClean: !/\/Users\//.test(readFileSync(catalogSkill, 'utf8')),
    blockedPrivateSkill: String(blocked?.content || blocked).includes('privacy blocked') && !existsSync(join(catalog, 'private-publish-blocked', 'SKILL.md')),
    uiPublishedEvent: uiEvents.some((e) => e.phase === 'skill_published' && e.skill === 'validating-portable-catalog-skills'),
    meshPublishedEvent: feed.some((e) => e.type === 'skill_published' && e.skill === 'validating-portable-catalog-skills')
  },
  observed: { published: String(published), blocked, catalogSkill, uiEvents: uiEvents.slice(-8), feed: feed.slice(-8) }
};
receipt.pass = Object.values(receipt.checks).every(Boolean);
writeFileSync(join(root, 'catalog-publish-dogfood-result.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ pass: receipt.pass, checks: receipt.checks, observed: { published: String(published), blocked: blocked?.content || String(blocked), catalogSkill } }, null, 2));
if (!receipt.pass) process.exit(1);
