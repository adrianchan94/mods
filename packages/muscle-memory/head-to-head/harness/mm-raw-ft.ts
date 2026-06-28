// Capture WHY mm's model-authored path declines the flagship failing-test class.
import { readFileSync } from "node:fs";
import { __mm } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
import type { Row } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";

const { classifyError, buildCrossConversationEvidence, reviewAndAuthor } = __mm;
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
function R(conv: string, tool: string, tmpl: string, ok: boolean | undefined, e?: string): Row {
  ts += 1000; return { conv, tool, tmpl, fp: `${tool}::${tmpl}`, h: `${tool}::${tmpl}::${ts}`, ok, err: ok === false ? classifyError(e ?? "", false) : null, ts };
}
const rows = ["c1", "c2", "c3"].flatMap((c) => [
  R(c, "Bash", "pytest -q", false, "E   assert add(2, 3) == 5\nE   assertion error: -1 != 5"),
  R(c, "Edit", "calc.py", true),
  R(c, "Bash", "pytest -q", true),
]);
const ev = buildCrossConversationEvidence(rows);
const res = await reviewAndAuthor(ev.digest, ["/tmp/h2h/mm-empty-skills"], author);
console.log("ACTION:", res.action, res.reason ?? "");
console.log("RAW MODEL OUTPUT:\n" + readFileSync(`${process.env.MM_STATE_DIR}/reflect-last-raw.txt`, "utf8").slice(0, 1200));
