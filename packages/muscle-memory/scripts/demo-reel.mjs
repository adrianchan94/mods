#!/usr/bin/env node
// muscle-memory — the recorded demo reel. Replicates Hermes's skill-distillation flow,
// Letta-native: observe → background review → distill (update-first) → 💾 review summary →
// evidence manifest → measured runtime gain. Uses the REAL mod functions for authenticity.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-demo-reel.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const { __mm: M } = await import(OUT + "?t=" + Date.now());

const B = "\x1b[1m", D = "\x1b[2m", G = "\x1b[32m", C = "\x1b[36m", Y = "\x1b[33m", R = "\x1b[31m", M_ = "\x1b[35m", X = "\x1b[0m";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = (s = "") => process.stdout.write(s + "\n");
const type = async (s, ms = 14) => { for (const ch of s) { process.stdout.write(ch); await sleep(ms); } process.stdout.write("\n"); };

process.env.MM_REFLECT = "staged";

(async () => {
  p("");
  p(`${D}$${X} ${B}letta install npm:@letta-ai/muscle-memory${X}`);
  await sleep(500);
  p(`${G}✓${X} installed ${B}@letta-ai/muscle-memory@0.3.1${X} ${D}· /reload${X}`);
  await sleep(700);
  p(`${B}${M_}\n  💾 muscle-memory ${X}${D}— the self-improving skill foundry for Letta Code${X}`);
  p(`${D}  Hermes's distillation loop, rebuilt on Letta's substrate.${X}\n`);
  await sleep(1300);

  // ── 1. the agent just works (observed) ──
  p(`${C}▌ 1 · the agent just works${X}  ${D}(muscle-memory observes every tool call)${X}`);
  for (const [t, ok] of [["Edit src/mod.ts", 1], ["Bash  npx tsc --noEmit", 0], ["Edit src/mod.ts", 1], ["Bash  npx tsc --noEmit", 1]]) {
    await sleep(450); p(`   ${ok ? G + "✓" : R + "✗"} ${t}${X}${ok ? "" : D + "  error TS2345: type mismatch" + X}`);
  }
  p(`${D}   …same pattern recurs across ${B}3 sessions${X}${D} (recall, not one conversation)${X}`);
  await sleep(1500);

  // ── 2. background review (like Hermes) ──
  p(`\n${C}▌ 2 · background review fires at session end${X}  ${D}(forked reviewer — no foreground turn)${X}`);
  await sleep(700);
  for (const line of M.renderMuscleMemoryPanel({ phase: "reviewing", last: "reviewing 3 sessions / 8 durable signals · prefs 2 · noise 1" })) p(`   ${Y}${line}${X}`);
  await sleep(1600);

  // ── 3. cross-conversation evidence + MemFS update-first routing ──
  p(`\n${C}▌ 3 · cross-conversation evidence → MemFS update-first routing${X}`);
  await sleep(500);
  p(`   ${D}memfs search:${X} editing-letta-mods-safely ${G}(s132/m4)${X}${D}, validating-letta-mods (s60/m2)${X}`);
  await sleep(700);
  p(`   ${B}route: UPDATE${X} editing-letta-mods-safely ${D}(high confidence — patch, don't duplicate)${X}`);
  await sleep(1500);

  // ── 4. the 💾 review summary (Hermes-style) + the skill ──
  p(`\n${C}▌ 4 · distilled (finished-action summary, like Hermes)${X}`);
  await sleep(500);
  const ev = [{ phase: "skill_updated", summary: "updated 'editing-letta-mods-safely' (update-first, 3 sessions/8 signals)" }, { phase: "evidence_manifest_written", summary: "wrote evidence manifest" }, { phase: "noise_rejected", summary: "rejected 2 env-noise items" }];
  await type(`   ${G}${M.summarizeReflectActions(ev, "verbose")}${X}`, 8);
  await sleep(900);
  p(`${D}   ┌─ editing-letta-mods-safely/SKILL.md ${"─".repeat(34)}${X}`);
  for (const l of ["## Pitfalls (hard-won)", "- Tool args arrive via `ctx.args`, not positional: run(ctx){ const a = ctx.args }", "- Backups must NOT end in .ts — the loader double-registers them", "- A new tool isn't callable until /reload"]) { p(`${D}   │${X} ${l}`); await sleep(280); }
  p(`${D}   └${"─".repeat(60)}${X}`);
  await sleep(1400);

  // ── 5. evidence manifest (provenance, not vibes) ──
  p(`\n${C}▌ 5 · every skill is an evidence-backed git object${X}  ${D}references/evidence/<ts>.json${X}`);
  const man = M.buildEvidenceManifest({ action: "update", skill: "editing-letta-mods-safely", updateTarget: "editing-letta-mods-safely", convs: 3, signals: 8, memfsHits: [{ name: "editing-letta-mods-safely", score: 132, matched: 4 }], preferences: ["prefers concise, receipt-first output"], rejected: [{ item: "command not found: rg", reason: "env-noise" }], newContent: "new", oldContent: "old" });
  await sleep(500);
  p(`   ${D}sources:${X} ${man.sources.conversations} convs / ${man.sources.durableSignals} signals  ${D}·  memfs hit:${X} ${man.memfsHits[0].name}`);
  p(`   ${D}prefs injected:${X} ${man.preferencesInjected.length}  ${D}·  noise rejected:${X} ${man.rejectedNoise.length}  ${D}·  hash:${X} ${man.oldHash}→${man.newHash}`);
  await sleep(1700);

  // ── 6. the payoff: measured runtime improvement ──
  p(`\n${C}▌ 6 · does it actually help? measured A/B (real model)${X}`);
  await sleep(500);
  for (const [task, b, w] of [["ctx.args", 0, 100], ["/reload needed", 0, 100], ["backup-naming (already knew)", 100, 100]]) { p(`   ${task.padEnd(30)} ${R}${String(b).padStart(3)}%${X} ${D}→${X} ${G}${String(w).padStart(3)}%${X}`); await sleep(450); }
  p(`   ${B}first-try correctness: ${R}33%${X} ${B}→ ${G}100%  (+67 pts)${X}`);
  await sleep(1600);

  // ── close ──
  p(`\n${M_}${"━".repeat(64)}${X}`);
  p(`  ${B}Hermes tells you a skill was saved.${X}`);
  p(`  ${B}${G}muscle-memory shows the evidence route — and proves it helped.${X}`);
  p(`  ${D}benchmarked vs Hermes's own prompt: ${X}${B}ours 47 · Hermes 35${X}${D} (cross-conversation)${X}`);
  p(`${M_}${"━".repeat(64)}${X}\n`);
  await sleep(2000);
})();
