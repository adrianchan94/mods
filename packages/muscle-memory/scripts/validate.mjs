const mod = await import('/tmp/muscle-memory-package-test.mjs?t=' + Date.now());
const mm = mod.__mm;
const checks = [];
function ok(name, cond) { checks.push({ name, pass: Boolean(cond) }); }

const redacted = mm.commandTemplate('curl -H "Authorization: Bearer demo" # bearer api key token password');
ok('secret labels scrubbed', !/bearer|authorization|api\s*key|api[_-]?key|token|password|sk-/i.test(redacted));
const assignSecretCmd = 'TO' + 'KEN=' + 'abc' + '123' + ' MY_' + 'API_' + 'KEY=' + 'short npm test';
const querySecretCmd = 'curl https://x.test?a=1&' + 'to' + 'ken=' + 'abc' + '123' + ' --api-' + 'key ' + 'xyz';
ok('secret assignment values scrubbed', !/abc123|short/.test(mm.commandTemplate(assignSecretCmd)));
ok('query and flag secret values scrubbed', !/abc123|xyz/.test(mm.commandTemplate(querySecretCmd)));
const execFp = mm.fingerprint('exec_command', { cmd: 'cd /tmp/example && npm run validate' });
ok('exec_command(cmd) templated', execFp.tmpl && execFp.tmpl.includes('npm run validate') && !execFp.tmpl.includes('/tmp/example'));


const visualFp = mm.fingerprint('visual_receipt', { url: 'https://www.im8health.com', selectors: ['body','main'], viewports: [{name:'mobile'}, {name:'desktop'}] });
ok('visual_receipt high-signal templated', visualFp.tmpl === 'visual_receipt im8health.com 2 viewports 2 selectors');
const claimsFp = mm.fingerprint('im8_claims_lint', { text: '1 Serving Protects 9 Organ Systems', files: [] });
ok('im8_claims_lint high-signal templated', claimsFp.tmpl === 'im8_claims_lint supplement-copy 0 files');

const rows = [
  { ts: 1, conv: 'a', tool: 'Edit', tmpl: 'Edit <path>.md', ok: true },
  { ts: 2, conv: 'a', tool: 'Bash', tmpl: 'git add skills<path>', ok: true },
  { ts: 3, conv: 'a', tool: 'Edit', tmpl: 'Edit <path>.md', ok: true },
  { ts: 4, conv: 'a', tool: 'Bash', tmpl: 'git add skills<path>', ok: true },
  { ts: 5, conv: 'b', tool: 'Edit', tmpl: 'Edit <path>.md', ok: true },
  { ts: 6, conv: 'b', tool: 'Bash', tmpl: 'git add skills<path>', ok: true },
  { ts: 7, conv: 'c', tool: 'Bash', tmpl: 'npm run build', ok: false },
  { ts: 8, conv: 'c', tool: 'Bash', tmpl: 'npm run build', ok: true },
  { ts: 9, conv: 'd', tool: 'Bash', tmpl: 'npm run build', ok: true }
];
const det = mm.detect(rows);
ok('detects mature candidates', det.candidates.length >= 2);
ok('detects edit-to-git-add sequence', det.candidates.some(c => c.key === 'Edit.md → git add'));
ok('detects fix pattern', det.templates.some(c => c.key === 'npm run build' && c.fixes >= 1 && c.mature));
const draft = mm.draftSkillFromCandidate(det.candidates.find(c => c.key === 'Edit.md → git add'));
ok('draft includes observed pattern', /Observed pattern/.test(draft.body) && /Edit.md → git add/.test(draft.body));
ok('candidate name slugged', draft.name === 'md-to-git-add-workflow');
ok('curation helper exported', typeof mm.curateManagedSkills === 'function');

for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}`);
const failed = checks.filter(c => !c.pass);
if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} checks failed`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} checks passed`);
