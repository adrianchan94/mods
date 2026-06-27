/**
 * muscle-memory — turns repeated reps into skills, and forgets the ones that don't earn their context.
 *
 * A Letta Code mod that watches your real tool-use, mines recurring workflows/fixes,
 * drafts SKILL.md playbooks (with receipts), keeps writes behind an approval gate, and runs a full
 * anti-bloat lifecycle (born-hard -> usage-tracked -> retired/merged -> capped).
 *
 * ── D1: OBSERVE ──────────────────────────────────────────────────────────────
 * tool_start  -> append a REDACTED fingerprint of every tool call to an experience log.
 * conversation_close -> write a session summary row.
 *
 * ── D2: DETECT ───────────────────────────────────────────────────────────────
 * Deterministic miner over the experience log:
 *  - command-template clustering (recurring Bash/file templates)
 *  - tool n-gram sequences (recurring multi-step workflows within a conversation)
 *  - maturity score = frequency x cross-session spread x resolved-friction (fix patterns)
 * /muscle-memory -> shows stats + the current mature skill candidates.
 *
 * Privacy/safety: does not intentionally store raw args or secret values — only a structural fingerprint,
 * a normalized command template, and a hash. Fire-and-forget; never blocks/transforms.
 *
 * Later (D3-D5): distill (fork -> draft SKILL.md to _proposed/), graduate/retire gate.
 */
