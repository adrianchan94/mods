#!/usr/bin/env node
// v2.1 — live defense correlation harness.
// (1) pure correlateOutcomes tests, (2) repair→defense from event-shaped data,
// (3) LIVE-BACKEND EVENT-SHAPE harness: fires the REAL mod event handlers (not just pure
//     functions) with simulated event objects (no toolCallId) and proves a defense-hit lands.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

// Isolate ALL mod state to a temp dir BEFORE importing the bundle (STATE_DIR reads this at load).
const STATE = join(tmpdir(), "mm-correlation-" + process.pid);
mkdirSync(STATE, { recursive: true });
process.env.MM_STATE_DIR = STATE;
process.env.MEMORY_DIR = join(STATE, "agentscope");
mkdirSync(join(process.env.MEMORY_DIR, "skills"), { recursive: true });

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-correlation-bundle.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const mod = await import(OUT + "?t=" + Date.now());
const M = mod.__mm; const activate = mod.default;

let PASS = 0, FAIL = 0;
const p = (s = "") => console.log(s);
const hr = (t) => { p("\n" + "─".repeat(72)); p(t); p("─".repeat(72)); };
const ok = (n, c) => { if (c) PASS++; else FAIL++; p(`  ${c ? "PASS" : "FAIL"}  ${n}`); };
const co = (s, e, o) => M.correlateOutcomes(s, e, o);

hr("1 — correlateOutcomes (exact id → conv/tool/nearest → FIFO → drop)");
ok("exact id merge", co([{ tool: "Bash", tmpl: "npx", id: "a", conv: "x", ts: 1 }], [{ id: "a", ok: false, err: "e", conv: "x", ts: 2 }])[0].ok === false);
ok("no-id local shape (tool match) merges", co([{ tool: "Bash", tmpl: "npx", id: null, conv: "x", ts: 1 }], [{ id: null, tool: "Bash", ok: false, conv: "x", ts: 2 }])[0].ok === false);
const fifo = co([{ tool: "Bash", tmpl: "a", conv: "x", ts: 1 }, { tool: "Bash", tmpl: "b", conv: "x", ts: 2 }], [{ ok: false, conv: "x", ts: 3 }]);
ok("FIFO fallback (no tool on end) → oldest unmatched", fifo[0].ok === false && fifo[1].ok === undefined);
const conc = co([{ tool: "Bash", tmpl: "npx", conv: "x", ts: 1 }, { tool: "Edit", tmpl: "edit", conv: "x", ts: 2 }], [{ tool: "Edit", ok: false, conv: "x", ts: 3 }]);
ok("concurrency: tool match picks correct start", conc[1].ok === false && conc[0].ok === undefined);
ok("stale window → does NOT merge", co([{ tool: "Bash", tmpl: "npx", conv: "x", ts: 0 }], [{ tool: "Bash", ok: false, conv: "x", ts: 10 * 60 * 1000 }])[0].ok === undefined);
ok("cross-conversation → does NOT merge", co([{ tool: "Bash", tmpl: "npx", conv: "x", ts: 1 }], [{ tool: "Bash", ok: false, conv: "y", ts: 2 }])[0].ok === undefined);

hr("2 — repair → defense from EVENT-SHAPED data (no pre-merged rows)");
const starts = [{ tool: "Bash", tmpl: "npx tsc", conv: "s", ts: 1, id: null }, { tool: "Edit", tmpl: "Edit <path>.ts", conv: "s", ts: 3, id: null }, { tool: "Bash", tmpl: "npx tsc", conv: "s", ts: 5, id: null }];
const ends = [{ tool: "Bash", ok: false, err: "error TS2345", conv: "s", ts: 2 }, { tool: "Edit", ok: true, conv: "s", ts: 4 }, { tool: "Bash", ok: true, conv: "s", ts: 6 }];
const merged = co(starts, ends);
ok("correlated: first npx=fail, second npx=pass", merged[0].ok === false && merged[2].ok === true);
const reps = M.detectRepairChains(merged);
ok("repair chain detected FAIL[npx]→fix→PASS", reps.some((r) => r.trigger.includes("npx") && r.fixStep.startsWith("Edit")));
const defs = M.buildDefenses(merged);
ok("defense built from correlated repair", defs.length >= 1 && M.preActionDefense("npx tsc", defs) !== null);

hr("3 — LIVE-BACKEND EVENT-SHAPE harness (real handlers, simulated event objects)");
const handlers = {};
const mockLetta = {
  capabilities: { tools: true, commands: true, events: { tools: true, lifecycle: true } },
  events: { on: (name, fn) => { handlers[name] = fn; return () => {}; } },
  tools: { register: () => () => {} }, commands: { register: () => () => {} },
  ui: { openPanel: () => ({ update() {}, close() {} }), setStatus() {}, clearStatus() {} }, client: {}, diagnostics: { report() {} },
};
const dispose = activate(mockLetta);
ok("mod activated; tool_start/tool_end/conversation_close handlers registered", typeof handlers.tool_start === "function" && typeof handlers.tool_end === "function" && typeof handlers.conversation_close === "function");
// fire a real failure→fix→pass sequence through the ACTUAL handlers (events carry NO toolCallId — the local-backend shape).
// spin a few ms between events so the handlers' Date.now() timestamps are strictly ordered (deterministic correlation).
const spin = (ms) => { const t = Date.now(); while (Date.now() - t < ms) { /* busy */ } };
const fire = (name, ev) => { spin(3); handlers[name](ev, { agent: { id: "test" } }); };
fire("tool_start", { toolName: "Bash", args: { command: "npx tsc --noEmit" }, conversationId: "sess" });
fire("tool_end", { toolName: "Bash", ok: false, resultText: "error TS2345: type mismatch", conversationId: "sess" });
fire("tool_start", { toolName: "Edit", args: { file_path: "src/x.ts" }, conversationId: "sess" });
fire("tool_end", { toolName: "Edit", ok: true, conversationId: "sess" });
fire("tool_start", { toolName: "Bash", args: { command: "npx tsc --noEmit" }, conversationId: "sess" });
fire("tool_end", { toolName: "Bash", ok: true, conversationId: "sess" });
// session end → defenses refresh from the now-correlated experience
fire("conversation_close", { conversationId: "sess" });
// experience/outcomes actually landed
ok("live: experience + outcomes written to isolated state", existsSync(join(STATE, "experience.jsonl")) && existsSync(join(STATE, "outcomes.jsonl")));
// the agent is about to repeat the failing command → pre-action defense must fire
fire("tool_start", { toolName: "Bash", args: { command: "npx tsc --noEmit" }, conversationId: "sess" });
const hitsPath = join(STATE, "defense-hits.jsonl");
const hits = existsSync(hitsPath) ? readFileSync(hitsPath, "utf8").trim() : "";
ok("LIVE pre-action defense hit RECORDED before re-running the known failure", hits.length > 0 && /npx/.test(hits));
if (hits) p(`     ${"\x1b[33m"}↳ ${hits.split("\n").pop()}${"\x1b[0m"}`);
dispose();
ok("mod disposes clean", true);

hr("VERDICT");
p(`  ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL === 0 ? 0 : 1);
