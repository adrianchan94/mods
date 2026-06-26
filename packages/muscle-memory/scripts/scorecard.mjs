#!/usr/bin/env node
// Generate the single submission scorecard from packaged receipts.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(readFileSync(join(root, f), 'utf8'));
const exists = (f) => existsSync(join(root, f));

const coverage = read('coverage-benchmark-result.json');
const perf = read('perf-improvement-result.json');
const multi = read('benchmark-multidomain-result.json');
const runtime = read('runtime-crush-result.json');
const replicate = read('replicate-workflows-result.json');
const kev = read('kev-domain-dogfood-result.json');
const packageSmoke = exists('package-smoke-result.json') ? read('package-smoke-result.json') : null;
const liveReload = exists('live-reload-dogfood-result.json') ? read('live-reload-dogfood-result.json') : null;
const completeLoop = exists('complete-loop-dogfood-result.json') ? read('complete-loop-dogfood-result.json') : null;
const separateWorkflow = exists('separate-workflow-dogfood-result.json') ? read('separate-workflow-dogfood-result.json') : null;
const catalogPublish = exists('catalog-publish-dogfood-result.json') ? read('catalog-publish-dogfood-result.json') : null;

const multiOurs = typeof multi.avg?.ours === 'number' ? multi.avg.ours : (multi.results.reduce((a,r)=>a+r.ours,0)/multi.results.length);
const multiHermes = typeof multi.avg?.hermes === 'number' ? multi.avg.hermes : (multi.results.reduce((a,r)=>a+r.hermes,0)/multi.results.length);
const multiWins = typeof multi.oursWins === 'number' ? multi.oursWins : multi.results.filter((r)=>r.winner === 'ours').length;
const replicateUpdates = replicate.results.filter((r)=>String(r.route || '').startsWith('UPDATE')).length;
const replicateCreates = replicate.results.filter((r)=>String(r.route || '').startsWith('CREATE')).length;
const requiredArtifacts = [
  'README.md', 'FRONTIER-EVIDENCE.md', 'DOGFOOD-LOG.md', 'PR-BODY-DRAFT.md', 'docs/completion-audit.md',
  'coverage-benchmark-result.json', 'perf-improvement-result.json', 'benchmark-multidomain-result.json',
  'runtime-crush-result.json', 'replicate-workflows-result.json', 'kev-domain-dogfood-result.json',
  'final-gate-result.json', 'package-smoke-result.json', 'live-reload-dogfood-result.json', 'complete-loop-dogfood-result.json', 'separate-workflow-dogfood-result.json', 'catalog-publish-dogfood-result.json', 'docs/kev-domain-dogfood-skill.md'
];

const scorecard = {
  generatedAt: new Date().toISOString(),
  verdict: 'homerun-checkpoint-not-final-submit',
  metrics: {
    pitfallCoverage: {
      ours: coverage.total.ours,
      hermes: coverage.total.hermes,
      total: coverage.total.n,
      multiplier: Number((coverage.total.ours / coverage.total.hermes).toFixed(2))
    },
    runtimeLettaPitfalls: perf.aggregate,
    skillQuality: {
      oursAvg: Number(multiOurs.toFixed(1)),
      hermesAvg: Number(multiHermes.toFixed(1)),
      oursWins: multiWins,
      domains: multi.results.length
    },
    runtimeCrush: { ours: runtime.ours, hermes: runtime.hermes, tasks: runtime.tasks, domain: runtime.domain },
    realWorkflowRouting: { total: replicate.results.length, updates: replicateUpdates, creates: replicateCreates },
    kevDomainDogfood: { legacySignalItems: kev.legacySignalItems, newSignalItems: kev.newSignalItems, uplift: kev.uplift, skill: kev.skill },
    packageSmoke: packageSmoke ? { pass: packageSmoke.pass, handlerCapturedTemplate: packageSmoke.behavior?.handlerCapturedTemplate } : null,
    liveReloadDogfood: liveReload ? { pass: liveReload.pass, stagedUpdateEvidence: liveReload.checks?.stagedUpdateEvidence, duplicateQuarantined: liveReload.checks?.duplicateStagedSkillQuarantined, meshFeedUpdate: liveReload.checks?.meshFeedUpdate } : null,
    completeLoopDogfood: completeLoop ? { pass: completeLoop.pass, updateAutoGraduated: completeLoop.checks?.updateAutoGraduated, handledEvidenceSkipsRepeat: completeLoop.checks?.handledEvidenceSkipsRepeat, highCreateAutoGraduated: completeLoop.checks?.highCreateAutoGraduated, lowCreateStaged: completeLoop.checks?.lowCreateStaged, manualGraduatePromoted: completeLoop.checks?.manualGraduatePromoted, autoPruneRetiredOne: completeLoop.checks?.autoPruneRetiredOne, uiSummaryShowsLifecycle: completeLoop.checks?.uiSummaryShowsLifecycle } : null,
    separateWorkflowDogfood: separateWorkflow ? { pass: separateWorkflow.pass, createdShopifySkill: separateWorkflow.checks?.createdShopifySkill, autoGraduatedActive: separateWorkflow.checks?.autoGraduatedActive, repeatSkippedByWaterline: separateWorkflow.checks?.repeatSkippedByWaterline, uiShowsGraduatedThenSkip: separateWorkflow.checks?.uiShowsGraduatedThenSkip, noStagedModSkill: separateWorkflow.checks?.noStagedModSkill } : null,
    catalogPublishDogfood: catalogPublish ? { pass: catalogPublish.pass, lifecycleToolNoApproval: catalogPublish.checks?.lifecycleToolNoApproval, publishedPortableSkill: catalogPublish.checks?.publishedPortableSkill, copiedOnlySkillMd: catalogPublish.checks?.copiedOnlySkillMd, catalogContentPrivacyClean: catalogPublish.checks?.catalogContentPrivacyClean, blockedPrivateSkill: catalogPublish.checks?.blockedPrivateSkill } : null
  },
  artifacts: Object.fromEntries(requiredArtifacts.map((f)=>[f, exists(f)])),
  caveats: [
    'This is a checkpoint scorecard, not a submitted PR; changes are intentionally uncommitted/unpushed until Adrian says ship it.',
    'Does not claim full IM8 visual validation: mobile/DOM receipt succeeded, desktop annotated screenshot failed and is logged partial.',
    'Current running Kev process needs /reload or fresh launch before live event capture uses the patched high-signal templates.',
    'Model/API benchmark receipts are read from packaged result JSONs; final:gate runs deterministic local gates only.'
  ]
};

