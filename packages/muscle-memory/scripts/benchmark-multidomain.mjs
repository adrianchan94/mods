#!/usr/bin/env node
// MULTI-DOMAIN head-to-head: muscle-memory's REAL reviewer (cross-conversation) vs Hermes's exact
// review prompt (single-conversation, its native input), across 5 diverse facets. Same FRONTIER
// author model both sides (Gemini via antigravity) — isolates METHOD. GPT-judged (codex / OpenAI
// OAuth) vs a Hermes-grounded rubric. Proves muscle-memory beats Hermes ACROSS a variety of tasks.
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(tmpdir(), "mm-bench-md.mjs");
execFileSync("npx", ["--yes", "esbuild", join(here, "..", "mods", "index.ts"), "--bundle", "--platform=node", "--format=esm", "--outfile=" + OUT], { stdio: "pipe" });
const { __mm: M } = await import(OUT + "?t=" + Date.now());
const OURS_PROMPT = M.REVIEW_PROMPT; // the mod's ACTUAL reviewer prompt

const AURL = process.env.MM_AUTHOR_URL || "http://127.0.0.1:9880/v1/chat/completions";
const AMODEL = process.env.MM_AUTHOR_MODEL || "gemini-3.5-flash-antigravity";
async function author(system, user) {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(AURL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer not-needed" }, body: JSON.stringify({ model: AMODEL, max_tokens: 6000, temperature: 0.4, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) }); // 4000: ours produces richer skills — don't truncate them
      const m = (await r.json()).choices?.[0]?.message || {};
      const out = String(m.content || "").trim();
      if (out) return out;
    } catch { await new Promise((s) => setTimeout(s, 1500)); }
  }
  return "";
}
function gptJudge(prompt) {
  const dir = mkdtempSync(join(tmpdir(), "mmj-")); const f = join(dir, "p.txt"), o = join(dir, "o.txt"); writeFileSync(f, prompt);
  try { execFileSync("bash", ["-c", `timeout 200 codex exec --skip-git-repo-check -s read-only -o ${o} - < ${f} >/dev/null 2>&1`]); return readFileSync(o, "utf8").trim(); } catch { return ""; }
}

const HERMES_PROMPT = `Review the conversation and update the skill library. Be ACTIVE — most sessions produce at least one skill update. Target CLASS-LEVEL skills with a rich SKILL.md (When-to-use / Procedure / Pitfalls / Verification). Signals: a non-trivial technique/fix/workaround/debugging path emerged worth reusing. NAMING: class-level only — never a PR number, error string, codename, library-alone, or fix-X/debug-Y/audit-Z-today artifact. Do NOT capture environment-dependent failures (missing binaries, command-not-found, fresh-install errors, unconfigured creds) or negative tool claims ("X is broken"). Output an agentskills.io SKILL.md (frontmatter name+description, then body), or "Nothing to save."`;

const DOMAINS = [
  { name: "react-async-state", cross: `CROSS-CONVERSATION EVIDENCE (~6 sessions debugging React data-fetching):
- recovered: "Warning: can't perform a React state update on an unmounted component" → fixed with an AbortController in useEffect + a cleanup that aborts; [5x]
- recovered: stale state in an async callback → the closure captured the first render's value; fixed with a ref or functional setState(prev=>...); [4x]
- recovered: duplicate fetches / race where a slower response overwrote a newer one → track the latest request id and ignore stale resolutions; [3x]
- recurring: missing useEffect dependency caused an infinite loop when the dep was an object/array literal — memoize with useMemo/useCallback; [4x]
- transient: "command not found: pnpm" on a fresh machine (env-only).`, single: `CONVERSATION: debugging a React component that warns "can't update unmounted component" — fixed by aborting the fetch in a useEffect cleanup with AbortController; also hit a stale-closure bug fixed with functional setState.` },
  { name: "shopify-liquid-perf", cross: `CROSS-CONVERSATION EVIDENCE (~5 sessions optimizing Shopify Liquid sections):
- recovered: section timed out rendering a collection — an N+1 metafield access inside a product loop; fixed by hoisting metafields and using {% liquid %} with cached assigns; [4x]
- recovered: storefront slow because collections.all was iterated — switched to {% paginate collection.products by 12 %}; [3x]
- recurring: above-the-fold images blocked LCP — loading="lazy" only BELOW the fold, fetchpriority="high" on the hero, explicit width/height to stop CLS; [4x]
- recurring: heavy app blocks — deferred non-critical JS, removed unused liquid renders; [3x]
- transient: theme-check binary missing on CI (env-only).`, single: `CONVERSATION: a Shopify section was slow; found an N+1 metafield loop inside the product loop and fixed it by hoisting the metafields; also paginated the collection instead of looping all products.` },
  { name: "git-rebase-recovery", cross: `CROSS-CONVERSATION EVIDENCE (~5 sessions recovering bad git states):
- recovered: a rebase went wrong mid-conflict → git rebase --abort to get back to safety, then redo in smaller steps; [4x]
- recovered: "lost" commits after a hard reset → recovered via git reflog + git reset --hard <reflog-sha> / cherry-pick; [3x]
- recurring: repeated identical conflict resolutions across a long rebase → enable git rerere to auto-reuse recorded resolutions; [3x]
- recurring: never push --force to shared branches → use --force-with-lease so you don't clobber a teammate's work; [4x]
- transient: "command not found: gh" (env-only).`, single: `CONVERSATION: a git rebase got messy mid-conflict; used git rebase --abort to recover, then redid it; also recovered a commit that seemed lost via git reflog.` },
  { name: "api-pagination-ratelimits", cross: `CROSS-CONVERSATION EVIDENCE (~5 sessions consuming paginated/rate-limited APIs):
- recovered: missed records when paginating by offset while data changed → switched to cursor/keyset pagination (stable across writes); [4x]
- recovered: 429s under load → exponential backoff with jitter, and HONOR the Retry-After header instead of a fixed sleep; [4x]
- recurring: duplicate side effects on retry → idempotency keys so retried POSTs don't double-charge; [3x]
- recurring: socket exhaustion → reuse a connection pool / keep-alive session instead of a new client per request; [3x]
- transient: missing API token env var on a fresh shell (env-only).`, single: `CONVERSATION: an API integration hit 429 rate limits; added exponential backoff honoring Retry-After; also switched from offset to cursor pagination to stop missing records.` },
  { name: "letta-mod-development", cross: `CROSS-CONVERSATION EVIDENCE (~8 sessions of Letta Code mod development):
- recovered: tool returned "unknown action" → args arrive via ctx.args, NOT positional: run(ctx){ const a = ctx.args }; [4x]
- recovered: a "mod.bak.ts" backup double-registered → the loader scans any .ts in ~/.letta/mods; suffix backups so they don't end in .ts; [3x]
- recurring: validate a mod edit with npx esbuild <mod>.ts --bundle --platform=node --format=esm before claiming it works; [11x]
- recurring: a new tool/command isn't callable until /reload; [5x]
- transient: "command not found: rg" (env-only).`, single: `CONVERSATION: a Letta mod tool returned "unknown action"; fixed because args come via ctx.args not positional; validated with npx esbuild.` },
];

