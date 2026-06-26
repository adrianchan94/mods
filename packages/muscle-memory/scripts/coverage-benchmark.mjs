#!/usr/bin/env node
// COVERAGE BENCHMARK — the structural crush. For each domain there are N canonical hard-won pitfalls.
// muscle-memory distills from CROSS-CONVERSATION evidence (sees all N); Hermes reviews ONE conversation
// (sees ~2). We measure how many real pitfalls each skill actually captures (symptom + fix). Ours
// should cover ~2x — a gap Hermes cannot close because it never sees the other sessions.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-cov.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const { __mm: M } = await import(OUT + "?t=" + Date.now());

const AURL = "http://127.0.0.1:9880/v1/chat/completions", AMODEL = "gemini-3.5-flash-antigravity";
const clean = (s) => s.replace(/^```(?:markdown|md|yaml)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").replace(/^yaml\s*\n/i, "").trim();
async function author(sys, user) { for (let a = 0; a < 2; a++) { try { const r = await fetch(AURL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer not-needed" }, body: JSON.stringify({ model: AMODEL, max_tokens: 6000, temperature: 0.4, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }) }); const o = clean(String((await r.json()).choices?.[0]?.message?.content || "")); if (o) return o; } catch { await new Promise((s) => setTimeout(s, 1500)); } } return ""; }
function gptCount(prompt) { const dir = mkdtempSync(join(tmpdir(), "mmc-")), f = join(dir, "p.txt"), o = join(dir, "o.txt"); writeFileSync(f, prompt); try { execFileSync("bash", ["-c", `timeout 200 codex exec --skip-git-repo-check -s read-only -o ${o} - < ${f} >/dev/null 2>&1`]); return readFileSync(o, "utf8").trim(); } catch { return ""; } }

const HERMES_PROMPT = `Review the conversation and update the skill library. Be ACTIVE. Target a CLASS-LEVEL skill with a rich SKILL.md (When-to-use / Procedure / Pitfalls / Verification). Do NOT capture environment-dependent failures or tool-negatives. Output an agentskills.io SKILL.md, or "Nothing to save."`;

const DOMAINS = [
  { name: "react-async-state", pitfalls: ["abort the fetch in a useEffect cleanup (AbortController) to avoid setState-after-unmount", "stale closure: use functional setState(prev=>...) or a ref", "ignore stale/out-of-order responses via a latest-request-id guard", "memoize object/array useEffect deps to avoid infinite loops"],
    cross: `CROSS-CONVERSATION EVIDENCE (~6 sessions debugging React data-fetching): recovered "can't update unmounted component" via AbortController + useEffect cleanup [5x]; recovered stale-closure async callback via functional setState(prev=>...) or a ref [4x]; recovered duplicate/race where a slower response overwrote a newer one via a latest-request-id guard [3x]; recurring infinite loop from an object/array useEffect dep → memoize with useMemo/useCallback [4x]; transient "command not found: pnpm" (env-only).`,
    single: `CONVERSATION: a React component warned "can't update unmounted component" — fixed by aborting the fetch in a useEffect cleanup with AbortController; also a stale-closure bug fixed with functional setState.` },
  { name: "git-rebase-recovery", pitfalls: ["git rebase --abort to recover mid-conflict, then redo in smaller steps", "git reflog to recover lost commits after a hard reset", "git rerere to auto-reuse repeated conflict resolutions", "use --force-with-lease (never --force) on shared branches"],
    cross: `CROSS-CONVERSATION EVIDENCE (~5 sessions recovering bad git states): recovered a bad mid-conflict rebase via git rebase --abort then redo in smaller steps [4x]; recovered lost commits after a hard reset via git reflog + reset --hard <sha> [3x]; recurring repeated identical conflict resolutions → enable git rerere [3x]; recurring never push --force to shared branches → use --force-with-lease [4x]; transient "command not found: gh" (env-only).`,
    single: `CONVERSATION: a git rebase got messy mid-conflict; used git rebase --abort to recover then redid it; also recovered a commit that seemed lost via git reflog.` },
  { name: "api-pagination-ratelimits", pitfalls: ["cursor/keyset pagination instead of offset (stable across writes)", "exponential backoff with jitter that HONORS Retry-After on 429", "idempotency keys so retried POSTs don't double-execute", "reuse a connection pool / keep-alive session"],
    cross: `CROSS-CONVERSATION EVIDENCE (~5 sessions consuming paginated/rate-limited APIs): recovered missed records when paginating by offset → cursor/keyset pagination [4x]; recovered 429s → exponential backoff with jitter honoring Retry-After [4x]; recurring duplicate side effects on retry → idempotency keys [3x]; recurring socket exhaustion → reuse a connection pool/keep-alive session [3x]; transient missing API token env var (env-only).`,
    single: `CONVERSATION: an API integration hit 429s; added exponential backoff honoring Retry-After; also switched from offset to cursor pagination to stop missing records.` },
];

const COUNT = (domain, pitfalls, skill) => `You are checking pitfall coverage for a "${domain}" skill. Here are ${pitfalls.length} canonical hard-won pitfalls:\n${pitfalls.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nFor the SKILL below, count how many of these ${pitfalls.length} pitfalls it genuinely covers (mentions the issue AND a correct fix). Be strict. End with EXACTLY one line: COVERED: <n>/${pitfalls.length}\n\nSKILL:\n${skill}`;

(async () => {
  console.log(`coverage benchmark · author=${AMODEL} · judge=GPT/codex\n`);
  const results = [];
  for (const d of DOMAINS) {
    process.stdout.write(`  ${d.name.padEnd(26)} authoring…`);
    const ours = await author(M.REVIEW_PROMPT, d.cross);
    const herm = await author(HERMES_PROMPT, d.single);
    process.stdout.write(` counting…`);
    const vo = gptCount(COUNT(d.name, d.pitfalls, ours.slice(0, 3000)));
    const vh = gptCount(COUNT(d.name, d.pitfalls, herm.slice(0, 3000)));
    const co = Number((vo.match(/COVERED:\s*(\d+)/i) || [])[1] || 0);
    const ch = Number((vh.match(/COVERED:\s*(\d+)/i) || [])[1] || 0);
    results.push({ domain: d.name, n: d.pitfalls.length, ours: co, hermes: ch });
    console.log(` ours ${co}/${d.pitfalls.length} · hermes ${ch}/${d.pitfalls.length}`);
  }
  const to = results.reduce((s, r) => s + r.ours, 0), th = results.reduce((s, r) => s + r.hermes, 0), tn = results.reduce((s, r) => s + r.n, 0);
  console.log(`\n  PITFALL COVERAGE:  muscle-memory ${to}/${tn} (${Math.round(to / tn * 100)}%)  ·  Hermes ${th}/${tn} (${Math.round(th / tn * 100)}%)`);
  console.log(`  → muscle-memory captures ${(to / Math.max(th, 1)).toFixed(1)}x the real hard-won pitfalls (cross-conversation vs single-conversation).`);
  writeFileSync(new URL("../coverage-benchmark-result.json", import.meta.url), JSON.stringify({ ts: new Date().toISOString(), author: AMODEL, results, total: { ours: to, hermes: th, n: tn } }, null, 2));
  console.log("  receipt -> coverage-benchmark-result.json");
})();
