#!/usr/bin/env node
// QA STRESS 3 — the LIVE HOT PATH. The event handlers (tool_start/tool_end/conversation_close/llm/
// compact) run on EVERY tool call in production. A handler that throws on a malformed event could
// break the whole app. We activate the mod and fire adversarial/garbage events at every handler —
// asserting NOTHING ever throws (the mod's #1 invariant: never break the host).
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

process.env.MM_STATE_DIR = mkdtempSync(join(tmpdir(), "mm-qa3-")); // isolate writes
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-qa3.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const mod = await import(OUT + "?t=" + Date.now());
const activate = mod.default;
let PASS = 0, FAIL = 0; const fails = [];
const ok = (n, c) => { if (c) PASS++; else { FAIL++; fails.push(n); } console.log(`  ${c ? "PASS" : "FAIL"}  ${n}`); };

// permissive mock letta that captures every registered handler/command
const handlers = {}; const disposers = [];
const mockLetta = {
  capabilities: { tools: true, commands: true, events: { tools: true, lifecycle: true, llm: true, compact: true }, ui: { panels: true } },
  events: { on: (name, fn) => { (handlers[name] ||= []).push(fn); return () => {}; } },
  commands: { register: (c) => { (handlers._cmd ||= []).push(c); return () => {}; } },
  tools: { register: (t) => { (handlers._tool ||= []).push(t); return () => {}; } },
  ui: { openPanel: () => ({ update: () => {}, close: () => {} }), closePanel: () => {} },
};

console.log("\n── L · activate() never throws + registers handlers ──");
let dispose;
ok("activate(full caps) → no throw", (() => { try { dispose = activate(mockLetta); return true; } catch (e) { console.log("   " + e.message); return false; } })());
ok("registered event handlers present", Object.keys(handlers).some((k) => !k.startsWith("_") && handlers[k].length));

console.log("\n── M · HOT PATH: fire garbage events at every handler → NEVER throw ──");
const garbage = [
  null, undefined, {}, [], "string", 42, true,
  { toolName: null, toolCallId: undefined },
  { toolName: 123, args: { x: 1 } },
  { toolName: "x".repeat(5000), args: "y".repeat(200000) },          // huge
  { conversationId: [], agentId: {}, toolCallCount: "lots" },
  { ok: "maybe", err: { nested: { deep: true } } },
  JSON.parse('{"__proto__":{"polluted":true}}'),                      // proto pollution attempt
  { toolName: "Bash", result: Symbol("x") },
  { get toolName() { throw new Error("evil getter"); } },             // throwing getter
  Object.create(null),                                                // no prototype
];
const ctxes = [null, undefined, {}, { agentId: null }, { conversation: { fork: () => { throw new Error("fork boom"); } } }];
let everThrew = false, count = 0;
for (const name of Object.keys(handlers)) {
  if (name.startsWith("_")) continue;
  for (const h of handlers[name]) for (const ev of garbage) for (const ctx of ctxes) {
    count++;
    try { const r = h(ev, ctx); if (r && typeof r.then === "function") r.catch(() => {}); } catch { everThrew = true; }
  }
}
ok(`fired ${count} garbage events across all handlers → none threw`, !everThrew);
ok("global state not prototype-polluted", ({}).polluted === undefined && [].polluted === undefined);

console.log("\n── N · commands + tools handle garbage args → no throw ──");
let cmdThrew = false;
for (const c of handlers._cmd || []) { for (const a of [null, undefined, {}, { args: null }, { args: "events; rm -rf" }, { argv: [{}] }]) { try { const r = c.run?.(a); if (r?.then) await r.catch(() => {}); } catch { cmdThrew = true; } } }
ok("/muscle-memory command with garbage args → no throw", !cmdThrew);
let toolThrew = false;
for (const t of handlers._tool || []) { for (const a of [null, {}, { action: null }, { action: "../../x" }, { action: "reflect", mode: {} }, { action: "load", name: "../etc" }]) { try { const r = t.run?.(a, {}); if (r?.then) await r.catch(() => {}); } catch { toolThrew = true; } } }
ok("muscle_memory tools with garbage/malicious args → no throw", !toolThrew);

console.log("\n── O · dispose cleanly ──");
ok("dispose() → no throw", (() => { try { if (typeof dispose === "function") dispose(); return true; } catch { return false; } })());

console.log("\n" + "─".repeat(60));
console.log(`  ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) console.log(`  GAPS:\n${fails.map((f) => "   ✗ " + f).join("\n")}`);
process.exit(FAIL === 0 ? 0 : 1);