import { appendFileSync, mkdirSync, readFileSync, existsSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

const STATE_DIR = process.env.MM_STATE_DIR || join(homedir(), ".letta", "muscle-memory");
const LOG_PATH = join(STATE_DIR, "experience.jsonl");
const SESSIONS_PATH = join(STATE_DIR, "sessions.jsonl");
const GLOBAL_SKILLS_DIR = process.env.MM_GLOBAL_SKILLS_DIR || join(homedir(), ".letta", "skills");

// ── Redaction ────────────────────────────────────────────────────────────────
const SECRETISH = /(?:key|token|secret|password|passwd|auth|bearer|cookie|api[_-]?key)/i;
const LONG_OPAQUE = /\b[A-Za-z0-9_\-]{24,}\b/g;
const HEXID = /\b[0-9a-f]{7,}\b/gi;
const ABS_PATH = /(?:\/[\w.\-~ ]+){2,}/g;
const QUOTED = /(['"])(?:\\.|(?!\1).)*\1/g;
const SECRET_ASSIGN = /\b(?=[A-Za-z_][A-Za-z0-9_]*\s*=)(?=[A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|AUTH|COOKIE|BEARER|API[_-]?KEY|APIKEY))[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s;&]+)/gi;
const SECRET_QUERY = /([?&])(?:access[_-]?token|refresh[_-]?token|api[_-]?key|apikey|key|token|secret|password|passwd|auth|cookie|bearer)=([^&\s]+)/gi;
const SECRET_FLAG = /--(?:api[_-]?key|apikey|key|token|secret|password|passwd|auth|cookie|bearer)(?:=|\s+)(?:"[^"]*"|'[^']*'|[^\s;&]+)/gi;
const SECRET_HEADER = /\b(?:authorization|cookie|x-api-key|api-key)\s*:\s*(?:"[^"]*"|'[^']*'|[^\s;&]+)/gi;
const NUM = /\b\d+\b/g;

export function commandTemplate(cmd: string): string {
  let t = String(cmd).trim();
  // Scrub the credential token that FOLLOWS a bearer/token keyword (e.g. "Bearer sk-...").
  // Runs FIRST: header/flag rules only consume the first word after the colon, which would
  // otherwise orphan the actual secret token. Catch "Bearer <token>" before anything eats "Bearer".
  t = t.replace(/\b(?:bearer|token|apikey|api[_-]?key)\s+[^\s;&"']+/gi, "<cred> <redacted>");
  // Scrub key=value / query / flag / header secret forms before generic cleanup so
  // short unquoted credential values do not leave partial fragments behind.
  t = t.replace(SECRET_ASSIGN, "<cred>=<redacted>");
  t = t.replace(SECRET_QUERY, "$1<cred>=<redacted>");
  t = t.replace(SECRET_FLAG, "--<cred>=<redacted>");
  t = t.replace(SECRET_HEADER, "<cred>:<redacted>");
  t = t.replace(QUOTED, "<str>");
  // Scrub secret-adjacent labels too, not only values. Even harmless phrases like
  // "bearer authenticate" should not survive into persistent fingerprints.
  t = t.replace(/\b(?:bearer|authorization|api[_-]?key|api\s+key|token|secret|password|passwd|cookie)\b/gi, "<cred>");
  t = t.replace(ABS_PATH, "<path>");
  t = t.replace(HEXID, "<id>");
  t = t.replace(LONG_OPAQUE, "<id>");
  t = t.replace(NUM, "<n>");
  t = t.replace(/\s+/g, " ").trim();
  return t.slice(0, 240);
}

const HIGH_SIGNAL_TOOL_SET = new Set(["visual_receipt", "im8_claims_lint", "no_cap_gate_check", "repo_radar_evidence", "kev_final_buzzer_gate", "im8_theme_done_gate", "im8_product_intel", "im8_write_plan"]);

function hostOrToken(s: unknown): string {
  const raw = String(s || "");
  try { return new URL(raw).hostname.replace(/^www\./, ""); } catch { return slug(raw).slice(0, 48) || "unknown"; }
}
function countMaybeArray(v: unknown): number { return Array.isArray(v) ? v.length : v == null ? 0 : 1; }

export function fingerprint(tool: string, args: Record<string, unknown>): { fp: string; tmpl: string | null } {
  let tmpl: string | null = null;
  const keys = Object.keys(args || {}).sort();
  if (tool === "Bash" && typeof args?.command === "string") {
    tmpl = commandTemplate(args.command);
  } else if (tool === "exec_command" && typeof args?.cmd === "string") {
    // Codex/default toolsets expose shell as exec_command(cmd) rather than Bash(command).
    // Normalize it into the same command-template lane so cloud and local reps both mature.
    tmpl = commandTemplate(args.cmd);
  } else if ((tool === "Read" || tool === "Edit" || tool === "Write" || tool === "fast_apply") && typeof args?.file_path === "string") {
    const ext = (String(args.file_path).match(/\.[A-Za-z0-9]+$/)?.[0]) || "";
    tmpl = `${tool} <path>${ext}`;
  } else if (tool === "Grep" || tool === "Glob" || tool === "structural_search") {
    tmpl = `${tool} ${keys.join(",")}`;
  } else if (tool === "Skill" && typeof args?.skill === "string") {
    tmpl = `Skill ${slug(String(args.skill))}`;
  } else if (tool === "visual_receipt") {
    tmpl = `visual_receipt ${hostOrToken(args?.url)} ${countMaybeArray(args?.viewports)} viewports ${countMaybeArray(args?.selectors)} selectors`;
  } else if (tool === "im8_claims_lint") {
    tmpl = `im8_claims_lint supplement-copy ${countMaybeArray(args?.files)} files`;
  } else if (tool === "no_cap_gate_check") {
    tmpl = `no_cap_gate_check high-trust-claim`;
  } else if (tool === "repo_radar_evidence" && typeof args?.kind === "string") {
    tmpl = `repo_radar_evidence ${slug(String(args.kind))}`;
  } else if (tool === "kev_final_buzzer_gate") {
    tmpl = `kev_final_buzzer_gate final-readiness`;
  } else if (tool === "im8_theme_done_gate") {
    tmpl = `im8_theme_done_gate theme-readiness`;
  } else if (tool === "im8_product_intel") {
    tmpl = `im8_product_intel ${slug(String(args?.mode || "lookup"))}`;
  } else if (tool === "im8_write_plan") {
    tmpl = `im8_write_plan ${slug(String(args?.operation || "write-plan"))}`;
  }
  const shape = keys.filter((k) => !SECRETISH.test(k)).join(",");
  const fp = `${tool}(${shape})${tmpl ? " :: " + tmpl : ""}`;
  return { fp, tmpl };
}

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// ── D2: DETECT (pure, deterministic — the testable core) ─────────────────────
// v2 (0.27.18): rows carry an outcome (ok) + error class (err) + a call id so
// tool_end outcomes can be merged onto tool_start observations.
export type Row = { ts?: number; conv?: string | null; tool: string; fp: string; tmpl?: string | null; h?: string; ok?: boolean; err?: string | null; id?: string };

export type Candidate = {
  kind: "template" | "sequence";
  key: string;
  count: number;
  convs: number;          // distinct conversations (cross-session spread)
  fixes: number;          // occurrences that recovered an error (false->true)
  maturity: number;
  mature: boolean;
};

// Tunable, conservative thresholds (born-hard — keeps the bank lean).
export const MM = {
  MIN_COUNT: 3,           // must recur >= 3x
  MIN_CONVS: 2,           // cross-session spread OR ...
  STRONG_SINGLE: 8,       // ... heavily repeated within a single session (both are "you do this a lot")
  MATURE_AT: 3.0,         // maturity score threshold to become a candidate
  NGRAM: 2,               // workflow transition (verb bigram) — empirically the right granularity
  // weights
  W_FREQ: 1.0, W_SPREAD: 1.5, W_FIX: 2.0,
};

function maturityScore(count: number, convs: number, fixes: number): number {
  return MM.W_FREQ * Math.log2(count) + MM.W_SPREAD * (convs - 1) + MM.W_FIX * (fixes > 0 ? 1 : 0);
}

function isMature(count: number, convs: number, m: number): boolean {
  const enoughSpread = convs >= MM.MIN_CONVS || count >= MM.STRONG_SINGLE;
  return count >= MM.MIN_COUNT && enoughSpread && m >= MM.MATURE_AT;
}

// Trivial verbs carry no procedural meaning on their own — a sequence made only of
// these is noise, not a skill.
const TRIVIAL = new Set(["echo", "cd", "ls", "cat", "true", "pwd", "sleep", ":"]);
// Multi-subcommand tools where the 2nd token is the meaningful verb (git commit vs git add).
const SUBCMD = new Set(["git", "letta", "npm", "npx", "gh", "docker", "cargo", "bun", "pnpm", "yarn", "kubectl", "jq"]);

/** Extract the salient "what does this step DO" signature from a row. */
export function stepSig(row: Row): string {
  if (row.tool !== "Bash") {
    // file ops / other tools: tool + ext if present (Edit .md, Read .ts)
    const m = (row.tmpl || "").match(/\.[A-Za-z0-9]+$/);
    return m ? `${row.tool}${m[0]}` : row.tool;
  }
  const t = (row.tmpl || "").replace(/\bcd <[^>]+>\s*&&\s*/g, " ").replace(/\becho <str>\s*&&?\s*/g, " ");
  // first meaningful command across &&, |, ; segments
  for (const seg of t.split(/&&|\|\||\||;/)) {
    const toks = seg.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    let v = toks[0].replace(/^.*\//, ""); // strip path prefix
    if (TRIVIAL.has(v)) continue;
    if (SUBCMD.has(v) && toks[1] && /^[a-z]/i.test(toks[1])) v = `${v} ${toks[1]}`;
    return v.slice(0, 24);
  }
  return "Bash";
}

/** Mine recurring command/file templates. */
export function detectTemplates(rows: Row[]): Candidate[] {
  const byKey = new Map<string, { count: number; convs: Set<string>; fixes: number; lastFail: boolean }>();
  // track per-conversation fail->success recovery on the same template
  const failPending = new Map<string, boolean>(); // key=conv|tmpl
  for (const r of rows) {
    if (!r.tmpl) continue;
    const k = r.tmpl;
    let e = byKey.get(k);
    if (!e) { e = { count: 0, convs: new Set(), fixes: 0, lastFail: false }; byKey.set(k, e); }
    e.count++;
    e.convs.add(String(r.conv ?? "?"));
    const fk = `${r.conv}|${k}`;
    if (r.ok === false) failPending.set(fk, true);
    else if (r.ok === true && failPending.get(fk)) { e.fixes++; failPending.set(fk, false); }
  }
  return finalize("template", byKey);
}

/** Mine recurring n-gram tool sequences within a conversation. */
export function detectSequences(rows: Row[], n = MM.NGRAM): Candidate[] {
  const byConv = new Map<string, Row[]>();
  for (const r of rows) {
    const c = String(r.conv ?? "?");
    if (!byConv.has(c)) byConv.set(c, []);
    byConv.get(c)!.push(r);
  }
  const byKey = new Map<string, { count: number; convs: Set<string>; fixes: number }>();
  for (const [conv, rs] of byConv) {
    rs.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    for (let i = 0; i + n <= rs.length; i++) {
      const win = rs.slice(i, i + n);
      const sigs = win.map(stepSig);
      // Meaningfulness guard: a window with <2 distinct steps, or all-Bash-generic, is noise.
      const distinct = new Set(sigs);
      if (distinct.size < 2) continue;
      if (sigs.every((s) => s === "Bash")) continue;
      const gram = sigs.join(" → ");
      let e = byKey.get(gram);
      if (!e) { e = { count: 0, convs: new Set(), fixes: 0 }; byKey.set(gram, e); }
      e.count++;
      e.convs.add(conv);
      if (win.some((x) => x.ok === false)) e.fixes++;
    }
  }
  return finalize("sequence", byKey as any);
}

function finalize(kind: "template" | "sequence", byKey: Map<string, { count: number; convs: Set<string>; fixes: number }>): Candidate[] {
  const out: Candidate[] = [];
  for (const [key, e] of byKey) {
    const convs = e.convs.size;
    const m = maturityScore(e.count, convs, e.fixes);
    const mature = isMature(e.count, convs, m);
    out.push({ kind, key, count: e.count, convs, fixes: e.fixes, maturity: +m.toFixed(2), mature });
  }
  return out.sort((a, b) => b.maturity - a.maturity);
}

// A single tool-call primitive (read a file, write a file, grep) is never a "skill".
// Skills are multi-step workflows or distinctive command pipelines.
const PRIMITIVE = /^(Read|Write|Edit|Glob|Grep|fast_apply|structural_search)\b/;
export function isSkillWorthy(c: Candidate): boolean {
  if (!c.mature) return false;
  if (c.kind === "template" && PRIMITIVE.test(c.key)) return false; // primitive file-op, not a skill
  return true;
}

export function detect(rows: Row[]): { templates: Candidate[]; sequences: Candidate[]; candidates: Candidate[] } {
  const templates = detectTemplates(rows);
  const sequences = detectSequences(rows);
  const candidates = [...templates, ...sequences].filter(isSkillWorthy).sort((a, b) => b.maturity - a.maturity);
  return { templates, sequences, candidates };
}

// ── State I/O ────────────────────────────────────────────────────────────────
function ensureDir() { try { mkdirSync(STATE_DIR, { recursive: true }); } catch { /* */ } }
function appendJsonl(path: string, row: unknown) {
  try { ensureDir(); appendFileSync(path, JSON.stringify(row) + "\n"); } catch { /* tap must never throw */ }
}
export function loadRows(path = LOG_PATH): Row[] {
  if (!existsSync(path)) return [];
  const rows: Row[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    try { rows.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return rows;
}

// ── D3: DISTILL / GRADUATE / HOT-LOAD / REFINE (Hermes-style skill_manage) ────
const GLOBAL_SKILLS = join(homedir(), ".letta", "skills");
const MM_TAG = "muscle-memory provenance"; // marker that tags a muscle-memory-managed skill

/** Resolve the agent-scoped skills dir (compounds via MemFS); fall back to global. Portable. */
function agentSkillsDir(ctx?: any): string {
  if (process.env.MEMORY_DIR) return join(process.env.MEMORY_DIR, "skills");
  const id = ctx?.agent?.id || ctx?.agentId;
  if (id) {
    // Prefer the projected agent MemFS path that the Skill shelf indexes. The local-backend
    // mirror can exist but be seatbelt-inaccessible / invisible to the normal Skill tool.
    const projected = join(homedir(), ".letta", "agents", id, "memory", "skills");
    if (existsSync(join(homedir(), ".letta", "agents", id, "memory"))) return projected;
    const local = join(homedir(), ".letta", "lc-local-backend", "memfs", id, "memory", "skills");
    if (existsSync(join(homedir(), ".letta", "lc-local-backend", "memfs", id))) return local;
  }
  return GLOBAL_SKILLS;
}
/** Dirs to scan for list/dedup: agent-scoped + global (deduped). */
function scanDirs(ctx?: any): string[] { return [...new Set([agentSkillsDir(ctx), GLOBAL_SKILLS])]; }

function slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64); }
function listSkillNames(dir: string): string[] { try { return readdirSync(dir).filter((n) => existsSync(join(dir, n, "SKILL.md"))); } catch { return []; } }
function readSkill(dir: string, name: string): string { try { return readFileSync(join(dir, name, "SKILL.md"), "utf8"); } catch { return ""; } }
function skillDesc(dir: string, name: string): string { return (readSkill(dir, name).match(/description:\s*(.+)/)?.[1] || "").trim(); }
function isManaged(dir: string, name: string): boolean { return readSkill(dir, name).includes(MM_TAG); }
function writeSkill(dir: string, name: string, content: string): string {
  mkdirSync(join(dir, name), { recursive: true });
  const tmp = join(dir, name, ".SKILL.md.tmp"); writeFileSync(tmp, content); renameSync(tmp, join(dir, name, "SKILL.md"));
  return join(dir, name, "SKILL.md");
}
/** Anti-bloat gate: refuse near-duplicate skills (token overlap on description), scanning all dirs. */
export function dedupCheck(name: string, description: string, dirs: string[] = [GLOBAL_SKILLS]): { dup: boolean; reason: string; name: string; overlap: number } {
  const words = new Set(description.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  let worst = { name: "", overlap: 0 };
  for (const dir of dirs) {
    for (const n of listSkillNames(dir)) {
      if (n === name) return { dup: true, reason: `skill '${n}' already exists — patch it, don't duplicate`, name: n, overlap: 1 };
      const dw = new Set(skillDesc(dir, n).toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      let inter = 0; for (const w of words) if (dw.has(w)) inter++;
      const overlap = words.size ? inter / words.size : 0;
      if (overlap > worst.overlap) worst = { name: n, overlap };
    }
  }
  return { dup: worst.overlap > 0.6, reason: worst.overlap > 0.6 ? `>60% description overlap with '${worst.name}' — patch/absorb instead` : "", name: worst.name, overlap: worst.overlap };
}

function candidateName(c: Candidate): string {
  const key = c.key.replace(/<[^>]+>/g, "").replace(/[(){}]/g, "").replace(/→/g, " to ");
  // Drop tool/primitive words + the shell-script extension, and DEDUPE repeated tokens, so the
  // deterministic fallback name stays clean (e.g. "rename-photos.sh ~/Photos" → "rename-photos", not
  // "rename-photos-sh-photos-workflow"). Keep content tokens (md/py/json) — they carry meaning. 2026-06-27.
  const STOP = new Set(["str", "path", "url", "read", "write", "edit", "bash", "sh"]);
  const seen = new Set<string>();
  const words = key.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w) && !seen.has(w) && seen.add(w));
  const base = words.slice(0, 5).join("-") || (c.kind === "sequence" ? "recurring-workflow" : "recurring-command");
  // append "-workflow" only for a lone word; multi-word bases already read as a class-level name
  const name = (words.length >= 2 || /ing$/.test(base)) ? base : `${base}-workflow`;
  return slug(name);
}
function candidateDescription(c: Candidate): string {
  return `Use when repeating the observed ${c.kind} workflow '${c.key}' (${c.count} reps across ${c.convs} conversation${c.convs === 1 ? "" : "s"}${c.fixes ? `, ${c.fixes} error-recovery reps` : ""}); trigger on similar repeated tool-use, validation, or repair loops.`;
}
function draftSkillFromCandidate(c: Candidate): { name: string; description: string; body: string } {
  const name = candidateName(c);
  const description = candidateDescription(c);
  const parts = c.key.split(/\s*→\s*/).filter(Boolean);
  const steps = parts.length > 1
    ? parts.map((s, i) => `${i + 1}. **${s}** — perform this step intentionally; adapt paths/args to the current repo/session.`).join("\n")
    : `1. **${c.key}** — run the recurring command/template only after confirming the current repo/session context.\n2. Inspect the output and capture the success/failure receipt.\n3. If it fails, patch the root cause and rerun the same validation once.`;
  const recovery = c.fixes
    ? `\n## Failure recovery\nThis pattern includes ${c.fixes} observed error-recovery rep${c.fixes === 1 ? "" : "s"}. Preserve the recovery loop:\n\n1. Treat the first failure as diagnostic signal, not random noise.\n2. Inspect the concrete error output.\n3. Patch the smallest root cause.\n4. Rerun the same validation command/tool before claiming fixed.\n`
    : "";
  const body = `# ${name}\n\nThis skill was drafted from repeated real tool-use captured by muscle-memory. Treat it as a starting playbook: refine after the next successful/failed use.\n\n## Trigger\n${description}\n\n## Observed pattern\n\`\`\`text\n${c.key}\n\`\`\`\n\n- Kind: ${c.kind}\n- Repetitions: ${c.count}\n- Conversation spread: ${c.convs}\n- Error-recovery reps: ${c.fixes}\n- Maturity score: ${c.maturity}\n\n## Procedure\n${steps}${recovery}\n## Verification\n- Capture the concrete command/tool output that proves the workflow succeeded.\n- If this touches files, inspect diff/status before claiming done.\n- If this changes a package/mod, bundle/import or run its package-local test.\n- If this is visual/frontend work, require visual receipts plus computed boxes, not presence-only proof.\n\n## Anti-bloat / refinement rule\n- Patch this skill in place when a step is too vague, stale, or misses a failure mode.\n- Do not create a duplicate skill for the same workflow; merge or absorb instead.\n- Retire/quarantine it if future usage shows it does not earn its context.\n`;
  return { name, description, body };
}
function findCandidate(candidateKey?: string): Candidate | undefined {
  const { candidates } = detect(loadExperience()); // v2: outcome-aware
  if (!candidateKey) return candidates[0];
  return candidates.find((c) => c.key === candidateKey || c.key.includes(candidateKey));
}
/** v2: find the repair chain whose trigger matches a candidate's first step, if any. */
function repairForCandidate(c: Candidate): RepairChain | undefined {
  if (!c.fixes) return undefined;
  const first = c.key.split(/\s*→\s*/)[0];
  return detectRepairChains(loadExperience()).find((r) => r.trigger === first || c.key.includes(r.trigger));
}

function managedSkillUsage(name: string, rows: Row[] = loadRows()): number {
  const n = slug(name);
  return rows.filter((r) => (r.tmpl || r.fp || "").toLowerCase().includes(`skill ${n}`)).length;
}
function curateManagedSkills(ctx?: any) {
  const rows = loadRows();
  const dirs = scanDirs(ctx);
  const out: Array<{ name: string; dir: string; uses: number; verdict: "keep" | "review" | "retire_candidate"; reason: string }> = [];
  for (const d of dirs) {
    for (const n of listSkillNames(d)) {
      if (!isManaged(d, n)) continue;
      const uses = managedSkillUsage(n, rows);
      let verdict: "keep" | "review" | "retire_candidate" = "keep";
      let reason = "managed skill has observed use or is newly created";
      if (uses === 0) { verdict = "review"; reason = "no observed Skill-tool usage yet; keep if newly created, retire if stale"; }
      out.push({ name: n, dir: d, uses, verdict, reason });
    }
  }
  return out.sort((a, b) => a.uses - b.uses || a.name.localeCompare(b.name));
}
function retireManagedSkill(name: string, reason: string, ctx?: any, absorbedInto?: string): string {
  const dirs = scanDirs(ctx);
  const d = dirs.find((x) => existsSync(join(x, name, "SKILL.md")));
  if (!d) throw new Error(`no skill '${name}'`);
  if (!isManaged(d, name)) throw new Error(`refusing to retire unmanaged skill '${name}'`);
  if (isPinned(name)) throw new Error(`'${name}' is pinned — unpin first (pin protects from retire, not from patch)`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const retiredRoot = join(d, "_retired");
  mkdirSync(retiredRoot, { recursive: true });
  const target = join(retiredRoot, `${name}-${stamp}`);
  const forward = absorbedInto ? `absorbed_into: ${absorbedInto}\n` : "";
  writeFileSync(join(d, name, "RETIRE-REASON.txt"), `${new Date().toISOString()}\n${reason || "retired by muscle-memory curate"}\n${forward}`);
  renameSync(join(d, name), target);
  // record the lifecycle event in the usage sidecar (reversible quarantine, Hermes "never delete")
  const u = loadUsage(); u[name] = { ...(u[name] || {}), state: "archived", absorbedInto: absorbedInto || undefined }; saveUsage(u);
  return target;
}

export function runAutonomousPrune(ctx?: any, opts: { maxRetire?: number } = {}): { retired: string[]; retiredPaths: string[]; flagged: string[]; kept: string[] } {
  const maxRetire = Math.max(0, opts.maxRetire ?? 1);
  const usage = loadUsage();
  const now = Date.now();
  const retired: string[] = [];
  const retiredPaths: string[] = [];
  const flagged: string[] = [];
  const kept: string[] = [];

  for (const d of scanDirs(ctx)) {
    for (const n of listSkillNames(d)) {
      if (!isManaged(d, n)) { kept.push(n); continue; }
      const u = usage[n] || {};
      if (u.pinned) { kept.push(n); continue; }
      const uses = u.uses || 0;
      if (uses > 0 || u.lastActivity) { kept.push(n); continue; }
      const created = u.created || now;
      const ageDays = Math.floor((now - created) / 86400000);
      if (ageDays > 30 && retired.length < maxRetire) {
        const reason = `auto-prune: 0 uses in ${ageDays}d — not earning context (reversible quarantine)`;
        const target = retireManagedSkill(n, reason, ctx);
        retired.push(n);
        retiredPaths.push(target);
        appendUiEvent({ phase: "skill_retired", summary: `retired '${n}' (0 uses, ${ageDays}d) — reversible`, skill: n, action: "retire", route: "auto-prune" });
        appendMeshFeed({ type: "skill_retired", skill: n, route: "AUTO-PRUNE", signals: 0 });
      } else if (ageDays > 14) {
        flagged.push(n);
        appendUiEvent({ phase: "skill_review", summary: `review '${n}' (0 uses, ${ageDays}d)`, skill: n, action: "review", route: "auto-prune" });
      } else {
        kept.push(n);
      }
    }
  }
  if (retired.length) writeUiState({ phase: "done", last: `retired '${retired[0]}' — reversible`, route: "AUTO-PRUNE · live" });
  return { retired, retiredPaths, flagged, kept };
}

// ════════════════════════════════════════════════════════════════════════════
// v2 (Letta Code 0.27.18) — outcome-aware learning, repair chains, impact scoring,
// authoring linter, anti-patterns, effectiveness retirement, llm/compact telemetry.
// Pure + deterministic where it matters; the harness proves each piece.
// ════════════════════════════════════════════════════════════════════════════
const OUTCOME_PATH = join(STATE_DIR, "outcomes.jsonl");
const TELEMETRY_PATH = join(STATE_DIR, "telemetry.json");
const RECEIPTS_DIR = join(STATE_DIR, "receipts");

// — A. OUTCOME CAPTURE (tool_end) —
/** Classify + REDACT a tool failure into a short stable error class (never secrets/payloads). */
export function classifyError(resultText: unknown, ok?: boolean): string | null {
  if (ok !== false) return null;
  const raw = String(resultText ?? "");
  const line = raw.split("\n").find((l) => /error|fail|cannot|not found|denied|refused|invalid|unexpected|exit code|ENOENT|EACCES|EPERM|timed out/i.test(l)) || raw.slice(0, 160);
  const cls = commandTemplate(line); // reuse the secret-scrubbing template engine
  return (cls || "error").slice(0, 120) || "error";
}
/** Merge tool_end outcomes onto tool_start rows by call id. Pure + testable. */
export function mergeOutcomes(rows: Row[], ends: Array<{ id?: string; ok?: boolean; err?: string | null }>): Row[] {
  const byId = new Map<string, { ok?: boolean; err?: string | null }>();
  for (const e of ends) if (e.id) byId.set(e.id, { ok: e.ok, err: e.err ?? null });
  return rows.map((r) => (r.id && byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r));
}
export type Outcome = { id?: string | null; ok?: boolean; err?: string | null; tool?: string | null; conv?: string | null; ts?: number };
/** v2.1: correlate tool_end outcomes onto tool_start rows. Exact id when present; else
 * (conv + tool + nearest unmatched start within window); else FIFO oldest unmatched in conv;
 * else drop. Handles local backends that omit toolCallId on tool_start. Pure + testable. */
export function correlateOutcomes(starts: Row[], ends: Outcome[], opts: { windowMs?: number } = {}): Row[] {
  const windowMs = opts.windowMs ?? 5 * 60 * 1000;
  const rows = starts.map((r) => ({ ...r }));
  const used = new Set<number>();
  const byId = new Map<string, number>();
  rows.forEach((r, i) => { if (r.id != null && !byId.has(String(r.id))) byId.set(String(r.id), i); });
  const pending: Outcome[] = [];
  for (const e of ends) {
    const eid = e.id != null ? String(e.id) : null;
    if (eid && byId.has(eid) && !used.has(byId.get(eid)!)) { const i = byId.get(eid)!; rows[i].ok = e.ok; rows[i].err = e.err ?? null; used.add(i); }
    else pending.push(e);
  }
  for (const e of [...pending].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))) {
    const cands = rows.map((r, i) => ({ r, i })).filter(({ r, i }) => !used.has(i) && r.ok === undefined && String(r.conv) === String(e.conv) && (e.ts ?? 0) - (r.ts ?? 0) >= 0 && (e.ts ?? 0) - (r.ts ?? 0) <= windowMs);
    if (!cands.length) continue;
    let pick;
    if (e.tool != null) {
      const same = cands.filter((c) => c.r.tool === e.tool);
      const pool = same.length ? same : cands;
      pick = pool.reduce((a, b) => ((e.ts ?? 0) - (a.r.ts ?? 0)) <= ((e.ts ?? 0) - (b.r.ts ?? 0)) ? a : b); // nearest preceding
    } else {
      pick = cands.reduce((a, b) => (a.r.ts ?? 0) <= (b.r.ts ?? 0) ? a : b); // FIFO oldest unmatched
    }
    rows[pick.i].ok = e.ok; rows[pick.i].err = e.err ?? null; used.add(pick.i);
  }
  return rows;
}
function loadOutcomes(): Outcome[] {
  if (!existsSync(OUTCOME_PATH)) return [];
  const out: Outcome[] = [];
  for (const l of readFileSync(OUTCOME_PATH, "utf8").split("\n")) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { /* skip */ } }
  return out;
}
/** v2.1 experience = starts correlated with their outcomes (id-exact + fallback). */
export function loadExperience(): Row[] { return correlateOutcomes(loadRows(), loadOutcomes()); }

// — A2. REPAIR CHAINS: FAIL(x) → EDIT/PATCH → PASS(x') within a conversation —
export type RepairChain = { trigger: string; errClass: string; fixStep: string; verifyStep: string; count: number; convs: number };
const FIX_VERBS = /^(Edit|Write|fast_apply|git commit|git add|patch|sed|npm|npx|bun|cargo)/i;
export function detectRepairChains(rows: Row[]): RepairChain[] {
  const byConv = new Map<string, Row[]>();
  for (const r of rows) { const c = String(r.conv ?? "?"); (byConv.get(c) ?? byConv.set(c, []).get(c)!).push(r); }
  const acc = new Map<string, { errClass: string; count: number; convs: Set<string> }>();
  for (const [conv, rs] of byConv) {
    rs.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
    for (let i = 0; i < rs.length; i++) {
      if (rs[i].ok !== false) continue;            // a failure
      const trigger = stepSig(rs[i]); const errClass = rs[i].err || classifyError("", false) || "error";
      // look ahead up to 6 steps for a fix verb then a later success of the same trigger
      let fixStep = ""; 
      for (let j = i + 1; j < Math.min(rs.length, i + 7); j++) {
        const sig = stepSig(rs[j]);
        if (!fixStep && FIX_VERBS.test(sig)) fixStep = sig;
        if (fixStep && rs[j].ok === true && stepSig(rs[j]) === trigger) {
          const key = `${trigger}|${fixStep}`;
          const e = acc.get(key) ?? { errClass, count: 0, convs: new Set<string>() };
          e.count++; e.convs.add(conv); acc.set(key, e);
          break;
        }
      }
    }
  }
  return [...acc.entries()].map(([k, e]) => { const [trigger, fixStep] = k.split("|"); return { trigger, errClass: e.errClass, fixStep, verifyStep: trigger, count: e.count, convs: e.convs.size }; })
    .sort((a, b) => b.count - a.count);
}

// — A3. ANTI-PATTERNS: recurring FAILs that never recover → "don't do X" tombstones —
export type AntiPattern = { step: string; errClass: string; fails: number; recovered: number; convs: number };
export function detectAntiPatterns(rows: Row[]): AntiPattern[] {
  const repairs = new Set(detectRepairChains(rows).map((r) => r.trigger));
  const acc = new Map<string, { errClass: string; fails: number; convs: Set<string> }>();
  for (const r of rows) {
    if (r.ok !== false) continue;
    const step = stepSig(r); const e = acc.get(step) ?? { errClass: r.err || "error", fails: 0, convs: new Set<string>() };
    e.fails++; e.convs.add(String(r.conv ?? "?")); if (r.err) e.errClass = r.err; acc.set(step, e);
  }
  return [...acc.entries()].filter(([step, e]) => e.fails >= 2 && !repairs.has(step))
    .map(([step, e]) => ({ step, errClass: e.errClass, fails: e.fails, recovered: 0, convs: e.convs.size }))
    .sort((a, b) => b.fails - a.fails);
}

// — B. IMPACT SCORE: outcome-aware, not just repetition —
export type Impact = { score: number; repetition: number; spread: number; fixes: number; recency: number; safety: number; bloat: number };
const DESTRUCTIVE = /\b(rm|rmdir|drop|delete|truncate|reset --hard|force|push --force|mkfs|dd)\b/i;
export function impactScore(c: Candidate, opts: { nowConvIdx?: number; convIdx?: number; bloatOverlap?: number } = {}): Impact {
  const repetition = Math.log2(Math.max(1, c.count));
  const spread = c.convs - 1;
  const fixes = c.fixes;
  const recency = 1; // hook: decays with age when ts wired; neutral here
  const safety = DESTRUCTIVE.test(c.key) ? -2 : 0;            // destructive workflows are risky to bottle
  const bloat = -(opts.bloatOverlap ?? 0) * 2;               // penalize near-dupes
  const score = +(1.0 * repetition + 1.5 * spread + 2.0 * (fixes > 0 ? 1 : 0) + recency + safety + bloat).toFixed(2);
  return { score, repetition: +repetition.toFixed(2), spread, fixes, recency, safety, bloat: +bloat.toFixed(2) };
}

// — my-add #1. AUTHORING LINTER (the highest-ROI anti-bloat lever) —
export function lintSkillDraft(d: { name: string; description: string; body: string }, opts: { needsPitfalls?: boolean } = {}): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.name)) issues.push("name must be lowercase-hyphen slug");
  if (d.name.length > 64) issues.push("name > 64 chars");
  if (!d.description || d.description.length < 20) issues.push("description too short");
  if (!/\b(use when|trigger|when )/i.test(d.description)) issues.push("description must state WHEN to use (trigger phrase)");
  if (d.description.length > 700) issues.push("description > 700 chars (keep routing lean)");
  const approxTokens = Math.ceil(d.body.length / 4);
  if (approxTokens > 5000) issues.push(`body ~${approxTokens} tokens > 5000 (decompose into references/)`);
  if (!/##\s+procedure/i.test(d.body)) issues.push("body missing ## Procedure");
  if (!/##\s+verification/i.test(d.body)) issues.push("body missing ## Verification");
  if (opts.needsPitfalls && !/##\s+(pitfalls|failure recovery)/i.test(d.body)) issues.push("fix-pattern skill must include ## Pitfalls / Failure recovery");
  return { ok: issues.length === 0, issues };
}

// — my-add #4 / D: EFFECTIVENESS-DRIVEN RETIREMENT + telemetry aggregation —
export type LlmSpan = { tokensIn?: number; tokensOut?: number; ms?: number; stop?: string };
export function aggregateTelemetry(spans: LlmSpan[]): { calls: number; tokensIn: number; tokensOut: number; ms: number } {
  // aggregate ONLY — never store raw prompts/messages.
  return spans.reduce((a, s) => ({ calls: a.calls + 1, tokensIn: a.tokensIn + (s.tokensIn || 0), tokensOut: a.tokensOut + (s.tokensOut || 0), ms: a.ms + (s.ms || 0) }), { calls: 0, tokensIn: 0, tokensOut: 0, ms: 0 });
}
/** Outcome-driven verdict for a managed skill (Library-Drift load-bearing mechanism). */
export function effectivenessVerdict(input: { uses: number; ageDays: number; staleAntiPattern: boolean }): { verdict: "keep" | "review" | "retire_candidate"; reason: string } {
  if (input.staleAntiPattern) return { verdict: "retire_candidate", reason: "the failure it targeted keeps recurring — skill isn't working" };
  if (input.uses === 0 && input.ageDays > 14) return { verdict: "retire_candidate", reason: `0 uses in ${input.ageDays}d — not earning its context` };
  if (input.uses === 0) return { verdict: "review", reason: "no observed use yet — keep if newly created" };
  return { verdict: "keep", reason: `used ${input.uses}×` };
}

// — repair-aware draft: auto-embed observed error→fix as ## Pitfalls —
export function draftWithRepair(c: Candidate, repair?: RepairChain): { name: string; description: string; body: string } {
  const base = draftSkillFromCandidate(c);
  if (!repair) return base;
  const pit = `\n## Pitfalls (observed)\n- **${repair.errClass}** — recovered ${repair.count}× via \`${repair.fixStep}\` then re-running \`${repair.verifyStep}\`. Expect this failure; apply the fix instead of guessing.\n`;
  const body = base.body.replace(/\n## Verification/, `${pit}\n## Verification`);
  return { ...base, body };
}

// — E. REGISTRY CATALOG (Hermes-like mini package registry) —
const REGISTRY_PATH = join(STATE_DIR, "registry.json");
export function buildRegistry(dirs: string[]): { generated: string; count: number; skills: Array<{ name: string; description: string; dir: string; provenance: string; state: string; pinned: boolean; uses: number; absorbedInto?: string }> } {
  const usage = loadUsage();
  const skills: Array<{ name: string; description: string; dir: string; provenance: string; state: string; pinned: boolean; uses: number; absorbedInto?: string }> = [];
  for (const d of dirs) for (const n of listSkillNames(d)) {
    if (!isManaged(d, n)) continue;
    const prov = (readSkill(d, n).match(/<!--\s*muscle-memory provenance:([^>]*)-->/)?.[1] || "").trim();
    const u = usage[n] || {};
    skills.push({ name: n, description: skillDesc(d, n), dir: d, provenance: prov, state: u.state || "active", pinned: !!u.pinned, uses: u.uses || 0, absorbedInto: u.absorbedInto });
  }
  return { generated: new Date().toISOString(), count: skills.length, skills: skills.sort((a, b) => a.name.localeCompare(b.name)) };
}
/** Curator pass: pure, fake-clock-testable lifecycle walk (active→stale→archived→reactivate, pin-frozen). */
export function curatorPass(managed: Array<{ name: string; lastActivityDaysAgo: number; state?: SkillState; pinned?: boolean }>): { transitions: Array<{ name: string; from: SkillState; to: SkillState }> } {
  const transitions: Array<{ name: string; from: SkillState; to: SkillState }> = [];
  for (const m of managed) {
    const r = lifecycleTransition({ state: m.state, lastActivityDaysAgo: m.lastActivityDaysAgo, pinned: m.pinned });
    if (r.changed) transitions.push({ name: m.name, from: m.state || "active", to: r.state });
  }
  return { transitions };
}
function writeRegistry(dirs: string[]) { try { ensureDir(); writeFileSync(REGISTRY_PATH, JSON.stringify(buildRegistry(dirs), null, 2)); } catch { /* best-effort */ } }

// — my-add #5. SPEC-DRIFT: a managed skill whose referenced verbs no longer occur in experience —
export function skillVerbs(body: string): string[] {
  const out = new Set<string>();
  const pat = body.match(/##\s*Observed pattern\s*```text\s*([\s\S]*?)```/i);
  if (pat) for (const seg of pat[1].split(/\s*→\s*|\n/)) { const t = seg.trim().toLowerCase(); if (/^[a-z][a-z0-9 ._-]{1,23}$/.test(t) && !["text", "bash"].includes(t)) out.add(t); }
  return [...out];
}
export function specDrift(body: string, rows: Row[]): { drift: boolean; missing: string[]; verbs: string[] } {
  const verbs = skillVerbs(body);
  if (!verbs.length) return { drift: false, missing: [], verbs };
  const seen = new Set(rows.map((r) => stepSig(r).toLowerCase()));
  const seenArr = [...seen];
  const missing = verbs.filter((v) => !seenArr.some((s) => s === v || s.includes(v) || v.includes(s)));
  return { drift: missing.length === verbs.length, missing, verbs };
}

// ════════════════════════════════════════════════════════════════════════════
// HERMES-PARITY + EDGE: curator lifecycle (replicate) · failure-defense (beat).
// ════════════════════════════════════════════════════════════════════════════
const USAGE_PATH = join(STATE_DIR, "skill-usage.json");
export type SkillState = "active" | "stale" | "archived";
export const CURATOR = { STALE_DAYS: 30, ARCHIVE_DAYS: 90, IDLE_HOURS: 2 };
export type UsageRec = { uses?: number; lastActivity?: number; created?: number; state?: SkillState; pinned?: boolean; absorbedInto?: string };

/** Pure, reversible lifecycle transition (Hermes curator core). Pinned = frozen. */
export function lifecycleTransition(input: { state?: SkillState; lastActivityDaysAgo: number; pinned?: boolean }): { state: SkillState; changed: boolean } {
  const state: SkillState = input.state || "active";
  if (input.pinned) return { state, changed: false };
  const d = input.lastActivityDaysAgo;
  if (d >= CURATOR.ARCHIVE_DAYS && state !== "archived") return { state: "archived", changed: true };
  if (d >= CURATOR.STALE_DAYS && state === "active") return { state: "stale", changed: true };
  if (d < CURATOR.STALE_DAYS && state === "stale") return { state: "active", changed: true }; // reactivate on use
  return { state, changed: false };
}
function loadUsage(): Record<string, UsageRec> { try { return existsSync(USAGE_PATH) ? JSON.parse(readFileSync(USAGE_PATH, "utf8")) : {}; } catch { return {}; } }
function saveUsage(u: Record<string, UsageRec>) { try { ensureDir(); writeFileSync(USAGE_PATH, JSON.stringify(u, null, 2)); } catch { /* */ } }
function bumpUsage(name: string) { const u = loadUsage(); const r = u[name] || { created: Date.now(), state: "active" as SkillState }; r.uses = (r.uses || 0) + 1; r.lastActivity = Date.now(); if (r.state === "stale" || r.state === "archived") r.state = "active"; u[name] = r; saveUsage(u); }
export function setPinned(name: string, pinned: boolean) { const u = loadUsage(); u[name] = { ...(u[name] || { created: Date.now() }), pinned }; saveUsage(u); }
export function isPinned(name: string): boolean { return !!loadUsage()[name]?.pinned; }

// — FAILURE-DEFENSE (the edge Hermes lacks): Reflexion [trigger→error→consequence→defense] —
export type Defense = { trigger: string; errClass: string; consequence: string; defense: string; severity: number; count: number; kind: "fix" | "avoid" };
/** Build a DONT_DO / defense set from repair chains (known fixes) + anti-patterns (avoid). */
export function buildDefenses(rows: Row[]): Defense[] {
  const out: Defense[] = [];
  for (const r of detectRepairChains(rows)) out.push({ trigger: r.trigger, errClass: r.errClass, consequence: "fails until the known fix is applied", defense: `apply ${r.fixStep}, then re-run ${r.verifyStep}`, severity: Math.min(3, r.count + 1), count: r.count, kind: "fix" });
  for (const p of detectAntiPatterns(rows)) out.push({ trigger: p.step, errClass: p.errClass, consequence: "recurring failure with no known recovery", defense: "root-cause before retrying; do not blind-retry", severity: Math.min(3, p.fails), count: p.fails, kind: "avoid" });
  return out.sort((a, b) => b.severity - a.severity);
}
/** PRE-ACTION check: Letta's tool_start is the hook Hermes lacks. Returns a matching defense or null. */
export function preActionDefense(stepSignature: string, defenses: Defense[]): Defense | null {
  const s = stepSignature.toLowerCase();
  return defenses.find((d) => d.trigger.toLowerCase() === s) || defenses.find((d) => s.includes(d.trigger.toLowerCase()) && d.trigger.length > 3) || null;
}

// ════════════════════════════════════════════════════════════════════════════
// M2: SECURITY + AUTHORING GATE — every write path (create/edit/patch/write_file/
// autopilot-graduate) passes through this. Block dangerous content; no partial writes.
// ════════════════════════════════════════════════════════════════════════════
const SECRET_TOKEN_RE = /\b(?:sk|pk|ghp|gho|ghu|ghs|xox[baprs]|AKIA|AIza)[-_][A-Za-z0-9]{12,}\b/;
export function scanSkillContent(content: string): { ok: boolean; issues: string[] } {
  const c = String(content || "");
  const issues: string[] = [];
  if (SECRET_TOKEN_RE.test(c) || /\b(?:authorization|api[_-]?key|secret|password)\s*[:=]\s*["']?[^\s"'<>]{6,}/i.test(c) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(c)) issues.push("secret-looking credential");
  if (/\bcurl\b[^\n|]*\|\s*(?:sudo\s+)?(?:ba)?sh\b/i.test(c) || /\bwget\b[^\n|]*\|\s*(?:ba)?sh\b/i.test(c)) issues.push("pipe-to-shell (curl|sh)");
  if (/\brm\s+-[rf]{1,2}\s+(?:["']?[~/]|\$HOME|\*)/.test(c)) issues.push("naked rm -rf on root/home/glob");
  if (/(?:^|[\s;&|])sudo\s+\S/i.test(c)) issues.push("sudo command");
  if (/\bgit\s+push\b[^\n]*--force\b|\bpush\s+--force(?:-with-lease)?\b/i.test(c)) issues.push("force push");
  if (Math.ceil(c.length / 4) > 5000) issues.push("body > 5000 tokens (decompose into references/)");
  if (/\bignore\s+(?:all\s+|the\s+)?(?:previous|prior|above)\s+(?:instructions|messages|prompts|rules)\b/i.test(c) || /\b(?:disregard|override)\s+(?:your\s+|the\s+)?(?:system|previous)\s+(?:prompt|instructions)\b/i.test(c)) issues.push("prompt-injection phrasing");
  // concrete hardcoded API-key/token formats (QA-hardened)
  if (/\b(?:sk-ant-[a-zA-Z0-9-]{8,}|sk-[a-zA-Z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[baprs]-[A-Za-z0-9-]{10,})\b/.test(c)) issues.push("hardcoded API key/token");
  // credential exfiltration: command-substitution reading secrets, or piping creds to the network
  if (/\$\([^)]*(?:cat|head|tail|less)[^)]*(?:\.ssh|id_rsa|\.env|\.aws|credentials|\.netrc|passwd|secret|token)/i.test(c) || /(?:curl|wget|nc|ncat)\b[^\n]*(?:\$\(|`)[^\n]*(?:cat|\.ssh|\.env|credentials|secret)/i.test(c)) issues.push("credential exfiltration pattern");
  // obfuscated code execution
  if (/\beval\s*\(\s*(?:atob|Buffer\.from|decodeURIComponent|unescape)\s*\(/i.test(c) || /\bbase64\s+-d\b[^\n]*\|\s*(?:ba)?sh\b/i.test(c) || /\b(?:python3?|node|ruby|perl)\b[^\n]*\s-[ec]\b[^\n]*(?:atob|base64|exec\(|eval)/i.test(c)) issues.push("obfuscated code execution");
  return { ok: issues.length === 0, issues };
}
export function scanSupportFile(path: string, content: string): { ok: boolean; issues: string[] } {
  const issues = [...scanSkillContent(content).issues];
  if (/\.(?:sh|mjs|cjs|js|ts|py|rb)$/i.test(path)) {
    const testDemo = /\b(?:test|demo|smoke|example|fixture)\b/i.test(path) || /\b(?:test|demo|smoke|example)\b/i.test(String(content).slice(0, 240));
    if (!testDemo && /\b(?:curl|wget|fetch\s*\(|https?:\/\/|rm\s+-[rf]|dd\s+if=|mkfs|>\s*\/dev\/)\b/i.test(content)) issues.push("support script runs network/destructive ops without test/demo marking");
  }
  return { ok: issues.length === 0, issues };
}

// ════════════════════════════════════════════════════════════════════════════
// M1: SUPPORT-FILE MANAGER + RESTORE (Hermes skill_manage parity)
// ════════════════════════════════════════════════════════════════════════════
const SUPPORT_SUBDIRS = new Set(["references", "templates", "scripts", "assets"]);
export function validateSupportPath(filePath: string): { ok: boolean; reason?: string } {
  const p = String(filePath || "");
  if (!p) return { ok: false, reason: "file_path required" };
  if (p.includes("..")) return { ok: false, reason: "path traversal ('..') blocked" };
  if (p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("~")) return { ok: false, reason: "absolute/home path blocked" };
  const parts = p.split("/").filter(Boolean);
  if (parts.length < 2) return { ok: false, reason: "provide subdir/filename" };
  if (!SUPPORT_SUBDIRS.has(parts[0])) return { ok: false, reason: `must be under: ${[...SUPPORT_SUBDIRS].join(", ")}` };
  if (parts.some((s) => s.startsWith("."))) return { ok: false, reason: "dotfiles/segments blocked" };
  return { ok: true };
}
function skillDirOf(name: string, ctx?: any): string | null { return scanDirs(ctx).find((d) => existsSync(join(d, name, "SKILL.md"))) || null; }
export function writeSupportFile(name: string, filePath: string, content: string, ctx?: any): string {
  const v = validateSupportPath(filePath); if (!v.ok) throw new Error(v.reason);
  const sc = scanSupportFile(filePath, content); if (!sc.ok) throw new Error(`security: ${sc.issues.join("; ")}`);
  const d = skillDirOf(name, ctx); if (!d) throw new Error(`no skill '${name}'`);
  const full = join(d, name, filePath);
  mkdirSync(dirname(full), { recursive: true });
  const tmp = full + ".mmtmp"; writeFileSync(tmp, content); renameSync(tmp, full); // atomic, no partial write
  return full;
}
export function removeSupportFile(name: string, filePath: string, ctx?: any): string {
  const v = validateSupportPath(filePath); if (!v.ok) throw new Error(v.reason);
  const d = skillDirOf(name, ctx); if (!d) throw new Error(`no skill '${name}'`);
  const full = join(d, name, filePath); if (!existsSync(full)) throw new Error(`no such support file`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const grave = join(STATE_DIR, "removed-files", name, `${filePath.replace(/\//g, "__")}-${stamp}`);
  mkdirSync(dirname(grave), { recursive: true }); renameSync(full, grave); // reversible quarantine, not delete
  return grave;
}
/** Restore a retired skill from _retired/<name>-<stamp> back into the skills dir. */
export function restoreManagedSkill(name: string, ctx?: any): string {
  const dirs = scanDirs(ctx);
  for (const d of dirs) {
    const retiredRoot = join(d, "_retired"); if (!existsSync(retiredRoot)) continue;
    const matches = readdirSync(retiredRoot).filter((n) => n === name || n.startsWith(`${name}-`)).sort().reverse();
    if (matches.length) {
      if (existsSync(join(d, name, "SKILL.md"))) throw new Error(`'${name}' already active`);
      renameSync(join(retiredRoot, matches[0]), join(d, name));
      const u = loadUsage(); u[name] = { ...(u[name] || {}), state: "active", lastActivity: Date.now() }; saveUsage(u);
      return join(d, name);
    }
  }
  throw new Error(`no retired skill '${name}' to restore`);
}

// ════════════════════════════════════════════════════════════════════════════
// AUTOPILOT — the self-driving loop. Pure decision engine + executor so the whole
// autonomous distill/refine/manage cycle is testable WITHOUT a live model; the
// optional fork-author is a quality layer on top. Gated, budgeted, reversible, receipted.
// ════════════════════════════════════════════════════════════════════════════
const STAGED_DIR = join(STATE_DIR, "staged");
const STAGED_RETIRED_DIR = join(STATE_DIR, "staged-retired");
const AUTOPILOT_STATE = join(STATE_DIR, "autopilot-state.json");
export type AutopilotMode = "off" | "staged" | "auto";
export type AutopilotConfig = { mode: AutopilotMode; dailyBudget: number; minImpact: number };
export const AUTOPILOT_DEFAULT: AutopilotConfig = { mode: "staged", dailyBudget: 5, minImpact: 4.0 };

export type AutopilotDecision =
  | { op: "distill"; candidate: Candidate; name: string; reason: string; gate: "graduate" | "stage" }
  | { op: "refine"; skill: string; reason: string }
  | { op: "retire"; skill: string; reason: string; absorbedInto?: string };
export type ManagedView = { name: string; description: string; body: string; uses: number; ageDays: number; pinned?: boolean };
export type AutopilotPlan = { decisions: AutopilotDecision[]; skipped: Array<{ what: string; why: string }>; budget: { used: number; limit: number }; mode: AutopilotMode };

function repairForRows(c: Candidate, rows: Row[]): RepairChain | undefined {
  if (!c.fixes) return undefined;
  const first = c.key.split(/\s*→\s*/)[0];
  return detectRepairChains(rows).find((r) => r.trigger === first || c.key.includes(r.trigger));
}

/** PURE decision engine: what should the autopilot do right now? Fully testable. */
export function autopilotPlan(input: { rows: Row[]; managed: ManagedView[]; dirsForDedup: string[]; config?: AutopilotConfig; budgetUsedToday?: number }): AutopilotPlan {
  const cfg = input.config || AUTOPILOT_DEFAULT;
  const decisions: AutopilotDecision[] = [];
  const skipped: Array<{ what: string; why: string }> = [];
  let used = input.budgetUsedToday || 0;
  if (cfg.mode === "off") return { decisions, skipped: [{ what: "all", why: "autopilot off" }], budget: { used, limit: cfg.dailyBudget }, mode: cfg.mode };

  const existing = new Set(input.managed.map((m) => m.name));
  const refineTargets = new Set<string>();

  // 1) REFINE: a managed skill whose documented failure recurs in current anti-patterns.
  const apSteps = detectAntiPatterns(input.rows).map((p) => p.step.toLowerCase());
  for (const m of input.managed) {
    if (m.pinned) continue;
    const verbs = skillVerbs(m.body);
    if (verbs.length && verbs.some((v) => apSteps.some((s) => s === v || s.includes(v) || v.includes(s)))) {
      decisions.push({ op: "refine", skill: m.name, reason: "documented failure recurring — strengthen the pitfall" });
      refineTargets.add(m.name);
    }
  }

  // 2) DISTILL: mature, high-impact, novel candidates (gated + budgeted).
  for (const c of detect(input.rows).candidates) {
    if (used >= cfg.dailyBudget) { skipped.push({ what: c.key, why: "daily budget reached" }); continue; }
    if (DESTRUCTIVE.test(c.key)) { skipped.push({ what: c.key, why: "destructive workflow — never auto-distilled" }); continue; } // explicit safety gate, before impact
    const imp = impactScore(c).score;
    if (imp < cfg.minImpact) { skipped.push({ what: c.key, why: `impact ${imp} < ${cfg.minImpact}` }); continue; }
    const draft = draftWithRepair(c, repairForRows(c, input.rows));
    const nm = slug(draft.name);
    if (existing.has(nm)) { skipped.push({ what: nm, why: "already managed — refine, don't re-distill" }); continue; }
    const dc = dedupCheck(nm, draft.description, input.dirsForDedup);
    if (dc.dup) { skipped.push({ what: nm, why: `dedup: ${dc.reason}` }); continue; }
    const lint = lintSkillDraft({ name: nm, description: draft.description, body: draft.body }, { needsPitfalls: !!c.fixes });
    if (!lint.ok) { skipped.push({ what: nm, why: `lint: ${lint.issues[0]}` }); continue; }
    // Auto-graduate only in full-auto mode AND with a verified success in the pattern; else stage for 1-tap.
    const verified = c.fixes > 0 || c.count >= MM.STRONG_SINGLE;
    const gate: "graduate" | "stage" = cfg.mode === "auto" && verified ? "graduate" : "stage";
    decisions.push({ op: "distill", candidate: c, name: nm, reason: `impact ${imp}, ${c.count} reps${verified ? ", verified" : ""}`, gate });
    used++;
  }

  // 3) RETIRE: stale/unused/drifted managed skills (not refine-flagged, not pinned). Reversible.
  for (const m of input.managed) {
    if (m.pinned || refineTargets.has(m.name)) continue;
    const drift = specDrift(m.body, input.rows).drift;
    const ev = effectivenessVerdict({ uses: m.uses, ageDays: m.ageDays, staleAntiPattern: false });
    if (drift) decisions.push({ op: "retire", skill: m.name, reason: "spec-drift: referenced commands no longer occur" });
    else if (ev.verdict === "retire_candidate") decisions.push({ op: "retire", skill: m.name, reason: ev.reason });
  }

  return { decisions, skipped, budget: { used, limit: cfg.dailyBudget }, mode: cfg.mode };
}

function provenanceBlock(c: Candidate): string {
  return `\n<!-- ${MM_TAG}: autopilot ${new Date().toISOString().slice(0, 10)}; candidate=${c.kind}:${c.key}; reps=${c.count}; convs=${c.convs}; fixes=${c.fixes}; impact=${impactScore(c).score} -->\n`;
}
function appendRecurrenceNote(dir: string, name: string, note: string): boolean {
  if (!existsSync(join(dir, name, "SKILL.md"))) return false;
  let t = readSkill(dir, name);
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `- (${stamp}) autopilot: ${note}\n`;
  if (/##\s+Pitfalls/i.test(t)) t = t.replace(/(##\s+Pitfalls[^\n]*\n)/i, `$1${line}`);
  else t = t.replace(/(\n## Verification)/, `\n## Pitfalls (autopilot)\n${line}\n$1`);
  writeSkill(dir, name, t);
  return true;
}

/** Execute a plan with explicit deps (testable). author defaults to the deterministic drafter. */
export function executeAutopilotPlan(plan: AutopilotPlan, opts: { skillsDir: string; rows: Row[]; author?: (c: Candidate, r?: RepairChain) => { name: string; description: string; body: string }; ctx?: any }): { graduated: string[]; staged: string[]; refined: string[]; retired: string[]; receipts: any[] } {
  const author = opts.author || ((c, r) => draftWithRepair(c, r));
  const graduated: string[] = [], staged: string[] = [], refined: string[] = [], retired: string[] = [];
  const receipts: any[] = [];
  for (const d of plan.decisions) {
    try {
      if (d.op === "distill") {
        const draft = author(d.candidate, repairForRows(d.candidate, opts.rows));
        const content = `---\nname: ${d.name}\ndescription: ${draft.description}\n---\n\n${draft.body}${provenanceBlock(d.candidate)}\n`;
        const sec = scanSkillContent(content); // M2: security gate on autopilot graduate/stage
        if (!sec.ok) { receipts.push({ op: "distill", name: d.name, blocked: `security: ${sec.issues.join("; ")}`, ts: Date.now() }); continue; }
        if (d.gate === "graduate") { writeSkill(opts.skillsDir, d.name, content); graduated.push(d.name); }
        else { writeSkill(STAGED_DIR, d.name, content); staged.push(d.name); }
        receipts.push({ op: "distill", name: d.name, gate: d.gate, reason: d.reason, ts: Date.now() });
      } else if (d.op === "refine") {
        if (appendRecurrenceNote(opts.skillsDir, d.skill, d.reason)) { refined.push(d.skill); receipts.push({ op: "refine", name: d.skill, reason: d.reason, ts: Date.now() }); }
      } else if (d.op === "retire") {
        const target = retireManagedSkill(d.skill, d.reason, opts.ctx, d.absorbedInto);
        retired.push(d.skill); receipts.push({ op: "retire", name: d.skill, reason: d.reason, target, ts: Date.now() });
      }
    } catch (e: any) { receipts.push({ op: d.op, error: String(e?.message ?? e) }); }
  }
  return { graduated, staged, refined, retired, receipts };
}

// budget persistence (per-day trust budget)
function loadAutopilotState(): { date: string; used: number } { try { const s = JSON.parse(readFileSync(AUTOPILOT_STATE, "utf8")); const today = new Date().toISOString().slice(0, 10); return s.date === today ? s : { date: today, used: 0 }; } catch { return { date: new Date().toISOString().slice(0, 10), used: 0 }; } }
function saveAutopilotState(s: { date: string; used: number }) { try { ensureDir(); writeFileSync(AUTOPILOT_STATE, JSON.stringify(s)); } catch { /* */ } }

/** Build the managed-skill view (uses + age + pin) from disk + usage sidecar. */
function managedView(dirs: string[]): ManagedView[] {
  const usage = loadUsage();
  const out: ManagedView[] = [];
  for (const d of dirs) for (const n of listSkillNames(d)) {
    if (!isManaged(d, n)) continue;
    const u = usage[n] || {};
    const created = u.created || Date.now();
    out.push({ name: n, description: skillDesc(d, n), body: readSkill(d, n), uses: u.uses || 0, ageDays: Math.floor((Date.now() - created) / 86400000), pinned: !!u.pinned });
  }
  return out;
}

/** Extract text from a stream chunk across the shapes Letta/providers emit (string, {text}, {delta},
 * {content:string|{text}|[{text}]}, OpenAI {choices:[{delta:{content}}]}). Returns "" for non-text
 * control chunks — so we NEVER accumulate "[object Object]" (the live fork-author reject bug). */
export function streamChunkText(c: any): string {
  if (c == null) return "";
  if (typeof c === "string") return c;
  if (typeof c.text === "string") return c.text;
  if (typeof c.delta === "string") return c.delta;
  if (typeof c.content === "string") return c.content;
  if (typeof c.delta?.text === "string") return c.delta.text;
  if (typeof c.delta?.content === "string") return c.delta.content;
  if (typeof c.content?.text === "string") return c.content.text;
  if (Array.isArray(c.content)) return c.content.map((x: any) => (typeof x === "string" ? x : x?.text ?? "")).join("");
  if (typeof c.choices?.[0]?.delta?.content === "string") return c.choices[0].delta.content;
  if (typeof c.choices?.[0]?.text === "string") return c.choices[0].text;
  return "";
}

/** Optional model-fork author: the model writes a richer SKILL.md body in a hidden conversation.
 * Fully guarded — ANY failure returns null and the executor falls back to the deterministic drafter,
 * so the autopilot loop can never break. (Live-only path; the deterministic fallback is what's unit-tested.) */
async function forkAuthor(ctx: any, c: Candidate, repair?: RepairChain): Promise<{ name: string; description: string; body: string } | null> {
  try {
    if (typeof ctx?.conversation?.fork !== "function") return null;
    const det = draftWithRepair(c, repair);
    const prompt = `You are muscle-memory's skill author. Write ONLY the markdown BODY (no YAML frontmatter) of a SKILL.md capturing this recurring real workflow. Keep it under 120 lines. Required sections in order: "## Trigger", "## Observed pattern" (include the exact pattern in a code block), "## Procedure" (numbered, concrete, adaptable), ${repair ? `"## Pitfalls" (the observed error "${repair.errClass}" and its fix "${repair.fixStep}"), ` : ""}"## Verification". Pattern: ${c.key}. Reps: ${c.count} across ${c.convs} conversation(s). Output ONLY the markdown body, nothing else.`;
    const forked = await ctx.conversation.fork({ hidden: true });
    const stream = await forked.sendMessageStream([{ role: "user", content: prompt }]);
    let body = "";
    for await (const chunk of stream as AsyncIterable<any>) body += streamChunkText(chunk);
    body = body.trim().replace(/^```(?:markdown|md)?\n?|\n?```$/g, "");
    if (body.length < 80 || !/##\s*Procedure/i.test(body) || !/##\s*Verification/i.test(body)) return null; // malformed → fallback
    const lint = lintSkillDraft({ name: det.name, description: det.description, body }, { needsPitfalls: !!c.fixes });
    if (!lint.ok) return null; // model body failed the linter → fallback to deterministic
    const sec = scanSkillContent(body);
    if (!sec.ok) return null; // dangerous/secret model output → reject, fall back to deterministic (no live write)
    return { name: det.name, description: det.description, body };
  } catch { return null; }
}

/** Live autopilot run: build plan from real state, model-author richer bodies (best-effort), execute, persist. */
export async function runAutopilot(ctx: any, config?: AutopilotConfig): Promise<AutopilotPlan & { result?: any }> {
  const cfg = config || AUTOPILOT_DEFAULT;
  const dirs = scanDirs(ctx);
  const rows = loadExperience();
  const st = loadAutopilotState();
  const plan = autopilotPlan({ rows, managed: managedView(dirs), dirsForDedup: dirs, config: cfg, budgetUsedToday: st.used });
  if (cfg.mode === "off" || !plan.decisions.length) return plan;
  // Best-effort: let the model author richer bodies via a hidden fork; deterministic drafter is the fallback.
  const authored = new Map<string, { name: string; description: string; body: string }>();
  for (const d of plan.decisions) if (d.op === "distill") { const a = await forkAuthor(ctx, d.candidate, repairForRows(d.candidate, rows)); if (a) authored.set(d.candidate.key, a); }
  const author = (c: Candidate, r?: RepairChain) => authored.get(c.key) || draftWithRepair(c, r);
  const result = executeAutopilotPlan(plan, { skillsDir: agentSkillsDir(ctx), rows, ctx, author });
  saveAutopilotState({ date: st.date, used: st.used + result.graduated.length + result.staged.length });
  try { ensureDir(); mkdirSync(RECEIPTS_DIR, { recursive: true }); writeFileSync(join(RECEIPTS_DIR, `autopilot-${Date.now()}.json`), JSON.stringify({ mode: cfg.mode, modelAuthored: authored.size, ...result, ts: Date.now() }, null, 2)); } catch { /* */ }
  return { ...plan, result };
}

// ════════════════════════════════════════════════════════════════════════════
// v3.1 — REFLECTIVE REVIEWER (the surpass): the deterministic detectors become
// EVIDENCE SOURCES; an LLM reviewer authors class-level skills from CROSS-CONVERSATION
// evidence (Letta recall — the structural edge Hermes lacks). Gated by a negative
// filter (don't learn env-noise) + class-level naming + security + lint.
// ════════════════════════════════════════════════════════════════════════════

/** NEGATIVE FILTER (Hermes's killer pattern): durable lessons only — never env-failures
 * (command-not-found, missing binaries, creds, transient) or tool-negatives. They harden
 * into self-sabotage. Returns false = DO NOT learn this. */
export function isDurableLesson(text: unknown): boolean {
  const t = String(text ?? "").toLowerCase().trim();
  if (!t) return false;
  const ENV = /(command not found|no such file|cannot find module|not installed|uninstalled|missing (binary|package|dependency)|permission denied|\beacces\b|\benoent\b|\beperm\b|connection refused|timed out|rate.?limit|quota|insufficient balance|unauthorized|401|403|invalid auth|credential|fresh.install|not configured)/;
  if (ENV.test(t)) return false;
  if (/(is broken|does ?n'?t work|cannot use|unavailable|not supported)/.test(t)) return false; // tool-negative
  return true;
}

/** CLASS-LEVEL NAMING GATE (Hermes): reject x-to-y transitions, fix-/debug-/audit- artifacts,
 * dates/PR-numbers/versions, error-string names. Only durable class-level names pass. */
export function isValidSkillName(name: unknown): boolean {
  const n = String(name ?? "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(n) || n.length > 64) return false;
  const ANTI = [/^fix-/, /^debug-/, /^audit-/, /^patch-/, /-to-/, /\d{3,}/, /v?\d+[._]\d+/, /\berror\b|\bexception\b/, /-today$|-now$|-temp$|-wip$/];
  return !ANTI.some((p) => p.test(n));
}

/** THE LETTA EDGE: aggregate REAL grounded pitfalls across ALL conversations in the log
 * (Letta recall). Hermes reviews one conversation; this digests the agent's whole history. */
export function buildCrossConversationEvidence(rows: Row[]): { digest: string; convs: number; items: number } {
  const convs = new Set(rows.map((r) => String(r.conv ?? "?"))).size;
  const allRepairs = detectRepairChains(rows), allAps = detectAntiPatterns(rows);
  const repairs = allRepairs.filter((r) => isDurableLesson(r.errClass));
  const aps = allAps.filter((p) => isDurableLesson(p.errClass));
  const rejected: Array<{ item: string; reason: string }> = [];
  for (const r of allRepairs) if (!isDurableLesson(r.errClass)) rejected.push({ item: `${r.trigger} (${r.errClass})`, reason: "environment/transient — negative filter" });
  for (const p of allAps) if (!isDurableLesson(p.errClass)) rejected.push({ item: `${p.step} (${p.errClass})`, reason: "environment/transient — negative filter" });
  const tmpl = new Map<string, number>();
  const highSignal = new Map<string, { count: number; failures: number; convs: Set<string>; tool: string }>();
  for (const r of rows) if (r.tmpl) {
    tmpl.set(r.tmpl, (tmpl.get(r.tmpl) || 0) + 1);
    if (HIGH_SIGNAL_TOOL_SET.has(r.tool)) {
      const e = highSignal.get(r.tmpl) || { count: 0, failures: 0, convs: new Set<string>(), tool: r.tool };
      e.count++; if (r.ok === false) e.failures++; e.convs.add(String(r.conv ?? "?")); highSignal.set(r.tmpl, e);
    }
  }
  const topTmpl = [...tmpl.entries()].filter(([t, c]) => c >= 3 && !PRIMITIVE.test(t)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const high = [...highSignal.entries()].sort((a, b) => b[1].failures - a[1].failures || b[1].count - a[1].count).slice(0, 10);
  const L: string[] = [`CROSS-CONVERSATION EVIDENCE (aggregated over ${convs} sessions of real tool-use):`];
  for (const r of repairs.slice(0, 12)) L.push(`- recovered failure: "${r.trigger}" failed (${r.errClass}) → fixed via "${r.fixStep}" → re-ran "${r.verifyStep}" [${r.count}× across ${r.convs} sessions]`);
  for (const p of aps.slice(0, 8)) L.push(`- recurring failure (no clean fix yet): "${p.step}" — ${p.errClass} [${p.fails}×]`);
  for (const [t, c] of topTmpl) L.push(`- recurring workflow: ${t} [${c}×]`);
  for (const [t, e] of high) L.push(`- high-signal receipt workflow: ${t} [${e.count}× across ${e.convs.size} session${e.convs.size === 1 ? "" : "s"}${e.failures ? `, ${e.failures} failed/partial receipt${e.failures === 1 ? "" : "s"}` : ""}]`);
  return { digest: L.join("\n"), convs, items: repairs.length + aps.length + topTmpl.length + high.length, rejected };
}

// The tuned v3 reviewer prompt (benchmark-proven Hermes-level: 43-44/50, hermes_level=yes).
export const REVIEW_PROMPT = `You are the skill-library reviewer for a self-improving AI coding agent (agentskills.io). From the cross-session evidence, author ONE genuinely valuable CLASS-LEVEL skill IF a durable reusable lesson emerged.

Write a TIGHT, COMPLETE skill — a focused finished skill always beats a broad truncated one. Structure: frontmatter (name + description with triggers), then "## When to use" (concrete triggers), "## Procedure" (numbered, concrete, safe-first), "## Pitfalls" (the 3-5 HARDEST-WON failures, each as the real symptom → the exact fix), "## Verification". Keep it focused and UNDER ~70 lines; FINISH every section — never trail off mid-sentence or mid-code-block.

HARD RULES:
- CAPTURE EVERY REAL PITFALL: include each genuinely-distinct hard-won failure in the evidence (this breadth of real, cross-session lessons IS the whole advantage), each with its exact fix. Cut filler, redundancy, and obvious steps ruthlessly — but never drop a real pitfall to save space.
- DECISION-AWARE: for recovery/debugging/troubleshooting skills especially, structure the Procedure as a DECISION GUIDE — symptom → safest fix first → fallback — so the reader knows WHICH path to take, not just a menu of options.
- CONCRETE + ACCURATE: show exact, CORRECT code/commands in fenced blocks (a wrong or hand-wavy example is worse than none — verify it actually fixes the stated problem). Keep code snippets short + self-contained so they never get cut off. Every step specific.
- SAFE FIRST: ALWAYS make a non-destructive safety net (a backup branch/tag, a stash, or a copy) the EXPLICIT first step before any destructive/irreversible command (reset --hard, force-push, rm, drop, db migrate) — and name it as the safety net so a wrong move is recoverable.
- NAMING: class-level only; never an x-to-y transition, error string, PR number, date, codename, or fix-/debug-/audit-today artifact.
- NEGATIVE FILTER: never capture environment-dependent failures (command-not-found, missing binaries, uninstalled packages, creds) or tool-negatives ("X is broken").
Output ONLY the complete SKILL.md (no preamble, not truncated), or exactly "NOTHING-TO-SAVE".`;

/** ★ THE MEMFS LEVER: reliable in-mod KEYWORD search over existing skills (no QMD dependency —
 * semantic memfs_search crashes on some boxes). Powers UPDATE-FIRST routing: retrieve the skill
 * that already covers a domain so we PATCH it instead of authoring a duplicate (Hermes's #1
 * anti-bloat priority — but matched on real CONTENT, not just names like Hermes's skills_list). */
// Generic dev/agent words that must NOT drive update-first routing (they false-positive across
// unrelated skills, e.g. "validate"/"run"/"tool" matching shopify-cli for mod-validation work).
const SEARCH_STOP = new Set("the and for with via use using used run running runs tool tools command commands file files validate validating validation build builds building test testing tests check checking code into from that this your you any new real step steps workflow workflows work works working session sessions across before after fix fixed fixing error errors fail failed failing not add get set make made need want call calls called when then them they here there what which how its has have will can may also same each only over under out off across recurring observed".split(" "));
const SEARCH_DISTINCT_MIN = 3; // ≥3 distinctive (non-stopword) hits in name/desc — prevents cross-domain false-positives (e.g. browser-QA→cloud-forensics)
export function searchSkills(dirs: string[], query: string, k = 5): Array<{ name: string; description: string; dir: string; score: number; matched: number }> {
  const terms = [...new Set(String(query).toLowerCase().split(/[^a-z0-9.]+/).filter((t) => t.length > 2 && !SEARCH_STOP.has(t)))];
  const out: Array<{ name: string; description: string; dir: string; score: number; matched: number }> = [];
  for (const d of dirs) for (const n of listSkillNames(d)) {
    const body = readSkill(d, n).toLowerCase();
    const desc = skillDesc(d, n);
    const nl = n.toLowerCase(), dl = desc.toLowerCase();
    let score = 0, matched = 0; // matched = # of distinctive query terms present in name/description
    for (const t of terms) {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const inName = nl.includes(t), inDesc = dl.includes(t);
      if (inName || inDesc) matched++;
      const bc = Math.min((body.match(new RegExp("\\b" + esc, "g")) || []).length, 3);
      score += (inName ? 8 : 0) + (inDesc ? 4 : 0) + bc;
    }
    if (matched > 0) out.push({ name: n, description: desc, dir: d, score, matched });
  }
  return out.sort((a, b) => b.score - a.score || b.matched - a.matched).slice(0, k);
}
/** Decide a SAFE update-first target: must clear the threshold, have ≥N distinctive name/desc hits,
 * AND dominate the runner-up. Tied/weak/ambiguous → null (→ CREATE, never patch the wrong skill). */
export function pickUpdateTarget<T extends { name: string; score: number; matched: number }>(matches: T[], threshold = 18): (T & { confidence: "high" }) | null {
  const top = matches[0]; if (!top) return null;
  const second = matches[1];
  const dominates = !second || top.score >= 1.5 * second.score;
  // Normal active-library routing requires dominance to avoid patching the wrong durable skill.
  // Staged queue exception: if the best match is already staged and has enough distinctive overlap,
  // UPDATE it even without 1.5× dominance. Repeated staged reflects should refine/consolidate the
  // current candidate, not spray sibling staged skills while waiting for review. (Live dogfood catch.)
  const topDir = String((top as any).dir || "");
  const topIsStaged = topDir === STAGED_DIR || /[\\/]staged$/.test(topDir);
  if (top.score >= threshold && top.matched >= SEARCH_DISTINCT_MIN && (dominates || topIsStaged)) return { ...top, confidence: "high" };
  return null;
}

export type ReviewResult = { action: "create" | "update" | "none" | "reject"; name?: string; description?: string; body?: string; content?: string; reason?: string; updateTarget?: string; matches?: Array<{ name: string; score: number; matched: number }> };
/** Author + gate a skill from evidence, with MemFS update-first routing. authorFn(system,user)->text injectable. */
export async function reviewAndAuthor(evidence: string, dirs: string[], authorFn: (sys: string, user: string) => Promise<string>, opts: { updateThreshold?: number } = {}): Promise<ReviewResult> {
  // MemFS update-first: does a skill SAFELY cover this domain? (distinctive overlap + dominance, not generic words)
  const matches = searchSkills(dirs, evidence, 3);
  const updTarget = pickUpdateTarget(matches, opts.updateThreshold ?? 18);
  const hint = updTarget
    ? `\n\nUPDATE-FIRST (anti-bloat): an existing skill already covers this territory — "${updTarget.name}": ${updTarget.description}. PREFER to extend it: keep that exact name, fold the new pitfalls/steps into a single improved full SKILL.md. Only use a different name if the territory is genuinely distinct.`
    : (matches.length ? `\n\nExisting skills (avoid duplicating): ${matches.map((m) => m.name).join(", ")}.` : "");
  // ROBUST extraction — models may prepend reasoning/preamble, wrap in ```fences, or use a
  // "# Title" heading instead of YAML frontmatter. Tolerate all; fall back to the update target.
  const parseDraft = (raw: string): { name: string; description: string; body: string; unsafeName?: string; invalidName?: string } | null => {
    let skill = (raw || "").replace(/<\/?think>/gi, "").trim();
    const startIdx = skill.search(/(^|\n)\s*(---\s*\n|#\s+|name:\s)/i);
    if (startIdx > 0) skill = skill.slice(startIdx).trim();
    skill = skill.replace(/^```(?:markdown|md|yaml)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    if (/^NOTHING-TO-SAVE/i.test(skill) || skill.length < 40) return null;
    const rawName = (skill.match(/^name:\s*["']?(.+?)["']?\s*$/im)?.[1] || "").trim();
    if (rawName && (/[\/\\;|&]|\.\./.test(rawName) || rawName.length > 64)) return { name: "", description: "", body: "", unsafeName: rawName };
    let name = slug(rawName);
    // Do not let deterministic repair launder an explicitly bad model-authored name (e.g. edit-to-npx).
    // Repair may fill missing structure, but the class-level naming gate must still reject named artifacts.
    if (rawName && name && !isValidSkillName(name)) return { name, description: "", body: "", invalidName: name };
    if (!name) name = slug((skill.match(/^#\s+(.+?)\s*$/m)?.[1] || "").trim());
    if (!name && updTarget) name = updTarget.name; // update-first: we already know the target
    let description = (skill.match(/^description:\s*["']?(.+?)["']?\s*$/im)?.[1] || "").trim();
    if (!description) description = (skill.split("\n").find((l) => { const t = l.trim(); return t.length > 25 && !/^([#`>*-]|---|name:|title:|description:)/i.test(t); }) || "").trim();
    if (!description && updTarget) description = updTarget.description;
    let body = skill;
    const secStart = body.search(/(^|\n)##\s+/);
    if (secStart >= 0) body = body.slice(secStart);
    else body = body.replace(/^---[\s\S]*?\n---\s*\n?/, "").replace(/^#\s+.+\n+/, "");
    body = body.replace(/\n---\s*(\n[\s\S]*)?$/, "").trim();
    return { name, description, body };
  };
  const isCleanDraft = (p: { name: string; description: string; body: string }) =>
    isValidSkillName(p.name) && !!p.description && p.description.length >= 20 && lintSkillDraft(p).ok;

  // ── Attempt 1, then ONE corrective retry if the draft is malformed for a NON-security reason. ──
  let raw = (await authorFn(REVIEW_PROMPT, evidence + hint)) || "";
  try { ensureDir(); writeFileSync(join(STATE_DIR, "reflect-last-raw.txt"), `=== ${new Date().toISOString()} ===\n${raw}\n`); } catch { /* */ }
  let parsed = parseDraft(raw);
  if (parsed?.unsafeName) return { action: "reject", reason: `name "${parsed.unsafeName.slice(0, 40)}" has unsafe characters (path/injection)` };
  if (parsed?.invalidName) return { action: "reject", reason: `name "${parsed.invalidName}" not class-level` };
  if (!parsed) return { action: "none" };
  // Empty shells are not salvageable: repair may fill missing sections, but must not invent a full skill body.
  if (!parsed.body || parsed.body.trim().length < 10) return { action: "reject", reason: "body too thin" };
  if (!isCleanDraft(parsed)) {
    const why = lintSkillDraft(parsed).issues
      .concat(isValidSkillName(parsed.name) ? [] : ["name must be a class-level lowercase-hyphen slug"])
      .concat((parsed.description || "").length >= 20 ? [] : ["description too short"]);
    const corrective = `\n\nYOUR PREVIOUS DRAFT WAS REJECTED (${why.join("; ")}). Re-output ONE complete SKILL.md and NOTHING else: YAML frontmatter with a class-level "name:" (lowercase-hyphen) and a "description:" that STARTS WITH "Use when"; a body that INCLUDES a "## Procedure" section and a "## Verification" section.`;
    try {
      const raw2 = (await authorFn(REVIEW_PROMPT, evidence + hint + corrective)) || "";
      try { writeFileSync(join(STATE_DIR, "reflect-last-raw.txt"), `=== ${new Date().toISOString()} (retry) ===\n${raw2}\n`); } catch { /* */ }
      const p2 = parseDraft(raw2);
      if (p2 && !p2.unsafeName && isCleanDraft(p2)) { parsed = p2; raw = raw2; }
    } catch { /* keep attempt 1 */ }
  }
  let { name, description, body } = parsed;

  // ── DETERMINISTIC REPAIR from real evidence — guarantee a valid skill when the draft is salvageable. ──
  // Security is NEVER repaired around; only structural gaps (name/description/sections) are filled from the
  // deterministic drafter, which is built from the SAME experience log, so it stays grounded in real evidence.
  let _fb: { name: string; description: string; body: string } | null | undefined;
  const fallback = () => { if (_fb === undefined) { try { const c = findCandidate(); _fb = c ? draftWithRepair(c, repairForCandidate(c)) : null; } catch { _fb = null; } } return _fb; };
  if (!isValidSkillName(name)) { const f = fallback(); name = (updTarget && isValidSkillName(updTarget.name)) ? updTarget.name : (f && isValidSkillName(f.name) ? f.name : name); }
  if (!isValidSkillName(name)) return { action: "reject", reason: `name "${name}" not class-level` };
  const secEarly = scanSkillContent(body); if (!secEarly.ok) return { action: "reject", reason: `security: ${secEarly.issues.join("; ")}` };
  const descOk = (d: string) => !!d && d.length >= 20 && /\b(use when|trigger|when )/i.test(d);
  if (!descOk(description)) {
    if (description && description.length >= 12 && !/\b(use when|trigger|when )/i.test(description)) description = `Use when ${description}`.slice(0, 700);
    if (!descOk(description)) { const f = fallback(); description = (f && descOk(f.description)) ? f.description : ((updTarget && descOk(updTarget.description)) ? updTarget.description : description); }
  }
  if (!/##\s+procedure/i.test(body) || !/##\s+verification/i.test(body)) {
    const f = fallback();
    if (f) {
      if (!/##\s+procedure/i.test(body)) { const m = f.body.match(/(##\s+Procedure[\s\S]*?)(?=\n##\s|\s*$)/i); body += `\n\n${m ? m[1].trim() : "## Procedure\n1. Repeat the observed workflow, adapting paths/args to the current context.\n2. Capture the success/failure receipt before moving on."}`; }
      if (!/##\s+verification/i.test(body)) { const m = f.body.match(/(##\s+Verification[\s\S]*?)(?=\n##\s|\s*$)/i); body += `\n\n${m ? m[1].trim() : "## Verification\n- Confirm via concrete command/tool output that the workflow actually succeeded."}`; }
    }
  }
  // ── FINAL gates after repair: security re-scan (hard) + lint; last resort = full deterministic fallback. ──
  const sec = scanSkillContent(body); if (!sec.ok) return { action: "reject", reason: `security: ${sec.issues.join("; ")}` };
  const lint = lintSkillDraft({ name, description, body });
  if (!lint.ok) { const f = fallback(); if (f && lintSkillDraft(f).ok && isValidSkillName(f.name)) { ({ name, description, body } = f); } else return { action: "reject", reason: `lint: ${lint.issues.join("; ")}` }; }
  const content = `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
  // UPDATE if the chosen name matches an existing skill (routed or coincidental) — anti-bloat win.
  const slim = matches.map((m) => ({ name: m.name, score: m.score, matched: m.matched }));
  const existingNames = new Set(matches.map((m) => m.name));
  if (existingNames.has(name)) return { action: "update", name, description, body, content, updateTarget: name, matches: slim };
  return { action: "create", name, description, body, content, matches: slim };
}

// ════════════════════════════════════════════════════════════════════════════
// v3.2 — IMMACULATE: evidence manifests, persona-personalized patching, coverage
// map, churn-aware lifecycle. Each skill becomes an evidence-backed git object.
// ════════════════════════════════════════════════════════════════════════════

// 1. EVIDENCE-PACK MANIFEST — provenance next to each skill: "not model vibes, a git object."
export type EvidenceManifest = { ts: string; action: string; skill: string; updateTarget?: string; sources: { conversations: number; durableSignals: number }; memfsHits: Array<{ name: string; score: number; matched: number }>; preferencesInjected: string[]; rejectedNoise: Array<{ item: string; reason: string }>; newHash: string; oldHash?: string; gates: { naming: boolean; security: boolean; lint: boolean } };
export function buildEvidenceManifest(i: { action: string; skill: string; updateTarget?: string; convs: number; signals: number; memfsHits: Array<{ name: string; score: number; matched: number }>; preferences: string[]; rejected: Array<{ item: string; reason: string }>; newContent: string; oldContent?: string }): EvidenceManifest {
  return { ts: new Date().toISOString(), action: i.action, skill: i.skill, updateTarget: i.updateTarget, sources: { conversations: i.convs, durableSignals: i.signals }, memfsHits: i.memfsHits.map((m) => ({ name: m.name, score: m.score, matched: m.matched })), preferencesInjected: i.preferences, rejectedNoise: i.rejected, newHash: hash(i.newContent), oldHash: i.oldContent ? hash(i.oldContent) : undefined, gates: { naming: true, security: true, lint: true } };
}

// 2. PERSONA/PREFS RETRIEVAL — Hermes PROMPTS for "how this user wants it"; Letta RETRIEVES it from memory.
export function retrievePreferences(evidence: string, memDir?: string): string[] {
  const dir = memDir || process.env.MEMORY_DIR; if (!dir) return [];
  const prefs: string[] = [];
  for (const s of ["persona.md", "system/persona.md", "system/human.md", "human.md", "system/human/preferences.md"]) {
    const p = join(dir, s); if (!existsSync(p)) continue;
    try { for (const line of readFileSync(p, "utf8").split("\n")) { const l = line.trim().replace(/^[-*#>\s]+/, ""); if (/\b(prefer|preference|always|never|wants?|likes?|hates?|style|format|verbos|concise|terse|tone|don'?t)\b/i.test(l) && l.length > 20 && l.length < 220) prefs.push(l); } } catch { /* */ }
  }
  return [...new Set(prefs)].slice(0, 6);
}

// 3. SKILL COVERAGE MAP — defensive assignments: every task class has a defender; dupes get a zone.
export type CoverageRow = { domain: string; status: "covered" | "uncovered" | "over-covered" | "noise"; skill?: string; signals: number };
export function coverageMap(rows: Row[], dirs: string[]): CoverageRow[] {
  const ev = buildCrossConversationEvidence(rows);
  const out: CoverageRow[] = [];
  for (const r of detectRepairChains(rows).filter((x) => isDurableLesson(x.errClass))) {
    const hits = searchSkills(dirs, `${r.trigger} ${r.fixStep} ${r.errClass}`, 4);
    const tgt = pickUpdateTarget(hits, 18);
    const overCovered = hits.filter((h) => h.matched >= 2).length >= 2;
    out.push({ domain: r.trigger, status: tgt ? (overCovered ? "over-covered" : "covered") : "uncovered", skill: tgt?.name, signals: r.count });
  }
  for (const rej of ev.rejected) out.push({ domain: rej.item, status: "noise", signals: 0 });
  return out;
}

// 4. CHURN-AWARE LIFECYCLE — git/usage churn as a stability signal (basketball: rotation status).
export type ChurnVerdict = "stable-veteran" | "needs-verification" | "g-league" | "blocked" | "active";
export function churnSignal(i: { patches: number; ageDays: number; uses: number; reverted?: boolean }): { verdict: ChurnVerdict; reason: string } {
  if (i.reverted) return { verdict: "blocked", reason: "reverted — blocked from auto-regeneration unless new evidence beats the old rejection" };
  if (i.patches >= 5 && i.ageDays <= 2) return { verdict: "needs-verification", reason: `patched ${i.patches}× in ${i.ageDays}d — unstable; verify before trusting` };
  if (i.uses === 0 && i.ageDays > 7) return { verdict: "g-league", reason: `created but never invoked in ${i.ageDays}d — bench it` };
  if (i.uses > 0 && i.patches <= 1) return { verdict: "stable-veteran", reason: `used ${i.uses}×, low churn` };
  return { verdict: "active", reason: "in rotation" };
}

// ════════════════════════════════════════════════════════════════════════════
// v3.3 — HERMES-VISIBLE UI: surface compact, FINISHED self-improvement summaries
// (not chain-of-thought) via a Letta panel + events ledger. No transcript hack —
// only the supported openPanel + command APIs. Adrian: "let me SEE it distilling."
// ════════════════════════════════════════════════════════════════════════════
const UI_EVENTS = join(STATE_DIR, "ui-events.jsonl");
const UI_STATE = join(STATE_DIR, "ui-state.json");
const REFLECT_HANDLED = join(STATE_DIR, "reflect-handled.json");
export type UiEvent = { ts: number; phase: string; summary: string; skill?: string; action?: string; route?: string; source: "muscle-memory" };
function appendUiEvent(e: { phase: string; summary: string; skill?: string; action?: string; route?: string }) { try { ensureDir(); appendJsonl(UI_EVENTS, { ts: Date.now(), source: "muscle-memory", ...e }); } catch { /* */ } }
let livePanel: any = null; // set in activate(); lets state changes re-render the panel LIVE (interactive mirror)
function writeUiState(s: Record<string, unknown>) { try { ensureDir(); writeFileSync(UI_STATE, JSON.stringify({ ...readUiState(), ...s, ts: Date.now() })); } catch { /* */ } try { livePanel?.update(); } catch { /* */ } }
function readUiState(): Record<string, any> { try { return existsSync(UI_STATE) ? JSON.parse(readFileSync(UI_STATE, "utf8")) : {}; } catch { return {}; } }
function loadUiEvents(n = 8): UiEvent[] { if (!existsSync(UI_EVENTS)) return []; const out: UiEvent[] = []; for (const l of readFileSync(UI_EVENTS, "utf8").trim().split("\n")) { if (!l) continue; try { out.push(JSON.parse(l)); } catch { /* */ } } return out.slice(-n); }
function reflectSignature(ev: { digest: string; convs: number; items: number }): string { return hash(`${ev.convs}\n${ev.items}\n${ev.digest}`); }
function loadHandledReflects(): Record<string, { ts: number; route: string }> { try { return existsSync(REFLECT_HANDLED) ? JSON.parse(readFileSync(REFLECT_HANDLED, "utf8")) : {}; } catch { return {}; } }
function markHandledReflect(sig: string, route: string) { try { ensureDir(); const h = loadHandledReflects(); h[sig] = { ts: Date.now(), route }; writeFileSync(REFLECT_HANDLED, JSON.stringify(h, null, 2)); } catch { /* */ } }

/** Hermes-style compact summary of a review's WRITE actions (finished, not thinking). */
export function summarizeReflectActions(events: Array<{ phase: string; summary: string }>, mode: "compact" | "verbose" = "compact"): string {
  const primaryPhases = ["skill_created", "skill_updated", "skill_staged", "skill_graduated", "skill_retired"];
  const writes = events.filter((e) => [...primaryPhases, "skill_review", "memory_pref_injected", "noise_rejected"].includes(e.phase));
  if (!writes.length) { const last = events[events.length - 1]; return `💾 muscle-memory review: ${last ? last.summary : "nothing to save"}`; }
  const main = writes.filter((w) => primaryPhases.includes(w.phase)).map((w) => w.summary);
  const extras = mode === "verbose" ? writes.filter((w) => !primaryPhases.includes(w.phase)).map((w) => w.summary) : [];
  return `💾 muscle-memory review: ${[...main, ...extras].join(" · ") || writes[0].summary}`;
}

/** Panel body (string[] = lines). Cheap + side-effect-free; host clips/caps. Empty → panel hides. */
// LEAN, Hermes-style: ONE dense line that LIVE-mirrors skill development. Hidden when off+idle.
export function renderMuscleMemoryPanel(state: Record<string, any>): string[] {
  const mode = process.env.MM_REFLECT === "auto" ? "auto" : process.env.MM_REFLECT === "staged" ? "staged" : "off";
  if (!state || (!state.last && !state.phase)) return mode === "off" ? [] : [`💾 muscle-memory · ${mode} · watching`];
  const ageMs = typeof state.ts === "number" ? Date.now() - state.ts : 0;
  // TRANSIENT phases (reviewing/routing/writing) are mid-flight states. If a reflect is interrupted
  // before a terminal state is written (process killed, author error, /reload), they must NOT stick
  // forever — self-heal back to "watching" after a short window (a real reflect+author finishes well
  // under 2min). Bug fixed 2026-06-27: these previously had ttlMs=0 → the panel froze on "writing…".
  const TRANSIENT = state.phase === "reviewing" || state.phase === "routing" || state.phase === "writing";
  // EVERY phase must be finite — a notice that never expires freezes the panel (Adrian hit this with
  // "writing…" AND "protected"/"blocked"). protected/blocked are transient "I just blocked something"
  // notices, NOT permanent states; default is a safety net so no future phase can ever stick forever.
  const ttlMs = state.phase === "idle" ? 60_000
    : state.phase === "done" ? 5 * 60_000
    : state.phase === "protected" ? 5 * 60_000
    : state.phase === "blocked" ? 5 * 60_000
    : TRANSIENT ? 120_000
    : 90_000;
  if (ageMs > ttlMs) return mode === "off" ? [] : [`💾 muscle-memory · ${mode} · watching`];
  switch (state.phase) {
    case "reviewing": return [`💾 muscle-memory · 🔍 reviewing ${state.detail || "evidence…"}`];
    case "routing": return [`💾 muscle-memory · 🧭 ${state.route || "routing…"}`];
    case "writing": return [`💾 muscle-memory · ✍️  writing ${state.skill ? `'${state.skill}'` : "skill"}…`];
    case "protected": return [`💾 muscle-memory · 🛡️  ${state.last || "blocked unsafe content (safe)"}`];
    case "blocked": return [`💾 muscle-memory · ⚠️  ${state.last || "blocked"}`];
    default: return [`💾 muscle-memory · ${state.last || "ready"}`]; // done/idle: the finished action
  }
}

// CROSS-AGENT MESH FEED — shared so the panel shows BOTH Mack (local) + Kev (cloud) distilling.
// Best-effort; never breaks reflect. Redacted (skill name + route + counts only).
const MESH_FEED = join(homedir(), ".local", "state", "mesh-skill-feed.jsonl");
function meshAgentLabel(): string { return process.env.MM_AGENT || (String(process.env.MEMORY_DIR || "").includes("be7d4413") ? "mack" : "agent"); }
function appendMeshFeed(e: { type: string; skill?: string; route?: string; signals?: number }) { try { mkdirSync(dirname(MESH_FEED), { recursive: true }); appendFileSync(MESH_FEED, JSON.stringify({ agent: meshAgentLabel(), ts: Date.now(), source: "muscle-memory", ...e }) + "\n"); } catch { /* */ } }
export function loadMeshFeed(n = 6): Array<{ agent?: string; type?: string; skill?: string; route?: string; signals?: number }> { try { if (!existsSync(MESH_FEED)) return []; const all: any[] = []; for (const l of readFileSync(MESH_FEED, "utf8").trim().split("\n")) { if (l) try { all.push(JSON.parse(l)); } catch { /* */ } } const seen = new Map<string, any>(); for (const e of all) seen.set(`${e.agent}|${e.skill}|${e.type}`, e); return [...seen.values()].slice(-n); } catch { return []; } }
export function renderMeshFeed(entries: Array<{ agent?: string; type?: string; skill?: string; route?: string; signals?: number }>): string[] {
  return entries.map((e) => `${(e.agent || "?").padEnd(5)} ${String(e.type || "").replace("skill_", "")} ${e.skill || ""}${e.route ? ` · ${e.route}` : ""}${e.signals ? ` · ${e.signals} signals` : ""}`.trim());
}

function isHighConfidenceCreate(res: ReviewResult, ev: { items: number; convs: number }): boolean {
  if (res.action !== "create") return false;
  const top = res.matches?.[0];
  const cleanRoute = !pickUpdateTarget(res.matches || [], 18);
  const richDraft = !!res.description && res.description.length >= 80 && /##\s+Pitfalls/i.test(res.body || "") && /##\s+Verification/i.test(res.body || "");
  return ev.convs >= 3 && ev.items >= 1 && cleanRoute && richDraft;
}

function graduateStagedSkill(name: string, ctx?: any): string {
  const nm = slug(name);
  if (!nm) throw new Error("name required");
  const srcDir = join(STAGED_DIR, nm);
  const src = join(srcDir, "SKILL.md");
  if (!existsSync(src)) throw new Error(`no staged skill '${nm}'`);
  const content = readFileSync(src, "utf8");
  const desc = (content.match(/^description:\s*(.+)$/im)?.[1] || "").trim();
  const body = content.replace(/^---[\s\S]*?\n---\s*\n?/, "");
  const lint = lintSkillDraft({ name: nm, description: desc, body });
  if (!lint.ok) throw new Error(`linter blocked: ${lint.issues.join("; ")}`);
  const sec = scanSkillContent(body); if (!sec.ok) throw new Error(`security blocked: ${sec.issues.join("; ")}`);
  const dstRoot = agentSkillsDir(ctx);
  const dst = writeSkill(dstRoot, nm, content.includes(MM_TAG) ? content : content + `\n<!-- ${MM_TAG}: graduated ${new Date().toISOString().slice(0, 10)} -->\n`);
  mkdirSync(STAGED_RETIRED_DIR, { recursive: true });
  try { renameSync(srcDir, join(STAGED_RETIRED_DIR, `${nm}-graduated-${Date.now()}`)); } catch { /* best-effort quarantine */ }
  appendUiEvent({ phase: "skill_graduated", summary: `graduated '${nm}'`, skill: nm, action: "graduate", route: "manual" });
  appendMeshFeed({ type: "skill_graduated", skill: nm, route: "GRADUATE", signals: 0 });
  writeUiState({ phase: "done", last: `graduated '${nm}'`, route: "GRADUATE · live" });
  return dst;
}

function catalogPrivacyScan(content: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const body = content.replace(/^---[\s\S]*?\n---\s*\n?/, "");
  const sec = scanSkillContent(content); if (!sec.ok) issues.push(...sec.issues.map((i) => `security: ${i}`));
  if (/\/Users\/[A-Za-z0-9._-]+\//.test(content) || /\/home\/[A-Za-z0-9._-]+\//.test(content)) issues.push("private absolute user path");
  if (/lc-local-backend/.test(content) || /~\/\.letta\/agents\//.test(content) || /~\/\.agents\/agents\//.test(content)) issues.push("local harness path");
  if (/\b(?:im8store\.myshopify\.com|prenetics|northflank|agent-71b0883e|chan2saucy|adrianchan)\b/i.test(content)) issues.push("private org/user/agent identifier");
  if (/references\/evidence|receipt json|final-gate-result\.json/i.test(body) && /\/Users\//.test(content)) issues.push("private evidence reference");
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

function publishSkillToCatalog(name: string, ctx?: any): string {
  const nm = slug(name);
  if (!nm) throw new Error("name required");
  const d = scanDirs(ctx).find((x) => existsSync(join(x, nm, "SKILL.md")));
  if (!d) throw new Error(`no active skill '${nm}'`);
  const src = join(d, nm, "SKILL.md");
  if (!existsSync(src)) throw new Error(`no SKILL.md for '${nm}'`);
  const content = readFileSync(src, "utf8");
  const desc = (content.match(/^description:\s*(.+)$/im)?.[1] || "").trim();
  const body = content.replace(/^---[\s\S]*?\n---\s*\n?/, "");
  const lint = lintSkillDraft({ name: nm, description: desc, body });
  if (!lint.ok) throw new Error(`linter blocked: ${lint.issues.join("; ")}`);
  const priv = catalogPrivacyScan(content);
  if (!priv.ok) throw new Error(`privacy blocked: ${priv.issues.join("; ")}`);
  const dstDir = join(GLOBAL_SKILLS_DIR, nm);
  mkdirSync(dstDir, { recursive: true });
  const published = content.includes(MM_TAG) ? content + `\n<!-- ${MM_TAG}: published ${new Date().toISOString().slice(0, 10)}; catalog=global -->\n` : content + `\n<!-- ${MM_TAG}: published ${new Date().toISOString().slice(0, 10)}; catalog=global -->\n`;
  writeFileSync(join(dstDir, "SKILL.md"), published);
  appendUiEvent({ phase: "skill_published", summary: `published '${nm}' to custom skill catalog`, skill: nm, action: "publish", route: "global-catalog" });
  appendMeshFeed({ type: "skill_published", skill: nm, route: "PUBLISH", signals: 0 });
  writeUiState({ phase: "done", last: `published '${nm}' to catalog`, route: "PUBLISH · catalog" });
  return join(dstDir, "SKILL.md");
}

/** Fork-based reviewer author: the model authors a skill in a hidden conversation. Guarded —
 * any failure returns "" and the caller treats it as "nothing to save". (Same pattern as the autopilot fork.) */
function reviewForkAuthor(ctx: any): (sys: string, user: string) => Promise<string> {
  return async (sys: string, user: string) => {
    try {
      if (typeof ctx?.conversation?.fork !== "function") return "";
      const forked = await ctx.conversation.fork({ hidden: true });
      const stream = await forked.sendMessageStream([{ role: "user", content: `${sys}\n\n${user}` }]);
      let out = ""; for await (const c of stream as AsyncIterable<any>) out += streamChunkText(c);
      return out.trim();
    } catch { return ""; }
  };
}

/** v3.1 AUTONOMOUS REFLECTIVE REVIEW: cross-conversation evidence → forked reviewer → update-first
 * routing + gates → write (staged by default; live in auto mode). Reversible + receipted. The surpass, autonomous. */
export async function runReflectiveReview(ctx: any, config: { mode?: "staged" | "auto"; minItems?: number; authorFn?: (s: string, u: string) => Promise<string> } = {}): Promise<ReviewResult & { wrote?: string }> {
  const dirs = scanDirs(ctx);
  // In staged mode, staged skills are part of the dedupe surface. Otherwise repeated manual reflects
  // can spray near-duplicate staged siblings before review/graduation (live dogfood catch).
  const reviewDirs = config.mode === "auto" ? dirs : [...dirs, STAGED_DIR];
  const ev = buildCrossConversationEvidence(loadExperience());
  appendUiEvent({ phase: "review_started", summary: `reviewing ${ev.convs} sessions / ${ev.items} durable signals` }); writeUiState({ phase: "reviewing", detail: `${ev.convs} sessions / ${ev.items} signals` });
  if (ev.items < (config.minItems ?? 2)) { appendUiEvent({ phase: "reflect_none", summary: `nothing to save yet (${ev.items} signals)` }); writeUiState({ phase: "idle", last: "nothing to save yet" }); return { action: "none", reason: `only ${ev.items} cross-session signals (need ≥${config.minItems ?? 2})` }; }
  // PERSONALIZED PATCHING: retrieve the user's actual preferences from memory and inject them.
  const prefs = retrievePreferences(ev.digest, process.env.MEMORY_DIR);
  const digest = ev.digest + (prefs.length ? `\n\nUSER PREFERENCES (from this agent's memory — bake the relevant ones into the skill's guidance):\n${prefs.map((p) => `- ${p}`).join("\n")}` : "");
  // LIVE MIRROR: surface the route + writing phase during the (long) author call, so the panel animates.
  const preTgt = pickUpdateTarget(searchSkills(reviewDirs, digest, 3), 18);
  const routeKey = preTgt ? `UPDATE:${preTgt.name}` : "CREATE";
  const sig = reflectSignature(ev);
  if (loadHandledReflects()[sig]) {
    const summary = `already reflected ${routeKey.toLowerCase()} for this evidence signature`;
    appendUiEvent({ phase: "reflect_none", summary });
    writeUiState({ phase: "idle", last: summary, route: "SKIP · handled" });
    return { action: "none", reason: summary };
  }
  writeUiState({ phase: "routing", route: preTgt ? `UPDATE → ${preTgt.name}` : "CREATE (new skill)" });
  appendUiEvent({ phase: "review_planned", summary: preTgt ? `route UPDATE → ${preTgt.name}` : "route CREATE — no existing skill safely covers this" });
  writeUiState({ phase: "writing", skill: preTgt?.name, route: preTgt ? `UPDATE → ${preTgt.name}` : "CREATE" });
  const author = config.authorFn || reviewForkAuthor(ctx);
  let res: ReviewResult;
  try {
    res = await reviewAndAuthor(digest, reviewDirs, author);
  } catch (e: any) {
    // author/review threw — never leave the panel stuck on "writing…"; write a terminal state.
    appendUiEvent({ phase: "reflect_error", summary: `author failed: ${String(e?.message ?? e).slice(0, 80)}` });
    writeUiState({ phase: "idle", last: "review interrupted — will retry next session", route: "ERROR · safe" });
    return { action: "none", reason: `author error: ${String(e?.message ?? e).slice(0, 120)}` };
  }
  if ((res.action === "create" || res.action === "update") && res.name && res.content) {
    const live = config.mode === "auto";
    const graduate = live || res.action === "update" || isHighConfidenceCreate(res, ev);
    const dir = graduate ? agentSkillsDir(ctx) : STAGED_DIR;
    const tagged = res.content.includes(MM_TAG) ? res.content : res.content + `\n<!-- ${MM_TAG}: reflective ${new Date().toISOString().slice(0, 10)}; action=${res.action}; convs=${ev.convs}; ${graduate ? "graduated=true" : "staged=true"} -->\n`;
    try {
      const oldContent = res.action === "update" && res.updateTarget ? (() => { const d = reviewDirs.find((x) => existsSync(join(x, res.updateTarget!, "SKILL.md"))); return d ? readSkill(d, res.updateTarget!) : undefined; })() : undefined;
      writeSkill(dir, res.name, tagged);
      // EVIDENCE-PACK MANIFEST: provenance next to the skill (not model vibes — a git object).
      const manifest = buildEvidenceManifest({ action: res.action, skill: res.name, updateTarget: res.updateTarget, convs: ev.convs, signals: ev.items, memfsHits: res.matches || [], preferences: prefs, rejected: ev.rejected, newContent: tagged, oldContent });
      const evDir = join(dir, res.name, "references", "evidence"); mkdirSync(evDir, { recursive: true });
      writeFileSync(join(evDir, `${Date.now()}.json`), JSON.stringify(manifest, null, 2));
      ensureDir(); mkdirSync(RECEIPTS_DIR, { recursive: true });
      writeFileSync(join(RECEIPTS_DIR, `reflect-${Date.now()}.json`), JSON.stringify({ action: res.action, name: res.name, updateTarget: res.updateTarget, convs: ev.convs, items: ev.items, prefsInjected: prefs.length, rejected: ev.rejected.length, dir, ts: Date.now() }, null, 2));
      // v3.3 VISIBLE SUMMARY: Hermes-style finished-action events (no chain-of-thought).
      const phase = graduate ? "skill_graduated" : "skill_staged";
      const verb = graduate ? "graduated" : (res.action === "update" ? "staged update to" : "staged");
      const summary = `${verb} '${res.name}' (${res.action === "update" ? "update-first" : "new"}, ${ev.convs} sessions/${ev.items} signals)`;
      appendUiEvent({ phase, summary, skill: res.name, action: res.action, route: res.updateTarget ? `update ${res.updateTarget}` : "create" });
      appendMeshFeed({ type: phase, skill: res.name, route: graduate ? "GRADUATE" : res.action.toUpperCase(), signals: ev.items }); // cross-agent feed (see Mack + Kev distilling)
      markHandledReflect(sig, routeKey);
      appendUiEvent({ phase: "evidence_manifest_written", summary: "wrote evidence manifest" });
      if (ev.rejected.length) appendUiEvent({ phase: "noise_rejected", summary: `rejected ${ev.rejected.length} env-noise items` });
      if (prefs.length) appendUiEvent({ phase: "memory_pref_injected", summary: `injected ${prefs.length} user preferences` });
      writeUiState({ phase: "done", last: summary, route: `${graduate ? "GRADUATE" : res.action.toUpperCase()}${res.updateTarget ? " " + res.updateTarget : ""} · ${graduate ? "live" : "staged"}` });
      return { ...res, wrote: join(dir, res.name) };
    } catch (e: any) { appendUiEvent({ phase: "reflect_error", summary: `write failed: ${String(e?.message ?? e).slice(0, 80)}` }); return { ...res, reason: String(e?.message ?? e) }; }
  }
  if (res.action === "reject") {
    const safe = /\bsecurity:/i.test(res.reason || ""); // a security block is the gate PROTECTING you, not a failure
    markHandledReflect(sig, routeKey);
    appendUiEvent({ phase: safe ? "blocked_unsafe" : "reflect_none", summary: safe ? `🛡️ blocked unsafe content (safe): ${res.reason}` : `draft rejected; nothing saved (${res.reason})` });
    writeUiState({ phase: safe ? "protected" : "idle", last: safe ? "blocked unsafe content (safe)" : `draft rejected; nothing saved`, route: safe ? "BLOCKED · protected" : "SKIP · rejected-draft" });
  }
  else { markHandledReflect(sig, routeKey); appendUiEvent({ phase: "reflect_none", summary: "nothing durable to save" }); writeUiState({ phase: "idle", last: "nothing to save" }); } // mark handled so the autonomous nudge doesn't re-review identical evidence every turn
  return res;
}

// Test hook (deterministic validation without live data).
export const __mm = { commandTemplate, fingerprint, detect, detectTemplates, detectSequences, maturityScore, MM, loadRows, dedupCheck, slug, draftSkillFromCandidate, candidateName, candidateDescription, curateManagedSkills, managedSkillUsage,
  streamChunkText, isDurableLesson, isValidSkillName, buildCrossConversationEvidence, REVIEW_PROMPT, reviewAndAuthor, searchSkills, pickUpdateTarget, runReflectiveReview, graduateStagedSkill, publishSkillToCatalog, catalogPrivacyScan, isHighConfidenceCreate, runAutonomousPrune,
  buildEvidenceManifest, retrievePreferences, coverageMap, churnSignal, summarizeReflectActions, renderMuscleMemoryPanel, loadMeshFeed, renderMeshFeed,
  buildRegistry, curatorPass, skillVerbs, specDrift, lifecycleTransition, CURATOR, setPinned, isPinned, buildDefenses, preActionDefense,
  autopilotPlan, executeAutopilotPlan, AUTOPILOT_DEFAULT, managedView, forkAuthor,
  scanSkillContent, scanSupportFile, validateSupportPath, writeSupportFile, removeSupportFile, restoreManagedSkill,
  // v2
  classifyError, mergeOutcomes, correlateOutcomes, loadExperience, detectRepairChains, detectAntiPatterns, impactScore, lintSkillDraft, aggregateTelemetry, effectivenessVerdict, draftWithRepair, stepSig,
  // lifecycle file helpers (for end-to-end manage proof)
  writeSkill, isManaged, listSkillNames, readSkill, retireManagedSkill, agentSkillsDir, scanDirs, MM_TAG };

export default function activate(letta: any) {
  const disposers: Array<() => void> = [];
  let panel: any = null; // v3.3 Hermes-visible panel (assigned below; referenced by event handlers)
  const DEFENSE_HITS = join(STATE_DIR, "defense-hits.jsonl");
  // Defenses are computed lazily (off the hot path): rebuilt at activate + on conversation_close.
  let defensesCache: Defense[] = [];
  const refreshDefenses = () => { try { defensesCache = buildDefenses(loadExperience()); } catch { defensesCache = []; } };
  refreshDefenses();

  if (letta.capabilities?.events?.tools) {
    disposers.push(letta.events.on("tool_start", (event: any) => {
      try {
        const tool = String(event?.toolName ?? "");
        if (!tool) return;
        const { fp, tmpl } = fingerprint(tool, event?.args ?? {});
        appendJsonl(LOG_PATH, { ts: Date.now(), conv: event?.conversationId ?? null, agent: event?.agentId ?? null, tool, fp, tmpl, h: hash(fp), id: event?.toolCallId ?? null });
        // v2 edge: Skill-usage tracking (curator) + PRE-ACTION defense (the tool_start hook Hermes lacks).
        if (tool === "Skill" && typeof event?.args?.skill === "string") bumpUsage(slug(String(event.args.skill)));
        if (defensesCache.length) {
          const hit = preActionDefense(stepSig({ tool, fp, tmpl }), defensesCache);
          if (hit && hit.severity >= 2) appendJsonl(DEFENSE_HITS, { ts: Date.now(), conv: event?.conversationId ?? null, step: hit.trigger, kind: hit.kind, errClass: hit.errClass, defense: hit.defense, severity: hit.severity });
        }
      } catch { /* best-effort */ }
      return; // OBSERVE only — never transform args
    }));

    // v2: OUTCOME CAPTURE via tool_end. Read-only on the result (never modify behavior);
    // we persist only a boolean + a REDACTED error class keyed by call id.
    try {
      disposers.push(letta.events.on("tool_end", (event: any) => {
        try {
          const ok = event?.ok ?? (event?.isError ? false : event?.error ? false : true);
          const err = ok === false ? classifyError(event?.resultText ?? event?.error ?? event?.result ?? "", false) : null;
          appendJsonl(OUTCOME_PATH, { ts: Date.now(), id: event?.toolCallId ?? null, tool: event?.toolName ?? null, conv: event?.conversationId ?? null, ok: !!ok, err });
        } catch { /* best-effort */ }
        return; // do NOT modify the tool result
      }));
    } catch { /* tool_end not available on this surface */ }
  }

  // v2: LLM telemetry (aggregate ONLY — never raw prompts/messages).
  try {
    const spanByConv = new Map<string, number>();
    disposers.push(letta.events.on("llm_start", (event: any) => { try { spanByConv.set(String(event?.conversationId ?? "?"), Date.now()); } catch {} }));
    disposers.push(letta.events.on("llm_end", (event: any) => {
      try {
        const started = spanByConv.get(String(event?.conversationId ?? "?")) ?? Date.now();
        const span = { tokensIn: event?.usage?.promptTokens ?? event?.tokensIn, tokensOut: event?.usage?.completionTokens ?? event?.tokensOut, ms: Date.now() - started, stop: event?.stopReason };
        let t: any = {}; try { if (existsSync(TELEMETRY_PATH)) t = JSON.parse(readFileSync(TELEMETRY_PATH, "utf8")); } catch {}
        const agg = aggregateTelemetry([...(t.spans ? [] : []), span]);
        t.calls = (t.calls || 0) + agg.calls; t.tokensIn = (t.tokensIn || 0) + agg.tokensIn; t.tokensOut = (t.tokensOut || 0) + agg.tokensOut; t.ms = (t.ms || 0) + agg.ms;
        try { ensureDir(); writeFileSync(TELEMETRY_PATH, JSON.stringify(t)); } catch {}
      } catch { /* best-effort */ }
    }));
  } catch { /* llm events not available */ }

  // v2: COMPACTION hooks — flush + write a tiny receipt so we never lose an "almost-learned" candidate.
  try {
    disposers.push(letta.events.on("compact_start", (event: any) => {
      try { ensureDir(); mkdirSync(RECEIPTS_DIR, { recursive: true });
        const { candidates } = detect(loadExperience());
        writeFileSync(join(RECEIPTS_DIR, `compact-${Date.now()}.json`), JSON.stringify({ phase: "start", conv: event?.conversationId ?? null, candidatesPreserved: candidates.length, ts: Date.now() }));
      } catch {}
    }));
    disposers.push(letta.events.on("compact_end", (event: any) => {
      try { ensureDir(); mkdirSync(RECEIPTS_DIR, { recursive: true });
        writeFileSync(join(RECEIPTS_DIR, `compact-end-${Date.now()}.json`), JSON.stringify({ phase: "end", conv: event?.conversationId ?? null, before: event?.beforeMessageCount ?? null, after: event?.afterMessageCount ?? null, ts: Date.now() }));
      } catch {}
    }));
  } catch { /* compact events not available */ }

  if (letta.capabilities?.events?.lifecycle) {
    disposers.push(letta.events.on("conversation_close", (event: any, ctx: any) => {
      appendJsonl(SESSIONS_PATH, { ts: Date.now(), conv: event?.conversationId ?? null, agent: event?.agentId ?? null, reason: event?.reason ?? null, toolCalls: event?.toolCallCount ?? null, messages: event?.messageCount ?? null, durationMs: event?.durationMs ?? null });
      refreshDefenses(); // rebuild the pre-action defense set off the hot path
      // AUTOPILOT trigger — opt-in only (MM_AUTOPILOT=staged|auto), at session end (idle, never mid-work).
      const apMode = process.env.MM_AUTOPILOT;
      if (apMode === "staged" || apMode === "auto") { runAutopilot(ctx ?? { agentId: event?.agentId }, { ...AUTOPILOT_DEFAULT, mode: apMode }).catch(() => { /* autopilot must never break the app */ }); }
      // v3.1 REFLECTIVE REVIEW trigger — opt-in (MM_REFLECT=staged|auto): the cross-conversation
      // reviewer authors/updates a class-level skill autonomously at session end. Default OFF.
      const rfMode = process.env.MM_REFLECT;
      if (rfMode === "staged" || rfMode === "auto") {
        runReflectiveReview(ctx ?? { agentId: event?.agentId }, { mode: rfMode })
          .then(() => { runAutonomousPrune(ctx ?? { agentId: event?.agentId }, { maxRetire: 1 }); try { panel?.update(); } catch { /* */ } })
          .catch(() => { /* reflection/prune must never break the app */ });
      }
    }));

    // ── AUTONOMOUS DISTILLATION (Hermes-style background review) ──────────────────────────────────
    // conversation_close (above) only fires at SESSION END. Hermes also nudges DURING a session
    // ("periodic nudge ... fires without user input"). Mirror that: after EACH turn, cheaply check
    // whether a mature, not-yet-distilled cross-session pattern has emerged — if so, distill it ON OUR
    // OWN, with no user command. The maturity gate (≥2 durable signals) + signature dedup mean it fires
    // exactly once per newly-matured pattern, never every turn. Opt-in (MM_REFLECT=staged|auto); runs in
    // the background (fire-and-forget) so it never blocks a turn. THIS is what makes it truly autonomous.
    let autoReflectInFlight = false;
    disposers.push(letta.events.on("turn_end", (event: any, ctx: any) => {
      const rfMode = process.env.MM_REFLECT;
      if ((rfMode !== "staged" && rfMode !== "auto") || autoReflectInFlight) return;
      try {
        const ev = buildCrossConversationEvidence(loadExperience());
        if (ev.items < 2 || loadHandledReflects()[reflectSignature(ev)]) return; // nothing new + mature → stay quiet
      } catch { return; }
      autoReflectInFlight = true;
      runReflectiveReview(ctx ?? { agentId: event?.agentId }, { mode: rfMode })
        .then(() => { runAutonomousPrune(ctx ?? { agentId: event?.agentId }, { maxRetire: 1 }); try { panel?.update(); } catch { /* */ } })
        .catch(() => { /* reflection must never break the app */ })
        .finally(() => { autoReflectInFlight = false; });
    }));
  }

  // v3.3 HERMES-VISIBLE PANEL — a compact self-improvement summary around the input bar (the supported
  // mod UI surface). Cheap, churn-free render (reads a small JSON); updates on reflect + a slow interval.
  if (letta.capabilities?.ui?.panels && letta.ui?.openPanel) {
    try {
      panel = letta.ui.openPanel({ id: "muscle-memory-live", order: 20, render: () => { try { return renderMuscleMemoryPanel(readUiState()); } catch { return []; } } });
      livePanel = panel; // enable LIVE re-render on every state change
      // SELF-HEAL on (re)load: a reflect cannot survive a reload, so any transient phase persisted here
      // is necessarily stale (interrupted mid-author). Reset it to idle so the panel never opens stuck on
      // "✍️ writing skill…" (the hour-long freeze Adrian hit 2026-06-27). Then repaint immediately.
      try { const s = readUiState(); if (s && s.phase && s.phase !== "done") writeUiState({ phase: "idle", last: "ready", route: "" }); } catch { /* */ }
      try { panel?.update(); } catch { /* */ } // repaint on load, don't wait for the interval tick
      const t = setInterval(() => { try { panel?.update(); } catch { /* */ } }, 20_000);
      disposers.push(() => { clearInterval(t); try { panel?.close(); } catch { /* */ } });
    } catch { /* UI optional */ }
  }

  if (letta.capabilities?.commands) {
    disposers.push(letta.commands.register({
      id: "muscle-memory",
      description: "Show muscle-memory observations + current mature skill candidates",
      async run(ctx: any = {}) {
        const argv = Array.isArray(ctx?.argv) ? ctx.argv : String(ctx?.args || "").trim().split(/\s+/).filter(Boolean);
        const sub = String(argv?.[0] || "").toLowerCase();
        if (sub === "events") {
          const n = Math.max(1, Math.min(50, Number(argv?.[1] || 8) || 8));
          const events = loadUiEvents(n);
          const lines = events.map((e) => `💾 muscle-memory review: ${e.summary}`);
          return { type: "output", output: lines.join("\n") || "(no muscle-memory review events yet)" };
        }
        if (sub === "squad") {
          const feed = loadMeshFeed(10);
          return { type: "output", output: feed.length ? "💾 squad distillations (cross-agent):\n" + renderMeshFeed(feed).map((l) => `  ${l}`).join("\n") : "(no squad distillations yet — Mack + Kev appear here as they distill)" };
        }
        if (sub === "staged") {
          let s: string[] = []; try { s = existsSync(STAGED_DIR) ? readdirSync(STAGED_DIR).filter((n) => existsSync(join(STAGED_DIR, n, "SKILL.md"))) : []; } catch { /* */ }
          return { type: "output", output: s.length ? "staged skills (1-tap to graduate):\n" + s.map((n) => `  · ${n}`).join("\n") : "(no staged skills yet — set MM_REFLECT=staged, work a few sessions)" };
        }
        if (sub === "coverage") {
          const cov = coverageMap(loadExperience(), scanDirs(ctx));
          const icon = (st: string) => st === "covered" ? "✓" : st === "uncovered" ? "＋" : st === "over-covered" ? "⧉" : "✗";
          return { type: "output", output: cov.length ? cov.map((c) => `${icon(c.status)} [${c.status}] ${c.domain}${c.skill ? ` → ${c.skill}` : ""}`).join("\n") : "(no durable task-classes yet)" };
        }
        const rows = loadExperience();
        const byTool: Record<string, number> = {};
        for (const r of rows) byTool[r.tool] = (byTool[r.tool] || 0) + 1;
        const { candidates, templates, sequences } = detect(rows);
        const toolLine = Object.entries(byTool).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join("  ");
        const cand = candidates.slice(0, 6).map((c) => `  [${c.maturity}] ${c.kind} ×${c.count}/${c.convs}conv${c.fixes ? ` (${c.fixes} fixes)` : ""}  ${c.key.slice(0, 90)}`).join("\n");
        // v3.3 dashboard: reflect mode + recent Hermes-style review summary + library counts
        const mode = process.env.MM_REFLECT === "auto" ? "auto" : process.env.MM_REFLECT === "staged" ? "staged" : "off (set MM_REFLECT=staged to enable)";
        const events = loadUiEvents(8);
        const lastReview = events.length ? summarizeReflectActions(events) : "(no review yet)";
        let managed = 0, staged = 0;
        try { for (const d of scanDirs(ctx)) for (const n of listSkillNames(d)) if (isManaged(d, n)) managed++; } catch { /* */ }
        try { staged = existsSync(STAGED_DIR) ? readdirSync(STAGED_DIR).filter((n) => existsSync(join(STAGED_DIR, n, "SKILL.md"))).length : 0; } catch { /* */ }
        const cov = (() => { try { const c = coverageMap(rows, scanDirs(ctx)); return `${c.filter((x) => x.status === "covered").length} covered / ${c.filter((x) => x.status === "uncovered").length} uncovered / ${c.filter((x) => x.status === "over-covered").length} over-covered`; } catch { return "n/a"; } })();
        const out = [
          `💾 muscle-memory · reflect ${mode}`,
          `last review: ${lastReview}`,
          `library: ${managed} managed · ${staged} staged · coverage ${cov}`,
          ``,
          `recent review events:`,
          events.slice(-5).map((e) => `  · ${e.summary}`).join("\n") || `  (none yet — set MM_REFLECT=staged, work a few sessions)`,
          ...(() => { const feed = loadMeshFeed(4); return feed.length ? [``, `squad distillations (cross-agent):`, ...renderMeshFeed(feed).map((l) => `  ${l}`)] : []; })(),
          ``,
          `${rows.length} reps observed${toolLine ? ` · tools ${toolLine}` : ""}`,
          `mature candidates: ${candidates.length} (${templates.length} templates, ${sequences.length} sequences)`,
          cand || `  (none mature yet — need ≥${MM.MIN_COUNT}× across ≥${MM.MIN_CONVS} conversations)`,
          ``,
          `commands: /muscle-memory [events|squad|staged|coverage]`,
        ].join("\n");
        return { type: "output", output: out };
      },
    }));
  }

  // D3: skill lifecycle management (read actions stay smooth; mutating actions are approval-gated).
  if (letta.capabilities?.tools) {
    const readParams = {
      type: "object",
      properties: {
        action: { type: "string", enum: ["candidates", "draft", "load", "list", "curate", "repairs", "antipatterns", "defenses", "defense_hits", "registry", "autopilot_plan", "reflect_plan", "coverage"], description: "read-only operation to perform" },
        name: { type: "string", description: "skill name — for load" },
        candidate_key: { type: "string", description: "candidate key or substring to draft; defaults to top mature candidate" },
        mode: { type: "string", enum: ["staged", "auto"], description: "autopilot mode preview — for autopilot_plan" },
      },
      required: ["action"],
      additionalProperties: false,
    };
    const writeParams = {
      type: "object",
      properties: {
        action: { type: "string", enum: ["create_from_candidate", "create", "patch", "edit_full", "write_file", "remove_file", "retire", "restore", "pin", "unpin", "autopilot_run", "reflect", "graduate"], description: "mutating operation to perform" },
        mode: { type: "string", enum: ["staged", "auto"], description: "autopilot mode — for autopilot_run (staged=draft+1-tap, auto=graduate-on-gate)" },
        name: { type: "string", description: "skill name (gerund, lowercase-hyphen) — for create/patch/retire" },
        description: { type: "string", description: "skill description incl. trigger phrases — for create" },
        body: { type: "string", description: "SKILL.md markdown body — for create" },
        old: { type: "string", description: "exact text to replace — for patch" },
        replacement: { type: "string", description: "replacement text — for patch" },
        candidate_key: { type: "string", description: "candidate key or substring to create from; defaults to top mature candidate" },
        reason: { type: "string", description: "reason for retirement/quarantine — for retire" },
        absorbed_into: { type: "string", description: "umbrella skill name this was merged into — for retire (consolidation vs prune)" },
        file_path: { type: "string", description: "support file path under references/templates/scripts/assets — for write_file/remove_file" },
        file_content: { type: "string", description: "support file content — for write_file" },
      },
      required: ["action"],
      additionalProperties: false,
    };

    const readRun = async (ctx: any) => {
      const a = ctx?.args || {};
      const dirs = scanDirs(ctx);
      const findSkillDir = (name: string) => dirs.find((d) => existsSync(join(d, name, "SKILL.md")));
      try {
        if (a.action === "candidates") {
          const rows = loadExperience();
          const { candidates } = detect(rows);
          return candidates.slice(0, 10).map((c) => `[impact ${impactScore(c).score} | mat ${c.maturity}] ${c.kind} ×${c.count}/${c.convs}conv${c.fixes ? ` (${c.fixes}fix)` : ""}  ${c.key}`).join("\n") || "(no mature candidates yet — keep working)";
        }
        if (a.action === "repairs") {
          const rs = detectRepairChains(loadExperience());
          return rs.slice(0, 10).map((r) => `×${r.count}/${r.convs}conv  FAIL[${r.trigger}] (${r.errClass}) → ${r.fixStep} → PASS`).join("\n") || "(no repair chains observed yet)";
        }
        if (a.action === "antipatterns") {
          const aps = detectAntiPatterns(loadExperience());
          return aps.slice(0, 10).map((p) => `×${p.fails}fails/${p.convs}conv  AVOID[${p.step}] — ${p.errClass}`).join("\n") || "(no recurring unrecovered failures observed)";
        }
        if (a.action === "defenses") {
          // The failure-defense set Hermes lacks: [trigger → error → consequence → defense].
          const ds = buildDefenses(loadExperience());
          return ds.slice(0, 12).map((d) => `[sev${d.severity} ${d.kind}] ${d.trigger} → ${d.errClass} ⇒ ${d.defense}`).join("\n") || "(no defenses learned yet)";
        }
        if (a.action === "defense_hits") {
          // Advisory pre-action defense receipts recorded at tool_start (read-only; no enforcement).
          const hits: any[] = [];
          if (existsSync(DEFENSE_HITS)) for (const l of readFileSync(DEFENSE_HITS, "utf8").trim().split("\n").slice(-20)) { if (l) try { hits.push(JSON.parse(l)); } catch { /* */ } }
          return hits.length ? hits.map((h) => `[sev${h.severity} ${h.kind}] ${h.step} → ${h.errClass} ⇒ ${h.defense}`).join("\n") : "(no pre-action defense hits recorded)";
        }
        if (a.action === "registry") {
          const reg = buildRegistry(dirs);
          return reg.count ? `${reg.count} managed skills:\n` + reg.skills.map((s) => `- ${s.name}: ${s.description}`).join("\n") : "(registry empty)";
        }
        if (a.action === "autopilot_plan") {
          // DRY-RUN preview of the self-driving loop — no writes.
          const rows = loadExperience();
          const plan = autopilotPlan({ rows, managed: managedView(dirs), dirsForDedup: dirs, config: { ...AUTOPILOT_DEFAULT, mode: a.mode === "auto" ? "auto" : "staged" } });
          const lines = plan.decisions.map((d) => d.op === "distill" ? `  DISTILL ${d.name} [${d.gate}] — ${d.reason}` : d.op === "refine" ? `  REFINE ${d.skill} — ${d.reason}` : `  RETIRE ${d.skill} — ${d.reason}`);
          return `autopilot mode=${plan.mode} budget=${plan.budget.used}/${plan.budget.limit}\n${lines.join("\n") || "  (no decisions)"}\nskipped: ${plan.skipped.length}`;
        }
        if (a.action === "reflect_plan") {
          // v3.1 DRY-RUN: show the cross-conversation evidence + the MemFS update-first routing (no model call, no write).
          const ev = buildCrossConversationEvidence(loadExperience());
          const top = searchSkills([...dirs, STAGED_DIR], ev.digest, 3);
          const tgt = pickUpdateTarget(top, 18);
          const route = tgt ? `UPDATE-FIRST → "${tgt.name}" (score ${tgt.score}, ${tgt.matched} distinctive terms, dominant)` : "CREATE (no existing skill safely covers this — matches too weak/ambiguous/tied)";
          return `reflective review preview — ${ev.convs} sessions, ${ev.items} durable signals\nrouting: ${route}\ntop matches: ${top.map((t) => `${t.name}(s${t.score}/m${t.matched})`).join(", ") || "none"}\n\n${ev.digest.slice(0, 700)}`;
        }
        if (a.action === "coverage") {
          // SKILL COVERAGE MAP: which task-classes have a defender, which are uncovered, which are over-covered.
          const cov = coverageMap(loadExperience(), dirs);
          if (!cov.length) return "(no durable task-classes observed yet)";
          const icon = (s: string) => s === "covered" ? "✓" : s === "uncovered" ? "＋" : s === "over-covered" ? "⧉" : "✗";
          return cov.map((c) => `${icon(c.status)} [${c.status}] ${c.domain}${c.skill ? ` → ${c.skill}` : ""} (${c.signals} signals)`).join("\n");
        }
        if (a.action === "list") {
          const managed: string[] = [];
          for (const d of dirs) for (const n of listSkillNames(d)) if (isManaged(d, n)) managed.push(`- ${n}: ${skillDesc(d, n)}`);
          return managed.length ? managed.join("\n") : "(no muscle-memory-managed skills yet — use muscle_memory_skill_write action:create)";
        }
        if (a.action === "curate") {
          const rows = curateManagedSkills(ctx);
          if (!rows.length) return "(no muscle-memory-managed skills yet — create one first)";
          return rows.map((r) => `${r.verdict.toUpperCase()} uses=${r.uses} ${r.name} — ${r.reason}`).join("\n");
        }
        if (a.action === "load") {
          if (!a.name) return { status: "error", content: "name required" };
          const d = findSkillDir(a.name);
          if (!d) return { status: "error", content: `no skill '${a.name}'` };
          return readSkill(d, a.name);
        }
        if (a.action === "draft") {
          const c = findCandidate(a.candidate_key);
          if (!c) return { status: "error", content: "no matching mature candidate — run action:candidates first or keep working" };
          const repair = repairForCandidate(c);
          const d = draftWithRepair(c, repair);
          const lint = lintSkillDraft(d, { needsPitfalls: !!c.fixes });
          return { candidate: c, ...d, repair: repair ?? null, lint, content: `---\nname: ${d.name}\ndescription: ${d.description}\n---\n\n${d.body}` };
        }
        return { status: "error", content: "unknown read action" };
      } catch (e: any) {
        return { status: "error", content: String(e?.message ?? e) };
      }
    };

    const writeRun = async (ctx: any) => {
      const a = ctx?.args || {};
      const dir = agentSkillsDir(ctx);
      const dirs = scanDirs(ctx);
      const findSkillDir = (name: string) => dirs.find((d) => existsSync(join(d, name, "SKILL.md")));
      try {
        if (a.action === "autopilot_run") {
          const cfg = { ...AUTOPILOT_DEFAULT, mode: (a.mode === "auto" ? "auto" : "staged") as AutopilotMode };
          const r = await runAutopilot(ctx, cfg);
          const res = r.result || { graduated: [], staged: [], refined: [], retired: [] };
          return `autopilot ${cfg.mode}: graduated ${res.graduated.length} ${JSON.stringify(res.graduated)}, staged ${res.staged.length}, refined ${res.refined.length} ${JSON.stringify(res.refined)}, retired ${res.retired.length} ${JSON.stringify(res.retired)}. budget ${r.budget.used + res.graduated.length + res.staged.length}/${r.budget.limit}.`;
        }
        if (a.action === "reflect") {
          // v3.1 reflective review: cross-conversation evidence → forked reviewer → update-first + gates → write.
          const r = await runReflectiveReview(ctx, { mode: a.mode === "auto" ? "auto" : "staged" });
          if (r.action === "none" || r.action === "reject") return `reflect: ${r.action} — ${r.reason || ""}`;
          const graduated = !!r.wrote && !String(r.wrote).startsWith(STAGED_DIR);
          return `reflect: ${r.action} skill "${r.name}"${r.updateTarget ? ` (updated existing — anti-bloat)` : ""}${graduated ? " (graduated)" : ""} → ${r.wrote || "(write failed)"}`;
        }
        if (a.action === "graduate") {
          if (!a.name) return { status: "error", content: "name required" };
          const p = graduateStagedSkill(String(a.name), ctx);
          return `graduated '${slug(a.name)}' -> ${p}`;
        }
        if (a.action === "pin") {
          if (!a.name) return { status: "error", content: "name required" };
          setPinned(slug(a.name), true);
          return `pinned '${slug(a.name)}' — protected from auto-retire/consolidation (patches still allowed)`;
        }
        if (a.action === "unpin") {
          if (!a.name) return { status: "error", content: "name required" };
          setPinned(slug(a.name), false);
          return `unpinned '${slug(a.name)}'`;
        }
        if (a.action === "retire") {
          if (!a.name) return { status: "error", content: "name required" };
          const target = retireManagedSkill(slug(a.name), String(a.reason || "retired by muscle-memory"), ctx, a.absorbed_into ? slug(a.absorbed_into) : undefined);
          return `retired '${slug(a.name)}'${a.absorbed_into ? ` (absorbed into ${slug(a.absorbed_into)})` : ""} -> ${target} (reversible quarantine)`;
        }
        if (a.action === "create_from_candidate") {
          const c = findCandidate(a.candidate_key);
          if (!c) return { status: "error", content: "no matching mature candidate — run muscle_memory_skill_read action:candidates first or keep working" };
          const repair = repairForCandidate(c);
          const d = draftWithRepair(c, repair);
          const nm = slug(a.name || d.name);
          const desc = String(a.description || d.description);
          const dc = dedupCheck(nm, desc, dirs);
          if (dc.dup) return { status: "error", content: `anti-bloat blocked: ${dc.reason}. Use action:patch on '${dc.name}' instead.`, candidate: c };
          const lint = lintSkillDraft({ name: nm, description: desc, body: d.body }, { needsPitfalls: !!c.fixes });
          if (!lint.ok) return { status: "error", content: `authoring-linter blocked: ${lint.issues.join("; ")}`, candidate: c };
          const secC = scanSkillContent(d.body); if (!secC.ok) return { status: "error", content: `security blocked: ${secC.issues.join("; ")}`, candidate: c };
          const prov = `\n<!-- ${MM_TAG}: distilled ${new Date().toISOString().slice(0, 10)}; candidate=${c.kind}:${c.key}; reps=${c.count}; convs=${c.convs}; fixes=${c.fixes}; impact=${impactScore(c).score} -->\n`;
          const content = `---\nname: ${nm}\ndescription: ${desc}\n---\n\n${d.body}${prov}\n`;
          const p = writeSkill(dir, nm, content);
          return `created '${nm}' from candidate '${c.key}'${repair ? ` (w/ observed Pitfall: ${repair.errClass})` : ""} -> ${p}\nLoad with muscle_memory_skill_read action:load, then invoke the normal Skill tool with skill="${nm}". Dedup max overlap ${Math.round(dc.overlap * 100)}% (${dc.name || "none"}); lint OK.`;
        }
        if (a.action === "create") {
          if (!a.name || !a.description || !a.body) return { status: "error", content: "need name, description, body" };
          const nm = slug(a.name);
          const dc = dedupCheck(nm, a.description, dirs);
          if (dc.dup) return { status: "error", content: `anti-bloat blocked: ${dc.reason}. Use action:patch on '${dc.name}' instead.` };
          const lint = lintSkillDraft({ name: nm, description: a.description, body: a.body });
          if (!lint.ok) return { status: "error", content: `authoring-linter blocked: ${lint.issues.join("; ")}` };
          const sec0 = scanSkillContent(a.body); if (!sec0.ok) return { status: "error", content: `security blocked: ${sec0.issues.join("; ")}` };
          const prov = `\n<!-- ${MM_TAG}: distilled ${new Date().toISOString().slice(0, 10)} -->\n`;
          const body = a.body.includes(MM_TAG) ? a.body : a.body + prov;
          const content = `---\nname: ${nm}\ndescription: ${a.description}\n---\n\n${body}\n`;
          const p = writeSkill(dir, nm, content);
          return `created '${nm}' -> ${p}\nLoad with muscle_memory_skill_read action:load, then invoke the normal Skill tool with skill="${nm}" when you want to use it. Dedup max overlap ${Math.round(dc.overlap * 100)}% (${dc.name || "none"}).`;
        }
        if (a.action === "patch") {
          if (!a.name || a.old == null || a.replacement == null) return { status: "error", content: "need name, old, replacement" };
          const d = findSkillDir(a.name);
          if (!d) return { status: "error", content: `no skill '${a.name}'` };
          const t = readSkill(d, a.name);
          if (!t.includes(a.old)) return { status: "error", content: "old text not found in skill" };
          const nt = t.replace(a.old, a.replacement);
          const secP = scanSkillContent(nt); if (!secP.ok) return { status: "error", content: `security blocked: ${secP.issues.join("; ")}` };
          writeSkill(d, a.name, nt); // pinned skills allow patch (Hermes: pin guards delete, not edit)
          return `patched '${a.name}' in ${d}`;
        }
        if (a.action === "edit_full") {
          if (!a.name || !a.body) return { status: "error", content: "need name, body (full SKILL.md)" };
          const d = findSkillDir(a.name); if (!d) return { status: "error", content: `no skill '${a.name}'` };
          const desc = (a.body.match(/description:\s*(.+)/)?.[1] || a.description || "").trim();
          const lint = lintSkillDraft({ name: slug(a.name), description: desc, body: a.body }); if (!lint.ok) return { status: "error", content: `linter blocked: ${lint.issues.join("; ")}` };
          const sec = scanSkillContent(a.body); if (!sec.ok) return { status: "error", content: `security blocked: ${sec.issues.join("; ")}` };
          writeSkill(d, a.name, a.body.includes(MM_TAG) ? a.body : a.body + `\n<!-- ${MM_TAG}: edited ${new Date().toISOString().slice(0, 10)} -->\n`);
          return `full-rewrote '${a.name}'`;
        }
        if (a.action === "write_file") {
          if (!a.name || !a.file_path || a.file_content == null) return { status: "error", content: "need name, file_path, file_content" };
          const full = writeSupportFile(slug(a.name), String(a.file_path), String(a.file_content), ctx);
          return `wrote support file ${a.file_path} -> ${full}`;
        }
        if (a.action === "remove_file") {
          if (!a.name || !a.file_path) return { status: "error", content: "need name, file_path" };
          const grave = removeSupportFile(slug(a.name), String(a.file_path), ctx);
          return `removed ${a.file_path} (reversible quarantine -> ${grave})`;
        }
        if (a.action === "restore") {
          if (!a.name) return { status: "error", content: "name required" };
          const p = restoreManagedSkill(slug(a.name), ctx);
          return `restored '${slug(a.name)}' -> ${p}`;
        }
        return { status: "error", content: "unknown write action" };
      } catch (e: any) {
        return { status: "error", content: String(e?.message ?? e) };
      }
    };

    const lifecycleParams = {
      type: "object",
      properties: {
        action: { type: "string", enum: ["reflect", "graduate", "publish", "prune"], description: "Safe no-approval lifecycle action" },
        mode: { type: "string", enum: ["staged", "auto"], description: "reflect mode; staged still auto-graduates trusted updates/high-confidence creates" },
        name: { type: "string", description: "staged skill name — for graduate" }
      },
      required: ["action"]
    };

    const lifecycleRun = async (ctx: any) => {
      const a = ctx?.args || {};
      try {
        if (a.action === "reflect") {
          const r = await runReflectiveReview(ctx, { mode: a.mode === "auto" ? "auto" : "staged" });
          if (r.action === "none" || r.action === "reject") return `reflect: ${r.action} — ${r.reason || ""}`;
          const graduated = !!r.wrote && !String(r.wrote).startsWith(STAGED_DIR);
          return `reflect: ${r.action} skill "${r.name}"${r.updateTarget ? ` (updated existing — anti-bloat)` : ""}${graduated ? " (graduated)" : ""} → ${r.wrote || "(write failed)"}`;
        }
        if (a.action === "graduate") {
          if (!a.name) return { status: "error", content: "name required" };
          const p = graduateStagedSkill(String(a.name), ctx);
          return `graduated '${slug(a.name)}' -> ${p}`;
        }
        if (a.action === "publish") {
          if (!a.name) return { status: "error", content: "name required" };
          const p = publishSkillToCatalog(String(a.name), ctx);
          return `published '${slug(a.name)}' -> ${p}`;
        }
        if (a.action === "prune") {
          const r = runAutonomousPrune(ctx, { maxRetire: 1 });
          return `prune: retired ${r.retired.length} ${JSON.stringify(r.retired)}, flagged ${r.flagged.length}, kept ${r.kept.length}`;
        }
        return { status: "error", content: "unknown lifecycle action" };
      } catch (e: any) {
        return { status: "error", content: String(e?.message ?? e) };
      }
    };

    disposers.push(letta.tools.register({
      name: "muscle_memory_skill_read",
      description: "muscle-memory = self-improving skills distilled from your own work. Read-only inspection (no approval, no writes). START HERE with action:reflect_plan — it previews the class-level skill it would distill from your cross-session history + the update-first routing (which existing skill it would create or patch). Also: coverage (skill-gap map), candidates/registry/curate (what it has observed + manages), list/load (inspect a managed skill). Run before any write.",
      parameters: readParams,
      requiresApproval: false,
      async run(ctx: any) { return readRun(ctx); },
    }));

    disposers.push(letta.tools.register({
      name: "muscle_memory_skill_write",
      description: "muscle-memory writes (approval-gated, reversible). THE CORE LOOP: action:reflect distills a class-level skill from your cross-conversation work → update-first anti-bloat, security/lint-gated, staged by default. graduate promotes a staged skill to your active skill shelf. Plus create/patch/edit_full/retire/restore/pin lifecycle + write_file for support files. Preview first with reflect_plan (the read tool). For no-approval reflect/graduate/publish/prune, use muscle_memory_lifecycle_run.",
      parameters: writeParams,
      requiresApproval: true,
      async run(ctx: any) { return writeRun(ctx); },
    }));

    disposers.push(letta.tools.register({
      name: "muscle_memory_lifecycle_run",
      description: "muscle-memory autonomous lifecycle (no-approval, safe, reversible): reflect (distill a skill from your work), graduate (promote a staged skill → active shelf), publish (mirror a skill → shared Custom Skills catalog), prune (retire stale/unused skills). This is the full self-improvement loop. Broad/manual skill edits → muscle_memory_skill_write; preview → reflect_plan in muscle_memory_skill_read.",
      parameters: lifecycleParams,
      requiresApproval: false,
      async run(ctx: any) { return lifecycleRun(ctx); },
    }));
  }

  return () => { for (const d of disposers.reverse()) d(); };
}