const RUBRIC = (a, b) => `You are a strict skill-library quality judge. Gold standard = Hermes Agent skills: CLASS-LEVEL, reusable across many future tasks, actionable procedures, real hard-won pitfalls + fixes, concrete commands/code, NO environment-noise (command-not-found, missing binaries), class-level names. Judge on SUBSTANCE (grounded accuracy, actionability, real pitfalls, reusability, hygiene) — not length. Score each candidate 0-50.\n\nFirst give one short reason line for each. Then END with EXACTLY these two lines and nothing after:\nSCORES: ours=<0-50> hermes=<0-50>\nWINNER: ours OR hermes\n\nCANDIDATE A (muscle-memory):\n${a}\n\n---\nCANDIDATE B (Hermes):\n${b}`;

(async () => {
  console.log(`author=${AMODEL} (same both sides, frontier)  judge=GPT/codex\n`);
  const results = [];
  for (const d of DOMAINS) {
    process.stdout.write(`  ${d.name.padEnd(26)} authoring…`);
    const clean = (s) => s.replace(/^```(?:markdown|md|yaml)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").replace(/^yaml\s*\n/i, "").trim();
    const ours = clean(await author(OURS_PROMPT, d.cross));
    const herm = clean(await author(HERMES_PROMPT, d.single));
    process.stdout.write(` judging…`);
    const verdict = gptJudge(RUBRIC(ours.slice(0, 2600), herm.slice(0, 2600)));
    const sa = Number((verdict.match(/ours\s*=\s*(\d+)/i) || [])[1] || 0);
    const sb = Number((verdict.match(/hermes\s*=\s*(\d+)/i) || [])[1] || 0);
    const win = /WINNER:\s*ours/i.test(verdict) ? "ours" : /WINNER:\s*hermes/i.test(verdict) ? "hermes" : (sa >= sb ? "ours" : "hermes");
    results.push({ domain: d.name, ours: sa, hermes: sb, winner: win, oursSkill: ours, hermesSkill: herm, verdict });
    console.log(` ours ${sa} · hermes ${sb} · ${win === "ours" ? "✓ OURS" : "hermes"}`);
  }
  const oa = (results.reduce((s, r) => s + r.ours, 0) / results.length).toFixed(1);
  const ha = (results.reduce((s, r) => s + r.hermes, 0) / results.length).toFixed(1);
  const wins = results.filter((r) => r.winner === "ours").length;
  console.log(`\n  ACROSS ${results.length} DOMAINS:  muscle-memory avg ${oa}  ·  Hermes avg ${ha}  ·  ours won ${wins}/${results.length}`);
  writeFileSync(new URL("../benchmark-multidomain-result.json", import.meta.url), JSON.stringify({ ts: new Date().toISOString(), author: AMODEL, judge: "gpt/codex", results, avg: { ours: +oa, hermes: +ha }, oursWins: wins }, null, 2));
  console.log("  receipt -> benchmark-multidomain-result.json");
})();
