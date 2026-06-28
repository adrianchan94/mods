// muscle-memory's DETERMINISTIC shipped draft per class (what graduates headless, no model).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { __mm } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
import type { Row } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";

const { classifyError, detect, detectRepairChains, draftWithRepair, draftSkillFromCandidate, inferOutcomes } = __mm;

const OUT = "/tmp/h2h/mm-skills";
mkdirSync(OUT, { recursive: true });

let ts = 1_700_000_000_000;
function R(conv: string, tool: string, tmpl: string, ok: boolean | undefined, errText?: string): Row {
  ts += 1000;
  const err = ok === false ? classifyError(errText ?? "", false) : null;
  return { conv, tool, tmpl, fp: `${tool}::${tmpl}`, h: `${tool}::${tmpl}::${ts}`, ok, err, ts };
}

const classes: Record<string, Row[]> = {
  "failing-test": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "pytest -q", false, "E   assert add(2, 3) == 5\nE   assertion error: -1 != 5"),
    R(c, "Edit", "calc.py", true),
    R(c, "Bash", "pytest -q", true),
  ]),
  "lint": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "pyflakes service.py", false, "service.py:11:11 undefined name 'reuslt'"),
    R(c, "Edit", "service.py", true),
    R(c, "Bash", "pyflakes service.py", true),
  ]),
  "npm": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "node app.js", false, "Error: Cannot find module 'lodash'"),
    R(c, "Bash", "npm install lodash", true),
    R(c, "Bash", "node app.js", true),
  ]),
};

for (const [cls, rows] of Object.entries(classes)) {
  const exp = inferOutcomes(rows);
  const cand = detect(exp).candidates[0];
  if (!cand) { console.log(`${cls}: no candidate`); continue; }
  const rep = detectRepairChains(exp).find((x) => x.verifyStep === cand.key || cand.key.includes(x.verifyStep) || x.trigger === cand.key.split(/\s*→\s*/)[0]);
  const draft = cand.fixes ? draftWithRepair(cand, rep) : draftSkillFromCandidate(cand);
  const content = `---\nname: ${draft.name}\ndescription: ${draft.description}\n---\n\n${draft.body}\n`;
  writeFileSync(join(OUT, `${cls}.det.md`), content);
  console.log(`\n===== ${cls} (deterministic) =====\nname: ${draft.name}\nfixes=${cand.fixes}\n${content.split("\n").slice(0, 14).join("\n")}`);
}
