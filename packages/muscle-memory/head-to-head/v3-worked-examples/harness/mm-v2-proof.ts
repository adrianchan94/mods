// PROOF: with MM_CAPTURE worked-examples, does mm restore breadth (no collapse) + author concretely?
import { writeFileSync } from "node:fs";
import { __mm } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
import type { Row } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";

const { classifyError, redactFragment, buildCrossConversationEvidence, detectRepairChains, reviewAndAuthor, detect, draftWithRepair, inferOutcomes } = __mm;
const KEY = process.env.ZAI_KEY ?? "";
const BASE = "https://api.z.ai/api/coding/paas/v4";

function content(data: unknown): string {
  if (!data || typeof data !== "object" || !("choices" in data)) return "";
  const ch = data.choices;
  if (!Array.isArray(ch) || ch.length === 0) return "";
  const f: unknown = ch[0];
  if (!f || typeof f !== "object" || !("message" in f)) return "";
  const m = f.message;
  if (!m || typeof m !== "object" || !("content" in m)) return "";
  const c = m.content;
  return typeof c === "string" ? c : "";
}
async function author(system: string, user: string): Promise<string> {
  const r = await fetch(`${BASE}/chat/completions`, { method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "glm-5.2", messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: 4000 }) });
  return content(await r.json());
}

let ts = 1_700_000_000_000;
// Simulate MM_CAPTURE=worked: the fail row carries a redacted real error; the Edit row a redacted diff.
function fail(conv: string, errText: string): Row { ts += 1000; return { conv, tool: "Bash", tmpl: "pytest -q", fp: "Bash::pytest -q", h: `f${ts}`, ok: false, err: classifyError(errText, false), errMsg: redactFragment(errText, 8, 320), ts }; }
function edit(conv: string, file: string, oldS: string, newS: string): Row { ts += 1000; const fix = `- ${redactFragment(oldS,6,200)}\n+ ${redactFragment(newS,6,200)}`; return { conv, tool: "Edit", tmpl: `Edit <path>.py`, fp: `Edit::${file}`, h: `e${ts}`, ok: true, fix, ts }; }
function pass(conv: string): Row { ts += 1000; return { conv, tool: "Bash", tmpl: "pytest -q", fp: "Bash::pytest -q", h: `p${ts}`, ok: true, ts }; }

// 4 genuinely DIFFERENT bugs of the same class.
const bugs: Array<[string, string, string, string, string]> = [
  ["c1", "calc.py",    "AssertionError: assert add(2, 3) == 5, got -1",                 "return a - b", "return a + b"],
  ["c2", "parser.py",  "IndexError: list index out of range",                          "for i in range(len(xs) + 1):", "for i in range(len(xs)):"],
  ["c3", "handler.py", "AssertionError: assert handle(x) == 42, got None",             "result = compute(x)", "return compute(x)"],
  ["c4", "config.py",  "AssertionError: assert mode == 'prod', got 'PROD'",            "mode = raw", "mode = raw.lower()"],
];
const rows: Row[] = bugs.flatMap(([c, file, err, o, n]) => [fail(c, err), edit(c, file, o, n), pass(c)]);
import { mkdirSync as _mkdir, writeFileSync as _wf } from "node:fs";
const _STATE = process.env.MM_STATE_DIR as string; _mkdir(_STATE, { recursive: true }); _wf(`${_STATE}/experience.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

const reps = detectRepairChains(rows);
console.log("=== BREADTH CHECK ===");
console.log("repair chains:", reps.length, "| worked examples on chain[0]:", reps[0]?.worked?.length ?? 0);
for (const w of (reps[0]?.worked ?? [])) console.log("  ·", (w.errMsg ?? "").slice(0, 70), "=>", (w.fix ?? "").replace(/\n/g, " "));

const ev = buildCrossConversationEvidence(rows);
console.log("\n=== EVIDENCE DIGEST (what the author model now sees) ===\n" + ev.digest);

// deterministic draft (now with worked examples)
const cand = detect(inferOutcomes(rows)).candidates[0];
const rep = reps.find((x) => x.verifyStep === cand?.key || (cand && cand.key.includes(x.verifyStep))) ?? reps[0];
const det = draftWithRepair(cand, rep);
writeFileSync("/tmp/h2h/mm-skills/failing-test.v2.det.md", `---\nname: ${det.name}\ndescription: ${det.description}\n---\n\n${det.body}\n`);

// model-authored (does it still decline?)
const res = await reviewAndAuthor(ev.digest, ["/tmp/h2h/mm-empty-skills"], author);
console.log("\n=== MODEL-AUTHORED ===\naction:", res.action, res.reason ?? "");
if (res.content) writeFileSync("/tmp/h2h/mm-skills/failing-test.v2.model.md", res.content);
console.log("det skill bytes:", det.body.length, "| model skill:", res.content ? res.content.length + " bytes" : "(none)");
