import { writeFileSync, mkdirSync } from "node:fs";
import { __mm } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
import type { Row } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";

const { classifyError, redactFragment, buildCrossConversationEvidence, reviewAndAuthor } = __mm;
const KEY = process.env.ZAI_KEY ?? ""; const BASE = "https://api.z.ai/api/coding/paas/v4";
function content(data: unknown): string {
  if (!data || typeof data !== "object" || !("choices" in data)) return "";
  const ch = data.choices; if (!Array.isArray(ch) || ch.length === 0) return "";
  const f: unknown = ch[0]; if (!f || typeof f !== "object" || !("message" in f)) return "";
  const m = f.message; if (!m || typeof m !== "object" || !("content" in m)) return "";
  const c = m.content; return typeof c === "string" ? c : "";
}
async function author(system: string, user: string): Promise<string> {
  const r = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "glm-5.2", messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: 4000 }) });
  return content(await r.json());
}
let ts = 1_700_000_000_000;
function fail(conv: string, e: string): Row { ts += 1000; return { conv, tool: "Bash", tmpl: "pyflakes app.py", fp: "Bash::pyflakes app.py", h: `f${ts}`, ok: false, err: classifyError(e, false), errMsg: redactFragment(e, 8, 320), ts }; }
function edit(conv: string, o: string, n: string): Row { ts += 1000; return { conv, tool: "Edit", tmpl: "Edit <path>.py", fp: "Edit::app.py", h: `e${ts}`, ok: true, fix: `- ${redactFragment(o,6,200)}\n+ ${redactFragment(n,6,200)}`, ts }; }
function pass(conv: string): Row { ts += 1000; return { conv, tool: "Bash", tmpl: "pyflakes app.py", fp: "Bash::pyflakes app.py", h: `p${ts}`, ok: true, ts }; }

const bugs: Array<[string, string, string, string]> = [
  ["c1", "service.py:11 undefined name 'reuslt'",            "print(reuslt)",        "print(result)"],
  ["c2", "utils.py:1 'os' imported but unused",              "import os",            ""],
  ["c3", "api.py:7 local variable 'tmp' assigned but never used", "tmp = compute()",  "return compute()"],
  ["c4", "models.py:3 redefinition of unused 'json' from line 1", "import json\nimport json", "import json"],
];
const rows: Row[] = bugs.flatMap(([c, e, o, n]) => [fail(c, e), edit(c, o, n), pass(c)]);
const STATE = process.env.MM_STATE_DIR as string; mkdirSync(STATE, { recursive: true });
writeFileSync(`${STATE}/experience.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
const ev = buildCrossConversationEvidence(rows);
console.log("evidence digest:\n" + ev.digest + "\n");
const res = await reviewAndAuthor(ev.digest, ["/tmp/h2h/mm-empty-skills"], author);
console.log("action:", res.action, res.reason ?? "");
if (res.content) writeFileSync("/tmp/h2h/mm-skills/lint.v5.model.md", res.content);
console.log("skill bytes:", res.content ? res.content.length : 0);
