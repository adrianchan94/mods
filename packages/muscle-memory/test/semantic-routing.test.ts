// muscle-memory · E4 semantic routing tests (hybrid recall/precision).
//
// CONTRACT under test: embedding search (client.agents.passages.search) returns rank order with
// NO absolute score, so semantic evidence may only
//   (a) BOOST a candidate the lexical scorer already found distinctive overlap for, and
//   (b) park an autonomous CREATE when the semantic rank-1 hit has ZERO lexical support
//       (the paraphrase-duplicate class lexical routing misses by construction).
// It must NEVER route an UPDATE on its own (never patch the wrong skill), and with no semanticFn
// or an empty hit list, behavior must be byte-identical to lexical-only routing.
// Run: `bun test test/semantic-routing.test.ts`
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySemanticEvidence, pickUpdateTarget, reviewAndAuthor, SEMANTIC_RANK_BONUS } from "../mods/autopilot";
import { parseSkillHits, semanticSkillCandidates, skillPassageTag, skillPassageText, syncSkillPassages, SKILL_PASSAGE_TAG } from "../mods/engram";

type Match = { name: string; description: string; dir: string; score: number; matched: number };
const M = (name: string, score: number, matched: number): Match => ({ name, description: `desc of ${name}`, dir: "/tmp", score, matched });

function shelfWith(...skills: Array<[string, string]>): string {
  const dir = mkdtempSync(join(tmpdir(), "mm-sem-shelf-"));
  for (const [n, d] of skills) {
    mkdirSync(join(dir, n), { recursive: true });
    writeFileSync(join(dir, n, "SKILL.md"), `---\nname: ${n}\ndescription: ${d}\n---\n## Procedure\n1. ${d}\n## Pitfalls\n### 1. x\nTELL: y. Fix it.\n## Verification\n- ok.`);
  }
  return dir;
}

// ── applySemanticEvidence (pure) ────────────────────────────────────────────────────────────

test("corroboration boost: semantic rank-1 lifts an under-threshold lexical target past pickUpdateTarget", () => {
  const matches = [M("debugging-failing-tests", 14, 3), M("validating-mod-packages", 4, 1)];
  expect(pickUpdateTarget(matches, 18)).toBeNull(); // lexical alone: under threshold → CREATE
  const { matches: boosted, suspect } = applySemanticEvidence(matches, [{ name: "debugging-failing-tests", rank: 0 }], () => true);
  expect(boosted[0].score).toBe(14 + SEMANTIC_RANK_BONUS[0]);
  expect(suspect).toBeNull(); // corroborated, not suspect
  expect(pickUpdateTarget(boosted, 18)?.name).toBe("debugging-failing-tests"); // hybrid: routes UPDATE
});

test("boost never manufactures `matched`: a semantic hit with zero lexical overlap gets no score boost", () => {
  const matches = [M("some-other-skill", 20, 3), M("paraphrase-dupe", 0, 0)];
  const { matches: boosted } = applySemanticEvidence(matches, [{ name: "paraphrase-dupe", rank: 0 }], () => true);
  expect(boosted.find((m) => m.name === "paraphrase-dupe")?.score).toBe(0); // matched=0 → untouched
});

test("semantic-duplicate suspect: rank-1 hit on-shelf with no distinctive lexical overlap", () => {
  const { suspect } = applySemanticEvidence([M("unrelated", 6, 1)], [{ name: "paraphrase-dupe", rank: 0 }], (n) => n === "paraphrase-dupe");
  expect(suspect).toBe("paraphrase-dupe");
});

test("stale semantic hit (passage for a deleted skill) is never a suspect", () => {
  const { suspect } = applySemanticEvidence([M("unrelated", 6, 1)], [{ name: "ghost-skill", rank: 0 }], () => false);
  expect(suspect).toBeNull();
});

test("no hits → identity: matches unchanged, no suspect (lexical-only regression)", () => {
  const matches = [M("a", 10, 2), M("b", 5, 1)];
  const out = applySemanticEvidence(matches, [], () => true);
  expect(out.matches).toEqual(matches);
  expect(out.suspect).toBeNull();
});

// ── reviewAndAuthor wiring ──────────────────────────────────────────────────────────────────

const EVIDENCE = "- recovered failure: alembic upgrade head (services/checkout)\n· example — KeyError revision → repair the version file and re-run";

test("wiring: semantic-only dupe parks the autonomous CREATE before the author is ever called", async () => {
  // Shelf skill covers the same territory in DISJOINT vocabulary — lexical routing scores ~0.
  const shelf = shelfWith(["handling-broken-schema-changes", "Use when a database change script blows up mid-apply: inspect the failed step, repair the script, apply again."]);
  let authored = 0;
  const res = await reviewAndAuthor(EVIDENCE, [shelf], async () => { authored++; return ""; }, {
    semanticFn: async () => [{ name: "handling-broken-schema-changes", rank: 0 }],
  });
  expect(res.action).toBe("none");
  expect(res.reason || "").toMatch(/semantic duplicate/i);
  expect(authored).toBe(0); // parked in routing — no model call, no write
});

