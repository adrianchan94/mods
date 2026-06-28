// De-confounded muscle-memory side: REAL model-authored skills per class via reviewAndAuthor,
// authored by the SAME model Hermes uses (GLM-5.2), fed REALISTIC fingerprint evidence.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { __mm } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
import type { Row } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";

const { classifyError, buildCrossConversationEvidence, reviewAndAuthor, detectInvocationGotchas, buildDefenses, detectRepairChains } = __mm;

const OUT = "/tmp/h2h/mm-skills";
mkdirSync(OUT, { recursive: true });
const EMPTY = "/tmp/h2h/mm-empty-skills";
mkdirSync(EMPTY, { recursive: true });

const KEY = process.env.ZAI_KEY ?? "";
const BASE = "https://api.z.ai/api/coding/paas/v4";

// z.ai GLM-5.2 author — same model Hermes runs on, so the comparison isolates the PIPELINE, not the model.
function extractContent(data: unknown): string {
  if (!data || typeof data !== "object" || !("choices" in data)) return "";
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first: unknown = choices[0];
  if (!first || typeof first !== "object" || !("message" in first)) return "";
  const msg = first.message;
  if (!msg || typeof msg !== "object" || !("content" in msg)) return "";
  const content = msg.content;
  return typeof content === "string" ? content : "";
}

async function author(system: string, user: string): Promise<string> {
  const resp = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "glm-5.2",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0,
      max_tokens: 4000,
    }),
  });
  const data: unknown = await resp.json();
  return extractContent(data);
}

let ts = 1_700_000_000_000;
function R(conv: string, tool: string, tmpl: string, ok: boolean | undefined, errText?: string): Row {
  ts += 1000;
  const err = ok === false ? classifyError(errText ?? "", false) : null;
  return { conv, tool, tmpl, fp: `${tool}::${tmpl}`, h: `${tool}::${tmpl}::${ts}`, ok, err, ts };
}

// REALISTIC sessions — same shape Hermes drove, with REAL error text -> production classifyError path.
const classes: Record<string, Row[]> = {
  "failing-test": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "pytest -q", false, "E   assert add(2, 3) == 5\nE   assertion error: -1 != 5"),
    R(c, "Edit", "calc.py", true),
    R(c, "Bash", "pytest -q", true),
  ]),
  "lint": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "pyflakes service.py", false, "service.py:11:11 undefined name 'reuslt'\nservice.py:1:1 'os' imported but unused"),
    R(c, "Edit", "service.py", true),
    R(c, "Bash", "pyflakes service.py", true),
  ]),
  "npm": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "node app.js", false, "Error: Cannot find module 'lodash'\nRequire stack: app.js"),
    R(c, "Bash", "npm install lodash", true),
    R(c, "Bash", "node app.js", true),
  ]),
  "env": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "python3 run.py", false, "FATAL: APP_MODE=prod required"),
    R(c, "Bash", "APP_MODE=prod python3 run.py", true),
  ]),
  "git": ["c1", "c2", "c3"].flatMap((c) => [
    R(c, "Bash", "git add notes.txt", true),
    R(c, "Bash", "git commit -m <msg>", true),
    R(c, "Bash", "git log --oneline", true),
  ]),
};

const summary: Array<{ cls: string; errClasses: string[]; repairs: number; action: string; name: string; defense: string }> = [];

for (const [cls, rows] of Object.entries(classes)) {
  const repairs = detectRepairChains(rows);
  const ev = buildCrossConversationEvidence(rows);
  const gotchas = detectInvocationGotchas(rows);
  const defenses = buildDefenses(rows).filter((d) => d.errClass === "invocation");
  const errClasses = [...new Set(rows.filter((r) => r.err).map((r) => String(r.err)))];

  let action = "none";
  let name = "";
  if (ev.items > 0) {
    const res = await reviewAndAuthor(ev.digest, [EMPTY], author);
    action = res.action;
    name = res.name ?? "";
    if (res.content) writeFileSync(join(OUT, `${cls}.md`), res.content);
  }
  const defense = defenses.map((d) => `${d.trigger} => ${d.defense}`).join(" | ");
  summary.push({ cls, errClasses, repairs: repairs.length, action, name, defense });
  console.log(`\n===== ${cls} =====`);
  console.log(`errClasses: ${errClasses.join(", ") || "(none)"} | durable repairs: ${repairs.length} | evidence items: ${ev.items}`);
  console.log(`mm action: ${action}${name ? ` (${name})` : ""}`);
  if (defense) console.log(`defense (invocation): ${defense}`);
  console.log(`evidence digest:\n${ev.digest.split("\n").map((l) => "  | " + l).join("\n")}`);
}

writeFileSync(join(OUT, "_summary.json"), JSON.stringify(summary, null, 2));
console.log("\n=== SUMMARY ===");
for (const s of summary) console.log(`${s.cls.padEnd(14)} action=${s.action.padEnd(7)} name=${s.name || "-"} defense=${s.defense || "-"}`);