const allArtifactsPresent = Object.values(scorecard.artifacts).every(Boolean);
const pass = Boolean(
  scorecard.metrics.pitfallCoverage.ours === 20 && scorecard.metrics.pitfallCoverage.hermes === 7 &&
  scorecard.metrics.runtimeLettaPitfalls.baseline === 33 && scorecard.metrics.runtimeLettaPitfalls.withSkill === 100 &&
  scorecard.metrics.skillQuality.oursAvg > scorecard.metrics.skillQuality.hermesAvg &&
  scorecard.metrics.runtimeCrush.ours > scorecard.metrics.runtimeCrush.hermes &&
  scorecard.metrics.realWorkflowRouting.total === 3 && scorecard.metrics.realWorkflowRouting.updates === 2 && scorecard.metrics.realWorkflowRouting.creates === 1 &&
  scorecard.metrics.kevDomainDogfood.legacySignalItems === 0 && scorecard.metrics.kevDomainDogfood.newSignalItems === 4 &&
  (!scorecard.metrics.packageSmoke || (scorecard.metrics.packageSmoke.pass === true && scorecard.metrics.packageSmoke.handlerCapturedTemplate === true)) &&
  (!scorecard.metrics.liveReloadDogfood || (scorecard.metrics.liveReloadDogfood.pass === true && scorecard.metrics.liveReloadDogfood.stagedUpdateEvidence === true && scorecard.metrics.liveReloadDogfood.duplicateQuarantined === true && scorecard.metrics.liveReloadDogfood.meshFeedUpdate === true)) &&
  (!scorecard.metrics.completeLoopDogfood || (scorecard.metrics.completeLoopDogfood.pass === true && scorecard.metrics.completeLoopDogfood.updateAutoGraduated === true && scorecard.metrics.completeLoopDogfood.handledEvidenceSkipsRepeat === true && scorecard.metrics.completeLoopDogfood.highCreateAutoGraduated === true && scorecard.metrics.completeLoopDogfood.lowCreateStaged === true && scorecard.metrics.completeLoopDogfood.manualGraduatePromoted === true && scorecard.metrics.completeLoopDogfood.autoPruneRetiredOne === true && scorecard.metrics.completeLoopDogfood.uiSummaryShowsLifecycle === true)) &&
  (!scorecard.metrics.separateWorkflowDogfood || (scorecard.metrics.separateWorkflowDogfood.pass === true && scorecard.metrics.separateWorkflowDogfood.createdShopifySkill === true && scorecard.metrics.separateWorkflowDogfood.autoGraduatedActive === true && scorecard.metrics.separateWorkflowDogfood.repeatSkippedByWaterline === true && scorecard.metrics.separateWorkflowDogfood.uiShowsGraduatedThenSkip === true && scorecard.metrics.separateWorkflowDogfood.noStagedModSkill === true)) &&
  (!scorecard.metrics.catalogPublishDogfood || (scorecard.metrics.catalogPublishDogfood.pass === true && scorecard.metrics.catalogPublishDogfood.publishedPortableSkill === true && scorecard.metrics.catalogPublishDogfood.copiedOnlySkillMd === true && scorecard.metrics.catalogPublishDogfood.catalogContentPrivacyClean === true && scorecard.metrics.catalogPublishDogfood.blockedPrivateSkill === true)) && allArtifactsPresent
);
scorecard.pass = pass;
writeFileSync(join(root, 'homerun-scorecard-result.json'), JSON.stringify(scorecard, null, 2));

