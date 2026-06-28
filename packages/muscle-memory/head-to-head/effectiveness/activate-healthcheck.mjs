import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; process.env.MM_STATE_DIR = mkdtempSync(tmpdir()+"/mmhc-");
// Live-surface health check: load the mod with a full mock harness, confirm EVERY surface registers
// and the read commands actually RUN without throwing. Mirrors what a real letta session does at boot.
import { execSync } from "node:child_process";
execSync("npx --yes esbuild " + process.env.HOME + "/.letta/mods/muscle-memory.ts --bundle --platform=node --format=esm --outfile=/tmp/mm-hc.mjs", { stdio: "pipe" });
const mod = await import("/tmp/mm-hc.mjs?t=" + Date.now());

const tools = [], events = [], commands = {}; let panelOpened = false; const disposers = [];
const letta = {
  capabilities: { events: { lifecycle: true, tools: true, turns: true, compact: true, llm: true }, ui: { panels: true }, commands: true, tools: true },
  events: { on: (name, fn) => { events.push(name); return () => {}; } },
  tools: { register: (t) => { tools.push(t?.name || t?.id || "?"); return () => {}; } },
  commands: { register: (c) => { commands[c.id] = c; return () => {}; } },
  ui: { panels: true, openPanel: () => { panelOpened = true; return { update: () => {}, close: () => {} }; } },
};
let fatal = null;
try { const d = mod.default(letta); if (Array.isArray(d)) disposers.push(...d); } catch (e) { fatal = e; }

console.log("=== ACTIVATE HEALTH CHECK ===");
console.log("activate threw:", fatal ? "❌ " + String(fatal).slice(0, 120) : "✅ no");
console.log("tools registered:", tools.length, tools.length ? "✅" : "❌", "—", tools.join(", "));
console.log("events hooked:", events.join(", "), events.includes("turn_end") ? "✅ turn_end" : "❌ no turn_end");
console.log("commands:", Object.keys(commands).join(", "));
console.log("panel opened:", panelOpened ? "✅" : "(no panel cap)");

// run the read-only commands the way the TUI would
const mm = commands["muscle-memory"];
let ran = 0, threw = 0;
for (const argv of [["audit"], ["coverage"], ["events"], ["staged"], ["lifecycle"], ["publish", "cloud-agent-forensics"], ["engram"]]) {
  try { const r = await mm.run({ argv }); const out = String(r?.output || "").split("\n")[0].slice(0, 70); ran++; console.log(`  /muscle-memory ${argv.join(" ").padEnd(28)} ✅ ${out}`); }
  catch (e) { threw++; console.log(`  /muscle-memory ${argv.join(" ").padEnd(28)} ❌ ${String(e).slice(0, 70)}`); }
}
console.log(`\ncommands ran: ${ran} ok, ${threw} threw`);
console.log(`HEALTH: ${!fatal && tools.length && events.includes("turn_end") && threw === 0 ? "✅ ALL GREEN — mod loads + all surfaces work" : "❌ ISSUES"}`);
process.exit(0);
