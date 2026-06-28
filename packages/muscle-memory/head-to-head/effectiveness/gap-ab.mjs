import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
const SKILL = readFileSync("/tmp/eff/gizmo-skill.md", "utf8");
const KEY = process.env.ZAI_API_KEY, BASE = "https://api.z.ai/api/coding/paas/v4";
const API = "API (signatures only): g.store(k, v); g.commit(); g.fetch(k); g.fetch_or(k, default).";
const TASKS = [
  { goal: "store key 'name' with value 'mack', then return that value uppercased (expect 'MACK')", setup: "", assert: "solve(g) == 'MACK'" },
  { goal: "return the value for key 'color', or the string 'default' if the key is not present (store is empty → expect 'default')", setup: "", assert: "solve(g) == 'default'" },
  { goal: "store 'x'->10 and 'y'->5, then return their integer sum (expect 15)", setup: "", assert: "solve(g) == 15" },
  { goal: "the store may not have key 'k'; return its value, or None if absent, safely (store empty → expect None)", setup: "", assert: "solve(g) is None" },
  { goal: "store 'n'->7, then return n multiplied by 3 (expect 21)", setup: "", assert: "solve(g) == 21" },
  { goal: "key 'token' was already stored & committed before you run; read it and return its length", setup: "g.store('token','abcd'); g.commit()", assert: "solve(g) == 4" },
];
async function glm(sys, user) {
  for (let i=0;i<4;i++) {
    try {
      const r = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "glm-5.2", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0, max_tokens: 700 }) });
      const j = await r.json(); const c = j?.choices?.[0]?.message?.content; if (c) return c;
    } catch (e) { await new Promise(r=>setTimeout(r, 1500*(i+1))); }
  }
  return "";
}
const extract = (o) => { const m = o.match(/```(?:python)?\n([\s\S]*?)```/); return (m ? m[1] : o).trim(); };
function runs(solveSrc, t) {
  const d = `/tmp/eff/run-${Math.random().toString(36).slice(2)}`; mkdirSync(d, { recursive: true });
  const py = `import sys; sys.path.insert(0,'/tmp/eff')\nfrom gizmo import Gizmo, GizmoMiss, Box\n${solveSrc}\ng = Gizmo()\n${t.setup}\nassert ${t.assert}, 'FAIL'\nprint('PASS')`;
  writeFileSync(`${d}/t.py`, py);
  try { execSync(`python3 ${d}/t.py`, { stdio: "pipe" }); return true; } catch { return false; }
}
const SYS_BASE = `You write Python against a Gizmo store. ${API} Output ONLY a function \`def solve(g):\` (one fenced python block) that fulfils the task using the gizmo instance g.`;
const SYS_SKILL = SYS_BASE + "\n\nReusable skill you have learned for this store:\n\n" + SKILL;
let base = 0, skill = 0; const rows = [];
for (const t of TASKS) {
  const bo = await glm(SYS_BASE, t.goal); const so = await glm(SYS_SKILL, t.goal);
  const bp = runs(extract(bo), t), sp = runs(extract(so), t);
  base += bp ? 1 : 0; skill += sp ? 1 : 0;
  rows.push(`  ${t.goal.slice(0, 46).padEnd(48)} baseline:${bp ? "✓" : "✗"}  with-skill:${sp ? "✓" : "✗"}`);
}
console.log(rows.join("\n"));
console.log(`\nKNOWLEDGE-GAP first-try success:  baseline ${base}/${TASKS.length} (${Math.round(100 * base / TASKS.length)}%)  →  with-skill ${skill}/${TASKS.length} (${Math.round(100 * skill / TASKS.length)}%)`);
console.log(`lift: +${skill - base}/${TASKS.length} (${Math.round(100 * (skill - base) / TASKS.length)} pts)`);
