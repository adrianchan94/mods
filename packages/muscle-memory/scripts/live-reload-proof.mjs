#!/usr/bin/env node
// Local live dogfood receipt: verifies current-process post-/reload proof from Kev's muscle-memory state.
// This is intentionally a local receipt (not a portable package gate): it proves the running process loaded
// the patched mod, that live reflect updated a staged skill instead of creating another sibling,
// and that the pre-fix duplicate staged candidate was quarantined after review.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = join(homedir(), '.letta', 'muscle-memory');
const staged = join(state, 'staged');
function jsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const experience = jsonl(join(state, 'experience.jsonl'));
const mesh = jsonl(join(homedir(), '.local', 'state', 'mesh-skill-feed.jsonl'));
const stagedSkills = ['validating-letta-code-mod-packages', 'validating-letta-mod-packages'].filter((n) => existsSync(join(staged, n, 'SKILL.md')));
const retiredDir = join(state, 'staged-retired');
const retiredDuplicate = existsSync(retiredDir) ? (await import('node:fs')).readdirSync(retiredDir).some((n) => n.startsWith('validating-letta-mod-packages-') && existsSync(join(retiredDir, n, 'SKILL.md'))) : false;
const evidenceDir = join(staged, 'validating-letta-code-mod-packages', 'references', 'evidence');
const evidence = existsSync(evidenceDir)
  ? (await import('node:fs')).readdirSync(evidenceDir).filter((f) => f.endsWith('.json')).map((f) => {
      try { return JSON.parse(readFileSync(join(evidenceDir, f), 'utf8')); } catch { return null; }
    }).filter(Boolean)
  : [];
const highSignalRows = experience.filter((r) => ['visual_receipt', 'repo_radar_evidence'].includes(r.tool) && r.tmpl).slice(-10);
const visualRow = highSignalRows.find((r) => r.tmpl === 'visual_receipt example.com 1 viewports 2 selectors');
const radarRow = highSignalRows.find((r) => r.tmpl === 'repo_radar_evidence live-reload-high-signal-probe');
const updateEvidence = evidence.slice().reverse().find((e) => e.action === 'update' && e.skill === 'validating-letta-code-mod-packages' && e.updateTarget === 'validating-letta-code-mod-packages' && e.sources?.durableSignals >= 12);
const meshUpdate = mesh.slice(-50).find((e) => e.type === 'skill_updated' && e.skill === 'validating-letta-code-mod-packages' && e.route === 'UPDATE' && e.signals >= 12);
const pass = Boolean(visualRow && radarRow && stagedSkills.length === 1 && stagedSkills[0] === 'validating-letta-code-mod-packages' && retiredDuplicate && updateEvidence && meshUpdate);
const receipt = {
  generatedAt: new Date().toISOString(),
  pass,
  state,
  checks: {
    highSignalVisualTemplate: Boolean(visualRow),
    highSignalRepoRadarTemplate: Boolean(radarRow),
    stagedQueueCleanedToOneKeeper: stagedSkills.length === 1 && stagedSkills[0] === 'validating-letta-code-mod-packages',
    duplicateStagedSkillQuarantined: retiredDuplicate,
    stagedUpdateEvidence: Boolean(updateEvidence),
    meshFeedUpdate: Boolean(meshUpdate)
  },
  observed: {
    highSignalRows,
    stagedSkills,
    retiredDuplicate,
    updateEvidence: updateEvidence ? {
      ts: updateEvidence.ts,
      action: updateEvidence.action,
      skill: updateEvidence.skill,
      updateTarget: updateEvidence.updateTarget,
      sources: updateEvidence.sources,
      memfsHits: updateEvidence.memfsHits,
      oldHash: updateEvidence.oldHash,
      newHash: updateEvidence.newHash
    } : null,
    meshUpdate: meshUpdate || null
  },
  caveat: 'Local Kev live-state receipt; not a portable package install gate. Portable package behavior is covered by package-smoke-result.json.'
};
writeFileSync(join(root, 'live-reload-dogfood-result.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ pass, checks: receipt.checks, stagedSkills,
    retiredDuplicate, updateEvidence: receipt.observed.updateEvidence, meshUpdate: receipt.observed.meshUpdate }, null, 2));
if (!pass) process.exit(1);
