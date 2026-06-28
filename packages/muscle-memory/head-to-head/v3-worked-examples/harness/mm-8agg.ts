import { writeFileSync, mkdirSync } from "node:fs";
import { __mm } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
import type { Row } from "/Users/adrianchan/projects/letta-local-mods/.worktrees/mm-v4-ace/packages/muscle-memory/mods/index.ts";
const { classifyError, redactFragment, buildCrossConversationEvidence, reviewAndAuthor } = __mm;
const KEY = process.env.ZAI_KEY ?? ""; const BASE = "https://api.z.ai/api/coding/paas/v4";
function content(d: unknown): string { if (!d||typeof d!=="object"||!("choices" in d)) return ""; const ch=d.choices; if(!Array.isArray(ch)||!ch.length) return ""; const f:unknown=ch[0]; if(!f||typeof f!=="object"||!("message" in f)) return ""; const m=f.message; if(!m||typeof m!=="object"||!("content" in m)) return ""; const c=m.content; return typeof c==="string"?c:""; }
async function author(s: string, u: string): Promise<string> { const r=await fetch(`${BASE}/chat/completions`,{method:"POST",headers:{Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"glm-5.2",messages:[{role:"system",content:s},{role:"user",content:u}],temperature:0,max_tokens:4000})}); return content(await r.json()); }
let ts=1_700_000_000_000;
function fail(c:string,e:string):Row{ts+=1000;return{conv:c,tool:"Bash",tmpl:"pytest -q",fp:"Bash::pytest -q",h:`f${ts}`,ok:false,err:classifyError(e,false),errMsg:redactFragment(e,8,320),ts};}
function edit(c:string,o:string,n:string):Row{ts+=1000;return{conv:c,tool:"Edit",tmpl:"Edit <path>.py",fp:`Edit::${c}`,h:`e${ts}`,ok:true,fix:`- ${redactFragment(o,6,200)}\n+ ${redactFragment(n,6,200)}`,ts};}
function pass(c:string):Row{ts+=1000;return{conv:c,tool:"Bash",tmpl:"pytest -q",fp:"Bash::pytest -q",h:`p${ts}`,ok:true,ts};}
const bugs:Array<[string,string,string,string]>=[
 ["c1","AssertionError: assert add(2, 3) == 5, got -1","return a - b","return a + b"],
 ["c2","IndexError: list index out of range","for i in range(len(xs) + 1):","for i in range(len(xs)):"],
 ["c3","AssertionError: assert handle(x) == 42, got None","result = compute(x)","return compute(x)"],
 ["c4","AssertionError: assert mode == 'prod', got 'PROD'","mode = raw","mode = raw.lower()"],
 ["c5","KeyError: 'b'","return d[k]","return d.get(k)"],
 ["c6","AssertionError: total(['1','2','3']) == 6, got '123'","return sum(items)","return sum(int(x) for x in items)"],
 ["c7","AssertionError: base == [1], got [1, 2]","xs.append(x); return xs","return xs + [x]"],
 ["c8","AssertionError: cents(1.15) == 115, got 114","return int(d * 100)","return round(d * 100)"],
];
const rows:Row[]=bugs.flatMap(([c,e,o,n])=>[fail(c,e),edit(c,o,n),pass(c)]);
const STATE=process.env.MM_STATE_DIR as string; mkdirSync(STATE,{recursive:true});
writeFileSync(`${STATE}/experience.jsonl`,rows.map(r=>JSON.stringify(r)).join("\n")+"\n");
const ev=buildCrossConversationEvidence(rows);
const res=await reviewAndAuthor(ev.digest,["/tmp/h2h/mm-empty-skills"],author);
console.log("action:",res.action,res.reason??"");
if(res.content){writeFileSync("/tmp/h2h/mm-skills/failing-test.8agg.md",res.content);console.log("bytes:",res.content.length);}