const md = `# muscle-memory HOMERUN scorecard\n\nGenerated: ${scorecard.generatedAt}\n\n## Verdict\n\n**${pass ? 'PASS' : 'CHECK'} — homerun checkpoint, not final submitted PR.**\n\nThis scorecard is generated from packaged receipts, not chat memory. It proves the mod now has numbers for Hermes comparison, runtime improvement, real-work routing, Kev-domain dogfood, and consumer-package smoke. \`final-gate-result.json\` is the separate source of truth for the current final gate/pack check.\n\n## Numbers\n\n| lane | result | receipt |\n|---|---:|---|\n| Pitfall coverage vs Hermes | **${coverage.total.ours}/${coverage.total.n} vs ${coverage.total.hermes}/${coverage.total.n} (${scorecard.metrics.pitfallCoverage.multiplier}×)** | \`coverage-benchmark-result.json\` |\n| Runtime lift on Letta-specific tasks | **${perf.aggregate.baseline}% → ${perf.aggregate.withSkill}% (+${perf.aggregate.lift} pts)** | \`perf-improvement-result.json\` |\n| Skill-quality benchmark | **${scorecard.metrics.skillQuality.oursAvg} vs ${scorecard.metrics.skillQuality.hermesAvg}; ${multiWins}/${multi.results.length} domains won** | \`benchmark-multidomain-result.json\` |\n| Runtime crush task set | **${runtime.ours}/${runtime.tasks} vs ${runtime.hermes}/${runtime.tasks}** | \`runtime-crush-result.json\` |\n| Real workflow routing | **${replicateUpdates} UPDATE / ${replicateCreates} CREATE across ${replicate.results.length} workflows** | \`replicate-workflows-result.json\` |\n| Kev-domain operator dogfood | **legacy ${kev.legacySignalItems} → upgraded ${kev.newSignalItems} signals (+${kev.uplift})** | \`kev-domain-dogfood-result.json\` |\n| Package consumer smoke | **${scorecard.metrics.packageSmoke?.pass ? 'PASS' : 'n/a'}; handler capture ${scorecard.metrics.packageSmoke?.handlerCapturedTemplate ? 'PASS' : 'n/a'}** | \`package-smoke-result.json\` |\n| Live reload dogfood | **${scorecard.metrics.liveReloadDogfood?.pass ? 'PASS' : 'n/a'}; staged update ${scorecard.metrics.liveReloadDogfood?.stagedUpdateEvidence ? 'PASS' : 'n/a'}; duplicate quarantine ${scorecard.metrics.liveReloadDogfood?.duplicateQuarantined ? 'PASS' : 'n/a'}** | \`live-reload-dogfood-result.json\` |
| Complete-loop dogfood | **${scorecard.metrics.completeLoopDogfood?.pass ? 'PASS' : 'n/a'}; graduate/stage/prune/UI/anti-stuck ${scorecard.metrics.completeLoopDogfood?.uiSummaryShowsLifecycle && scorecard.metrics.completeLoopDogfood?.handledEvidenceSkipsRepeat ? 'PASS' : 'n/a'}** | \`complete-loop-dogfood-result.json\` |
| Separate workflow dogfood | **${scorecard.metrics.separateWorkflowDogfood?.pass ? 'PASS' : 'n/a'}; Shopify visual lane ${scorecard.metrics.separateWorkflowDogfood?.createdShopifySkill && scorecard.metrics.separateWorkflowDogfood?.noStagedModSkill ? 'PASS' : 'n/a'}** | \`separate-workflow-dogfood-result.json\` |
| Catalog publish dogfood | **${scorecard.metrics.catalogPublishDogfood?.pass ? 'PASS' : 'n/a'}; privacy-clean SKILL.md-only ${scorecard.metrics.catalogPublishDogfood?.catalogContentPrivacyClean && scorecard.metrics.catalogPublishDogfood?.copiedOnlySkillMd ? 'PASS' : 'n/a'}** | \`catalog-publish-dogfood-result.json\` |\n\n## Generated skill proof\n\nKev-domain dogfood generated **\`${kev.skill}\`** from Shopify/no-cap/claims receipt evidence. Artifact: \`docs/kev-domain-dogfood-skill.md\`.\n\n## Artifact checklist\n\n${Object.entries(scorecard.artifacts).map(([f, ok]) => `- ${ok ? '✅' : '❌'} \`${f}\``).join('\n')}\n\n## Caveats / no-cap\n\n${scorecard.caveats.map((c)=>`- ${c}`).join('\n')}\n`;
writeFileSync(join(root, 'HOMERUN-SCORECARD.md'), md);
console.log(JSON.stringify({ pass, metrics: scorecard.metrics, artifactsPresent: allArtifactsPresent }, null, 2));
if (!pass) process.exit(1);
