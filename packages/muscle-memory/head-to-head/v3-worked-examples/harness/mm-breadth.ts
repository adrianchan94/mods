// Does mm's cross-session breadth survive fingerprinting? 4 DIVERSE failing-test bugs.
import { __mm } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
import type { Row } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";

const { classifyError, buildCrossConversationEvidence, detectRepairChains } = __mm;
let ts = 1_700_000_000_000;
function R(conv: string, tool: string, tmpl: string, ok: boolean | undefined, e?: string): Row {
  ts += 1000; return { conv, tool, tmpl, fp: `${tool}::${tmpl}`, h: `${tool}::${tmpl}::${ts}`, ok, err: ok === false ? classifyError(e ?? "", false) : null, ts };
}
// 4 genuinely DIFFERENT bugs, different files, different root causes — but all "pytest fail -> edit -> pass".
const bugs = [
  ["c1", "calc.py",    "AssertionError: assert add(2,3) == 5, got -1"],          // wrong operator
  ["c2", "parser.py",  "IndexError: list index out of range"],                    // off-by-one
  ["c3", "handler.py", "AssertionError: assert handle(x) == 42, got None"],       // missing return
  ["c4", "config.py",  "AssertionError: assert mode == 'prod', got 'PROD'"],      // case mismatch
];
const rows: Row[] = bugs.flatMap(([c, file, err]) => [
  R(c, "Bash", "pytest -q", false, err),
  R(c, "Edit", file, true),
  R(c, "Bash", "pytest -q", true),
]);
const reps = detectRepairChains(rows);
const ev = buildCrossConversationEvidence(rows);
console.log("distinct repair chains mm sees:", reps.length);
for (const r of reps) console.log(`  - "${r.trigger}" (${r.errClass}) -> "${r.fixStep}" [${r.count}x/${r.convs} convs]`);
console.log("\nEVIDENCE DIGEST mm hands the author model:\n" + ev.digest);
