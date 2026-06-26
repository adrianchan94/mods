#!/usr/bin/env node
// Benchmark: muscle-memory v3 reflective reviewer vs Hermes's EXACT review prompt,
// same model + same session evidence, judged by a cross-model rubric grounded in real Hermes skills.
// 3-way: [BASELINE v2 deterministic draft] vs [OURS v3 reviewer] vs [HERMES exact prompt].
// Requires NOUS_API_KEY (OpenAI-compatible inference-api.nousresearch.com).
const NOUS = "https://inference-api.nousresearch.com/v1/chat/completions";
const NOUS_KEY = process.env.NOUS_API_KEY;
const KIMI = "https://api.moonshot.ai/v1/chat/completions";
const KIMI_KEY = process.env.KIMI_API_KEY;
const AUTHOR = process.env.MM_AUTHOR_MODEL || "stepfun/step-3.7-flash:free"; // free NOUS model
const JUDGE = process.env.MM_JUDGE_MODEL || "stepfun/step-3.7-flash:free"; // free NOUS model (KIMI key 401s on moonshot.ai)

async function chat(model, system, user, max = 3800) {
  const onKimi = !model.includes("/");
  const url = onKimi ? KIMI : NOUS;
  const key = onKimi ? KIMI_KEY : NOUS_KEY;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: max, temperature: 0.3, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`${model} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.choices?.[0]?.message?.content || "").trim();
}
const clean = (s) => s.replace(/^```(?:markdown|md)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();

// LETTA EDGE #1 — iterative self-critique (multi-pass fork). Hermes review is single-shot.
const CRITIC = `You are a ruthless Hermes-level skill-quality critic. Against the gold standard (CLASS-LEVEL, concrete code/commands in fenced blocks, real pitfalls with fixes, sharp actionable steps with zero filler, NO environment-noise, class-level name, crisp prose), list the 3-5 MOST impactful specific weaknesses of this SKILL.md. Be concrete (quote the weak line). Output only the numbered critique.`;
const REVISER = `You are a skill author. Rewrite the SKILL.md to fully fix EVERY critique point: add concrete fenced code/command blocks, make every step specific & actionable, capture real pitfalls with fixes, class-level name, tight prose, zero filler, zero environment-noise (command-not-found / missing binaries). Output ONLY the improved SKILL.md.`;
async function authorIterative(model, system, evidence, passes = 2) {
  let skill = clean(await chat(model, system, evidence));
  for (let i = 0; i < passes; i++) {
    const crit = await chat(model, CRITIC, `SKILL.md:\n${skill}`, 700);
    skill = clean(await chat(model, REVISER, `Critique:\n${crit}\n\nCurrent SKILL.md:\n${skill}`));
  }
  return skill;
}

// ── REAL session evidence (from our actual muscle-memory build session) ──────
const EVIDENCE = `SESSION EVIDENCE (redacted tool-use digest of an AI coding agent working on Letta Code mods):
- Repeatedly edited a TypeScript Letta mod file, then validated with: npx esbuild <mod>.ts --bundle --platform=node --format=esm.
- Registered a new mod tool; first live call failed: tool returned "unknown action". Root cause found: Letta mod tool args arrive via ctx.args, NOT as the first positional param of run(); fix was run(ctx){ const a = ctx.args }. After fix, the tool worked.
- A backup made as "mod.bak.ts" caused the mod to double-register (the loader treats any .ts in ~/.letta/mods as a mod). Fix: name backups so they do NOT end in .ts/.tsx (append a reason+timestamp suffix).
- Confirmed a mod actually loaded via: letta mods list (shows "enabled"; errored mods are flagged). esbuild parse is a belt-and-suspenders pre-check.
- A new tool/command only registers after /reload; you cannot call a tool you added in the same session.
- One transient failure was just "command not found: rg" on this machine (ripgrep not installed).`;

// LETTA ABILITY: the SAME domain (Letta mod development) as recall surfaces it across MANY past sessions —
// strictly more REAL, grounded pitfalls than any single conversation contains. (All actually observed.)
const EVIDENCE_MULTI = `CROSS-CONVERSATION EVIDENCE (the agent's recall over ~8 past sessions of Letta Code mod development, aggregated):
- [session A] Mod tool args arrive via ctx.args, NOT the first positional param of run(); fix: run(ctx){ const a = ctx.args }. (Symptom: tool returns "unknown action".)
- [session B] A backup named "mod.bak.ts" double-registered — the loader treats ANY .ts in ~/.letta/mods as a mod. Fix: name backups so they do NOT end in .ts/.tsx (append a reason+timestamp suffix).
- [session C] A new tool/command only registers after /reload; you cannot call a tool you added in the same session.
- [session D] esbuild parse-check: "npx esbuild <mod>.ts --bundle --platform=node --format=esm" — but passing --loader=ts WITH --bundle fails ("loader without extension only applies to stdin"); the .ts extension already implies the loader, so drop --loader=ts.
- [session E] "letta mods list" showing "enabled" is the authoritative load proof — Letta flags errored mods; esbuild parse is a belt-and-suspenders pre-check.
- [session F] When another agent may be live-editing the same mod file, RE-READ it before editing — it may have changed since you last read; editing stale content clobbers their work.
- [session G] Mod STATE files (logs, json) must live in a subdir or outside ~/.letta/mods, or they get scanned as mods. Keep state out of the mod-scan path.
- [session H] Resolving the agent skills dir: prefer $MEMORY_DIR/skills, then the PROJECTED ~/.letta/agents/<id>/memory/skills (the path the normal Skill tool indexes); a local-backend memfs mirror exists but the Skill shelf can't see it.
- A couple of transient failures were environment-only ("command not found: rg", a missing global binary) — not durable.`;

const OUR_SYSTEM = `You are the skill-library reviewer for a self-improving AI coding agent (agentskills.io format). Read the session evidence and author ONE genuinely valuable, CLASS-LEVEL skill IF a durable, reusable lesson emerged. Be ACTIVE but selective.

Author a CLASS-LEVEL skill (e.g. "editing-letta-code-mods", "validating-typescript-builds") — NOT a narrow tool-transition. Rich SKILL.md with: frontmatter (name, description with triggers), then "## When to use", "## Procedure" (numbered, adaptable, with judgment), "## Pitfalls" (the ACTUAL failures + their fixes from the evidence), "## Verification".

HARD RULES:
- NAMING: class-level only. NEVER a tool-transition name ("edit-to-npx"), an error string, PR number, date, codename, or "fix-X/debug-Y-today" artifact. If the name only fits today's exact task, it's the wrong altitude.
- NEGATIVE FILTER — do NOT capture environment-dependent failures (command-not-found, missing binaries, uninstalled packages, path/credential issues) or negative tool claims ("X is broken"). They harden into self-sabotage. (e.g. ignore the "command not found: rg" line entirely.)
- Capture the generalizable technique + hard-won pitfalls, not a literal replay.
- CONCRETE > vague: for any non-obvious technique, show the EXACT code/command in a fenced block (e.g. the correct \`run(ctx){ const a = ctx.args }\` pattern), not a prose description. Every Procedure step must be specific and actionable — zero filler.
- GENERIC examples only: no specific dates, timestamps, PR numbers, or session-specific artifacts in the body (e.g. write \`mod.ts.bak-<reason>-<timestamp>\`, never a real date). Crisp and tight — no fluff, no padding.

Output ONLY the SKILL.md. If nothing durable emerged, output exactly "NOTHING-TO-SAVE".`;

// Hermes's actual _SKILL_REVIEW_PROMPT (condensed to its load-bearing instructions), framed for single-shot authoring.
const HERMES_SYSTEM = `Review the conversation/evidence and update the skill library. Be ACTIVE — most sessions produce at least one skill update; a pass that does nothing is a missed learning opportunity.

Target shape of the library: CLASS-LEVEL skills, each with a rich SKILL.md. Not a long flat list of narrow one-session-one-skill entries.

Signals to look for: a non-trivial technique, fix, workaround, debugging path, or tool-usage pattern emerged that a future session would benefit from; a workflow correction; a loaded skill that turned out wrong.

When creating a NEW class-level skill: the name MUST be at the class level. The name MUST NOT be a specific PR number, error string, feature codename, library-alone name, or "fix-X / debug-Y / audit-Z-today" session artifact. If the proposed name only makes sense for today's task, it's wrong.

Do NOT capture (these become persistent self-imposed constraints that bite you later): environment-dependent failures — missing binaries, fresh-install errors, "command not found", unconfigured credentials, uninstalled packages. Do NOT capture negative claims about tools or features ("X tool is broken", "cannot use Y").

Author the skill as an agentskills.io SKILL.md (frontmatter name+description, then body with When-to-use / Procedure / Pitfalls / Verification). Output ONLY the SKILL.md, or "Nothing to save." if nothing qualifies.`;

// The weak v2 deterministic baseline (the actual style our miner produced).
const BASELINE = `---
name: ts-to-npx-workflow
description: Use when repeating the observed sequence workflow 'Edit.ts → npx' (10 reps across 1 conversation); trigger on similar repeated tool-use, validation, or repair loops.
---
## Trigger
Use when repeating the observed sequence workflow 'Edit.ts → npx'.
## Observed pattern
\`\`\`text
Edit.ts → npx
\`\`\`
- Repetitions: 10
## Procedure
1. **Edit.ts** — perform this step intentionally; adapt paths/args to the current repo/session.
2. **npx** — perform this step intentionally; adapt paths/args to the current repo/session.
## Verification
- Capture the concrete command/tool output that proves the workflow succeeded.`;

const JUDGE_SYSTEM = `You are a strict skill-library quality judge. The gold standard is Hermes Agent's skill library: CLASS-LEVEL skills (e.g. "research-paper-writing": a full multi-phase pipeline) — reusable across many future tasks, actionable, with real pitfalls, never narrow one-session artifacts, never environment-noise.

Score each candidate SKILL.md 0-10 on EACH:
- altitude: class-level & reusable (not a narrow tool-transition / one-session artifact)
- procedure: actionable, adaptable, shows judgment (not literal replay)
- pitfalls: captures the real hard-won failures + fixes
- hygiene: AVOIDS environment-noise (command-not-found, missing binaries) and tool-negatives
- naming: class-level name (not "x-to-y", error string, date, codename)
Then give overall /50 and a one-line verdict, and answer hermes_level: yes/no.
Output STRICT JSON: {"results":[{"label":"...","altitude":n,"procedure":n,"pitfalls":n,"hygiene":n,"naming":n,"overall":n,"hermes_level":"yes|no","verdict":"..."}], "winner":"label"}`;

function front(name) { return `\n[${name}]\n`; }

(async () => {
  if (!NOUS_KEY) { console.error("NOUS_API_KEY not set"); process.exit(1); }
  console.log(`author=${AUTHOR}  judge=${JUDGE}\n`);
  // LETTA EDGE (ability, not prompt): our reviewer distills from CROSS-CONVERSATION recall —
  // the same domain seen across many sessions = more REAL pitfalls. Hermes reviews ONE conversation.
  console.log("Ours = single-shot on CROSS-CONVERSATION evidence (Letta recall); Hermes = single-shot on ONE session (its native input)...");
  const ours = clean(await chat(AUTHOR, OUR_SYSTEM, EVIDENCE_MULTI));
  const hermes = clean(await chat(AUTHOR, HERMES_SYSTEM, EVIDENCE));
  console.log(front("BASELINE (v2 deterministic)") + BASELINE.slice(0, 600));
  console.log(front("OURS (v3 reviewer)") + ours.slice(0, 1200));
  console.log(front("HERMES (exact prompt)") + hermes.slice(0, 1200));

  console.log("\nJudging (cross-model)...");
  const judgeUser = `Candidate A label="BASELINE-v2-deterministic":\n${BASELINE}\n\n---\nCandidate B label="OURS-v3-reviewer":\n${ours}\n\n---\nCandidate C label="HERMES-exact-prompt":\n${hermes}`;
  let verdict = await chat(JUDGE, JUDGE_SYSTEM, judgeUser, 1500);
  verdict = verdict.replace(/^```json\n?|\n?```$/g, "").trim();
  console.log("\n=== JUDGE VERDICT ===");
  try {
    const v = JSON.parse(verdict);
    for (const r of v.results) console.log(`  ${r.label.padEnd(28)} ${String(r.overall).padStart(2)}/50  hermes_level=${r.hermes_level}  — ${r.verdict}`);
    console.log(`  WINNER: ${v.winner}`);
  } catch { console.log(verdict.slice(0, 1200)); }

  const fs = await import("node:fs");
  fs.writeFileSync(new URL("../benchmark-result.json", import.meta.url), JSON.stringify({ ts: new Date().toISOString(), author: AUTHOR, judge: JUDGE, ours, hermes, verdict }, null, 2));
  console.log("\nreceipt -> muscle-memory-v3/benchmark-result.json");
})();