test("wiring: a throwing semanticFn degrades to pure lexical routing (never blocks)", async () => {
  const shelf = shelfWith(["handling-broken-schema-changes", "Use when a database change script blows up mid-apply: inspect the failed step, repair the script, apply again."]);
  let authored = 0;
  // A VALID author draft makes the outcome deterministic regardless of host/suite state —
  // asserting on the action of an EMPTY author leaned on the deterministic fallback, whose
  // availability depends on whatever experience state other tests (or the host) left behind.
  const DRAFT = [
    "---", "name: recovering-from-visor-migration-failures",
    "description: Use when a migration verifier fails with a stale-ledger error — read the verifier, repair the config epoch, re-run to confirm.",
    "---", "## Procedure", "1. Read the exact error. 2. Repair the config. 3. Re-run the verifier.",
    "## Pitfalls", "### 1. Blind retry", "TELL: identical error twice. Fix the config first.",
    "## Verification", "- Verifier exits 0.",
  ].join("\n");
  const res = await reviewAndAuthor(EVIDENCE, [shelf], async () => { authored++; return DRAFT; }, {
    semanticFn: async () => { throw new Error("server down"); },
  });
  expect(authored).toBeGreaterThan(0); // routing survived the throwing semantic lane; the author ran
  expect(res.action).toBe("create");   // and the pure-lexical route completed end to end
});

// ── passage index primitives ────────────────────────────────────────────────────────────────

test("parseSkillHits: name from mm:skill:<name> tag, content fallback, invalid names dropped, deduped", () => {
  const hits = parseSkillHits({ count: 4, results: [
    { id: "p1", content: "skill: debugging-failing-tests\n...", tags: [SKILL_PASSAGE_TAG, skillPassageTag("debugging-failing-tests")] },
    { id: "p2", content: "skill: validating-mod-packages\n...", tags: [SKILL_PASSAGE_TAG] }, // no name tag → content fallback
    { id: "p3", content: "skill: NOT A VALID NAME!!\n...", tags: [SKILL_PASSAGE_TAG] },
    { id: "p4", content: "skill: debugging-failing-tests\n...", tags: [skillPassageTag("debugging-failing-tests")] }, // dupe
  ] });
  expect(hits.map((h) => h.name)).toEqual(["debugging-failing-tests", "validating-mod-packages"]);
  expect(hits.map((h) => h.rank)).toEqual([0, 1]);
});

test("parseSkillHits: malformed responses are empty, never throw", () => {
  expect(parseSkillHits(undefined)).toEqual([]);
  expect(parseSkillHits("nope")).toEqual([]);
  expect(parseSkillHits({ results: "nope" })).toEqual([]);
  expect(parseSkillHits({ results: [null, 42, {}] })).toEqual([]);
});

test("semanticSkillCandidates + syncSkillPassages: gated off without MM_NATIVE=passages; upsert deletes stale then creates", async () => {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const client = { agents: { passages: {
    search: (...args: unknown[]) => { calls.push({ op: "search", args }); return Promise.resolve({ count: 1, results: [{ id: "old-1", content: "skill: a-skill\nx", tags: [SKILL_PASSAGE_TAG, skillPassageTag("a-skill")] }] }); },
    create: (...args: unknown[]) => { calls.push({ op: "create", args }); return Promise.resolve([]); },
    delete: (...args: unknown[]) => { calls.push({ op: "delete", args }); return Promise.resolve({}); },
  } } };
  const prev = process.env.MM_NATIVE;
  delete process.env.MM_NATIVE;
  try {
    expect(await semanticSkillCandidates(client, "agent-1", "query")).toEqual([]); // env off → no-op
    expect(await syncSkillPassages(client, "agent-1", [{ name: "a-skill", description: "d" }])).toBe(0);
    expect(calls.length).toBe(0); // gated: the client was never touched
    process.env.MM_NATIVE = "passages";
    const hits = await semanticSkillCandidates(client, "agent-1", "query text");
    expect(hits).toEqual([{ name: "a-skill", rank: 0 }]);
    calls.length = 0;
    expect(await syncSkillPassages(client, "agent-1", [{ name: "a-skill", description: "does the thing" }])).toBe(1);
    expect(calls.map((c) => c.op)).toEqual(["search", "delete", "create"]); // upsert: stale passage removed first
    const created = calls[2].args[1];
    expect(created && typeof created === "object" && "text" in created ? created.text : "").toBe(skillPassageText("a-skill", "does the thing"));
  } finally {
    if (prev === undefined) delete process.env.MM_NATIVE; else process.env.MM_NATIVE = prev;
  }
});
