import { Database } from "bun:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { History, PhaseMemory, TransitionCache, composeSkills, nextStep, procedure, type Skill, type Uncertainty } from "./mechanisms.ts";
import { migrate } from "../../src/state/migrate.ts";
import { addNote, searchNotes } from "../../src/memory/notes.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { GateService } from "../../src/core/gate.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";

const git=(...args:string[])=> {
  const p=Bun.spawnSync(["git",...args]);
  if(p.exitCode) throw new Error(p.stderr.toString());
  return p.stdout.toString().trim();
};
const root=realpathSync(git("rev-parse","--show-toplevel"));
const args=process.argv.slice(2);
const opt=(name:string)=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const selected=(opt("--only")??"A,B,C,D,E,F,G,H,I,J").split(",");
if(selected.some(id=>!"ABCDEFGHIJ".includes(id)||id.length!==1)) throw new Error("unknown experiment");
const evidence=join(root,"docs/evidence/2026-fast-spike");
const out=resolve(root,opt("--out")??`docs/evidence/2026-fast-spike/run-${Date.now()}`);
if(!out.startsWith(evidence+"/") || existsSync(out) || realpathSync(resolve(out,".."))!==realpathSync(evidence)) throw new Error("new direct evidence child directory required");
mkdirSync(out);
const temporary=mkdtempSync(join(tmpdir(),"keli-research-2026-"));
process.env.KELI_STATE_DIR=temporary;
const trace:object[]=[];
const results:Record<string,unknown>[]=[];
let experiment="", checks=0, passed=0, started=0;
const emit=(kind:string,data:unknown)=>trace.push({seq:trace.length+1,experiment,kind,data});
function check(name:string,actual:unknown,expected:unknown) {
  const ok=JSON.stringify(actual)===JSON.stringify(expected);
  checks++;if(ok)passed++;
  emit("assertion",{name,actual,expected,ok});
}
function begin(id:string) { experiment=id;checks=0;passed=0;started=performance.now(); }
function end(details:Record<string,unknown>) {
  results.push({experiment,checks,passed,contract_pass:checks===passed,wall_clock_ms:performance.now()-started,
    metrics:{task_success:null,verified_success:null,false_completion_rate:null,repeated_action_rate:null,
      repeated_failed_hypothesis_rate:null,replans:null,useful_replans:null,tool_calls:null,tokens:null,
      context_growth_bytes:null,retrieval_precision:null,retrieval_recall:null,memory_write_volume:null,
      memory_usefulness:null,stale_memory_usage:null,human_intervention_requirement:null},
    null_reason:"No model episode; experiment-specific measured metrics follow. Contract assertions are not agent success.",...details});
}
function keli(name:string) {
  const db=new Database(join(temporary,name+".sqlite"));migrate(db);
  createOwner(db,"owner");createProject(db,"rocket","owner","Rocket",[join(temporary,"rocket")]);
  createProject(db,"other","owner","Other",[join(temporary,"other")]);
  const behavior=new BehaviorService(db,"owner");
  return {db,behavior,gate:new GateService(db,behavior),scope:projectScope("rocket")};
}
function command(cwd:string,argv:string[]) {
  const p=Bun.spawnSync(argv,{cwd,env:{PATH:process.env.PATH!,KELI_STATE_DIR:temporary}});
  const result={argv,cwd:relative(temporary,cwd),exit:p.exitCode,stdout:p.stdout.toString(),stderr:p.stderr.toString()};
  emit("execution",result);return result;
}
try {
if(selected.includes("A")) {
  begin("A");const file=join(temporary,"history.sqlite");let h=new History(file);
  const original="release nonce: KELI-EXACT-0219; receipt 000012.3400; owner gate.ts";
  const first=h.append({scope:"rocket",session:"long",tick:1,text:original});
  const texts=[original];
  for(let i=2;i<=250;i++){const text=`step ${i}: ${"diagnostic log ".repeat(30)}`;texts.push(text);h.append({scope:"rocket",session:"long",tick:i,text});}
  h.bind("rocket","releaseReceipt","000012.3400",first);
  const view=h.project("rocket",1024);emit("input_history",texts);emit("projection",view);
  check("projection bounded",Buffer.byteLength(view)<=1024,true);
  check("tail evicts exact receipt",texts.slice(-10).join("\n").includes("000012.3400"),false);
  check("update rejected",h.mutationRejected(`UPDATE events SET text='poison' WHERE seq=${first}`),true);
  check("delete rejected",h.mutationRejected(`DELETE FROM events WHERE seq=${first}`),true);
  h.close();h=new History(file);
  check("exact restart recovery",h.expand(first,"rocket")?.text,original);
  check("cross scope denied",h.expand(first,"other"),null);
  check("typed state survived",h.project("rocket",1024),view);
  h.close();end({full_history_bytes:Buffer.byteLength(texts.join("\n")),projected_bytes:Buffer.byteLength(view),
    exact_recovery:{full_transcript:true,tail:false,projection_expand:true},event_writes:250,derived_writes:1,
    limitation:"Typed projection and SQLite restart only; no crash/power-loss test, Python kernel or LLM eviction policy."});
}
if(selected.includes("B")) {
  begin("B");const {db,scope}=keli("notes");const h=new History(join(temporary,"search.sqlite"));
  const inputs=[
    {session:"old",tick:10,text:"release marker is OLD-111"},
    {session:"current",tick:100,text:"release decision recorded here"},
    {session:"other",tick:101,text:"unrelated interleaved session"},
    {session:"current",tick:102,text:"marker is NEW-222"},
    {session:"followup",tick:110,text:"release approval ticket Q-123"},
    {session:"far",tick:120,text:"deploy details start"},
    ...Array.from({length:8},(_,i)=>({session:"far",tick:121+i,text:"unrelated detail "+i})),
    {session:"far",tick:130,text:"secretword ZEBRA"},
    {session:"prefs",tick:140,text:"shell execution requires workspace ownership"},
  ];
  inputs.forEach((e,i)=>{h.append({...e,scope});addNote(db,{id:String(i),scope,title:"raw turn",body:e.text,createdAt:String(e.tick)});});
  h.append({scope:"foreign",session:"current",tick:102,text:"release marker LEAK"});
  emit("corpus",inputs);
  const baseline=searchNotes(db,scope,"release",1);emit("keli_fts",baseline);
  const controlled=h.search("release",{scope,after:90,before:105,window:1,limit:1,fusion:true});emit("controlled",controlled);
  check("expanded answer recovered",controlled.some(e=>e.text.includes("NEW-222")),true);
  check("strict scope",controlled.every(e=>e.scope===scope),true);
  check("strict time",controlled.every(e=>e.tick>=90&&e.tick<=105),true);
  check("session boundary expansion",controlled.some(e=>e.session==="other"),false);
  const baseRecall=baseline.some(e=>e.body.includes("NEW-222"))?1:0;
  check("positive recall improves",baseRecall,0);
  const seen=new Set(controlled.map(e=>e.session));
  const next=h.search("release",{scope,after:90,exclude:[...seen],limit:1,fusion:true});emit("second_search",next);
  check("exclude inspected sessions",next.some(e=>seen.has(e.session)),false);
  check("next session found",next.some(e=>e.text.includes("Q-123")),true);
  const noOverlap=h.search("run compiler",{scope});emit("paraphrase_failure",noOverlap);
  check("lexical blind spot remains",noOverlap.length,0);
  const firstFar=h.search("deploy",{scope,window:1});
  const blind=h.search("ZEBRA",{scope,exclude:firstFar.map(e=>e.session)});
  const recovery=h.search("ZEBRA",{scope});
  emit("premature_exclusion",{firstFar,blind,recovery});
  check("exclude can hide needed same-session evidence",blind.length,0);
  check("without exclude evidence exists",recovery.length,1);
  const variants=[false,true].map(fusion=>({fusion,seqs:h.search("release",{scope,limit:2,fusion}).map(e=>e.seq)}));emit("fusion_ablation",variants);
  end({positive_target_recall:{keli_notes:baseRecall,controlled:1},controlled_precision:1/controlled.length,
    retrieval_calls:8,adversarial_failures:["paraphrase","premature seen-session exclusion"],
    limitation:"One positive retrieval target; fixed scripted controller. No measured RRF quality gain; no reference agents launched."});
  h.close();db.close();
}
if(selected.includes("C")) {
  begin("C");const m=new PhaseMemory();let replans=0;
  for(let i=0;i<5;i++) {
    const replan=m.shouldReplan("test",1,"npm test");
    if(replan){replans++;emit("replan",{from:"npm test",to:"inspect package manifest"});break;}
    const episode={phase:"test",revision:1,action:"npm test",outcome:"missing script",transient:false};m.record(episode);emit("episode",episode);
  }
  check("stuck after two deterministic failures",replans,1);
  check("revision change permits retry",m.shouldReplan("test",2,"npm test"),false);
  check("different phase does not inherit trap",m.shouldReplan("implement",1,"npm test"),false);
  for(let i=0;i<2;i++)m.record({phase:"fetch",revision:1,action:"read",outcome:"timeout",transient:true});
  check("transient retries not blocked",m.shouldReplan("fetch",1,"read"),false);
  emit("episodes",m.episodes);
  end({deterministic_failures:{fixed_retry:5,phase_memory:2},repeated_failures:{fixed_retry:4,phase_memory:1},replans:1,
    useful_replans:null,limitation:"Replan emits an inspection proposal; no model repair or successful replacement hypothesis measured."});
}
if(selected.includes("D")) {
  begin("D");const {db,behavior,scope}=keli("routing");
  behavior.reviseCodingDelegate("Rocket","Codex",{actor:"owner",text:"Rocket changes use Codex",source:"user-correction",trusted:true});
  addNote(db,{id:"constraint",scope,title:"delegate",body:"Rocket changes use Codex"});
  const lexical=searchNotes(db,scope,"compiler",5);
  const first=behavior.requireRule(scope,"coding.delegate");
  behavior.reviseCodingDelegate("Rocket","OpenCode",{actor:"owner",text:"Rocket changes use OpenCode",source:"user-correction",trusted:true});
  const current=behavior.requireRule(scope,"coding.delegate");
  emit("routing",{query:"fix the compiler",lexical,first,current});
  check("lexical miss",lexical.length,0);
  check("current authority routed",current.value,"OpenCode");
  check("stale snapshot differs",first.revision<current.revision,true);
  check("other scope no ambient rule",behavior.getRule(projectScope("other"),"coding.delegate"),null);
  check("small rule projection",Buffer.byteLength(JSON.stringify(current))<=1024,true);
  end({query_only_target_recall:0,authoritative_projection_target_recall:1,stale_cache_would_use:first.value,
    projected_bytes:Buffer.byteLength(JSON.stringify(current)),limitation:"Keli-native policy constraint, not an InMind world-knowledge reasoning evaluation."});db.close();
}
if(selected.includes("E")) {
  begin("E");const c=new TransitionCache();
  c.record({scope:"repo-a",action:"test",predicted:"npm",actual:"bun",confidence:.95,transient:false});
  check("one sample not a rule",c.predict("repo-a","test"),null);
  c.record({scope:"repo-a",action:"test",predicted:"npm",actual:"bun",confidence:.95,transient:false});
  check("repeated transition reusable",c.predict("repo-a","test"),"bun");
  check("other repo not poisoned",c.predict("repo-b","test"),null);
  for(let i=0;i<2;i++)c.record({scope:"repo-b",action:"fetch",predicted:"ok",actual:"timeout",confidence:.99,transient:true});
  check("transient not generalized",c.predict("repo-b","fetch"),null);
  c.record({scope:"repo-a",action:"test",predicted:"bun",actual:"npm",confidence:.9,transient:false});
  check("contradiction invalidates prediction",c.predict("repo-a","test"),null);
  emit("transitions",c.observations);
  end({cache_hits_before_conflict:1,scope_leaks:0,limitation:"Fixed transition cache; no model-generated predictions, semantic distillation or real task gain."});
}
if(selected.includes("F")) {
  begin("F");const repo=join(temporary,"map");mkdirSync(repo);
  writeFileSync(join(repo,"package.json"),JSON.stringify({scripts:{"test:integration":"bun integration.ts"}}));
  writeFileSync(join(repo,"integration.ts"),'console.log("integration passed");\n');
  const blind=command(repo,[process.execPath,"run","test"]);
  const inspected=JSON.parse(readFileSync(join(repo,"package.json"),"utf8"));emit("manifest_read",inspected);
  const valid=command(repo,[process.execPath,"run","test:integration"]);
  check("misleading command fails",blind.exit!==0,true);check("manifest command works",valid.exit,0);
  // Call accounting models repeated stateless task discovery, not an LLM rollout.
  const counts=[1,5].map(tasks=>({tasks,blind_calls:2*tasks,mapped_calls:1+tasks}));
  const easy={blind_calls:1,mapped_calls:2};emit("call_accounting",{counts,easy});
  check("long task amortizes",counts[1]!.mapped_calls<counts[1]!.blind_calls,true);
  check("easy task mapping adds call",easy.mapped_calls>easy.blind_calls,true);
  end({actual_process_calls:2,analytical_calls:counts,easy_task_calls:easy,limitation:"Only one real wrong/right command pair. Amortization counts are analytical, not timed repeated agent tasks."});
}
if(selected.includes("G")) {
  begin("G");const s={scope:"rocket",verified:false,repeated:false,revision:1};
  check("advisory allows false finish",procedure(s,"finish",false),"finish");
  check("hook requests verification",procedure(s,"finish",true),"verify");
  check("valid completion passes",procedure({...s,verified:true},"finish",true),"finish");
  check("repeated failure replans",procedure({...s,repeated:true},"retry",true),"replan");
  check("unrelated action unchanged",procedure(s,"inspect",true),"inspect");
  const proposal=procedure(s,"finish",true);check("no hook loop",procedure(s,proposal,true),proposal);
  emit("hook_state",s);
  end({limitation:"Fixed typed hook; exactly equivalent to ordinary predicates. No evidence justifying a general executable skill runtime."});
}
if(selected.includes("H")) {
  begin("H");const lib:Skill[]=[{id:"verify",needs:["build"],bytes:100,valid:true},{id:"build",needs:["inspect"],bytes:100,valid:true},
    {id:"inspect",needs:[],bytes:80,valid:true},...Array.from({length:12},(_,i)=>({id:`distract-${i}`,needs:[],bytes:150,valid:true})),
    {id:"outdated",needs:[],bytes:10,valid:false}];
  const arms={none:[],top_k:["verify","distract-0","distract-1"],dynamic:["verify"],ordered:composeSkills(["verify"],lib,300)};
  emit("library",lib);emit("arms",arms);
  check("dependency order",arms.ordered,["inspect","build","verify"]);
  const throws=(f:()=>unknown)=>{try{f();return false;}catch{return true;}};
  check("reject outdated",throws(()=>composeSkills(["outdated"],lib,300)),true);
  check("budget cannot omit prerequisites silently",throws(()=>composeSkills(["verify"],lib,200)),true);
  check("cycle rejected",throws(()=>composeSkills(["a"],[{id:"a",needs:["b"],bytes:1,valid:true},{id:"b",needs:["a"],bytes:1,valid:true}],10)),true);
  check("deduplicate",composeSkills(["inspect","verify"],lib,300),["inspect","build","verify"]);
  end({rendered_bytes:{none:0,top_k:400,dynamic:100,ordered:280},limitation:"Hand-authored dependency metadata and selected IDs; no learned selection or measured downstream task success."});
}
if(selected.includes("I")) {
  begin("I");const base:Uncertainty={task:"known",world:"known",hypothesis:"supported",evidence:"known",tool:"complete",plan:"progress",completion:"verified"};
  const cases:[Partial<Uncertainty>,string][]=[[{task:"missing"},"clarify"],[{task:"ambiguous"},"clarify"],[{world:"unknown"},"inspect"],
    [{hypothesis:"conflicting"},"discriminating_test"],[{evidence:"missing"},"retrieve"],[{tool:"partial"},"reconcile"],[{plan:"stuck"},"replan"],
    [{completion:"unverified"},"verify"],[{},"finish"]];
  for(const [delta,expected]of cases){const input={...base,...delta};const actual=nextStep(input);emit("policy",{input,actual});check("typed next step",actual,expected);}
  end({scripted_cases:9,required_clarifications:2,limitation:"Uncertainty labels supplied by fixture. No calibration, trajectory estimator or advantage over simple evidence checks established."});
}
if(selected.includes("J")) {
  begin("J");const {db,behavior,gate,scope}=keli("verification");
  behavior.reviseCodingDelegate("Rocket","Codex",{actor:"owner",text:"Rocket changes use Codex",source:"user-correction",trusted:true});
  const req=gate.prepare("Implement fix and verify it",scope,"coding.delegate");
  const action=gate.finish(req.id,{id:req.id,scope,key:req.key,revision:req.revision,delegate:"Codex"}) as {status:string};
  emit("keli_gate_proposal_only",{request:req,action,artifact_exists:false,tests_executed:false});
  check("baseline accepts proposal without artifact as executed",action.status,"executed");
  const cases=["absent","partial","focused-only","stale","dirty","complete"];
  const verdicts:{name:string; claimed_complete:boolean; focused_pass:boolean; integration_pass:boolean; fresh:boolean; unexpected:boolean; verified:boolean; expected:boolean}[]=[];
  for(const name of cases){
    const repo=join(temporary,"verify-"+name);mkdirSync(repo);
    command(repo,["git","init","-q"]);
    const expected='export const add = (a:number,b:number) => a+b;\n';
    const source=name==="partial"?'export const add = (a:number,b:number) => a-b;\n':name==="focused-only"?'export const add = (a:number,b:number) => b===0 ? a : 0;\n':expected;
    if(name!=="absent")writeFileSync(join(repo,"math.ts"),source);
    if(name==="dirty")writeFileSync(join(repo,"unrequested.txt"),"unexpected change");
    writeFileSync(join(repo,"focused.ts"),'import {add} from "./math.ts"; if(add(4,0)!==4) process.exit(1);\n');
    writeFileSync(join(repo,"integration.ts"),'import {add} from "./math.ts"; if(add(4,3)!==7 || add(-4,3)!==-1) process.exit(1);\n');
    const hash=createHash("sha256").update(source).digest("hex");
    writeFileSync(join(repo,"generated.json"),JSON.stringify({source_sha256:name==="stale"?"old":hash}));
    emit("fixture_files",{name,source:name==="absent"?null:source,focused:readFileSync(join(repo,"focused.ts"),"utf8"),
      integration:readFileSync(join(repo,"integration.ts"),"utf8"),generated:readFileSync(join(repo,"generated.json"),"utf8")});
    const focused=command(repo,[process.execPath,"run","focused.ts"]);
    const integrated=command(repo,[process.execPath,"run","integration.ts"]);
    const status=command(repo,["git","status","--short","--untracked-files=all"]);
    const allowed=new Set(["math.ts","focused.ts","integration.ts","generated.json"]);
    const unexpected=status.stdout.trim().split("\n").filter(Boolean).some(line=>!allowed.has(line.slice(3)));
    const fresh=JSON.parse(readFileSync(join(repo,"generated.json"),"utf8")).source_sha256===hash;
    const verified=existsSync(join(repo,"math.ts"))&&focused.exit===0&&integrated.exit===0&&fresh&&!unexpected;
    const expectedVerdict=name==="complete";
    check("independent verifier "+name,verified,expectedVerdict);
    if(name==="focused-only")check("focused test alone misleading",focused.exit===0&&integrated.exit!==0,true);
    verdicts.push({name,claimed_complete:true,focused_pass:focused.exit===0,integration_pass:integrated.exit===0,fresh,unexpected,verified,expected:expectedVerdict});
  }
  emit("verdicts",verdicts);
  end({verdicts,claim_only_false_completions:verdicts.filter(v=>v.claimed_complete&&!v.expected).length,
    independent_false_completions:verdicts.filter(v=>v.verified&&!v.expected).length,total_claims:verdicts.length,
    baseline_proposal_only_status:action.status,limitation:"Real subprocess checks in generated fixture repositories. Does not fix GateService or establish general verifier completeness."});db.close();
}
} catch(error) { emit("fatal",String(error));process.exitCode=1; }
finally {
  const files=["mechanisms.ts","run.ts"].map(name=>({path:`experiments/2026-fast-spike/${name}`,sha256:createHash("sha256").update(readFileSync(join(import.meta.dir,name))).digest("hex")}));
  writeFileSync(join(out,"trace.jsonl"),trace.map(row=>JSON.stringify(row)).join("\n")+"\n");
  const summary={schema_version:1,kind:"deterministic_mechanism_spike",baseline:"40743b53fa884a2eec00bfdf5aebc432f97967fa",head:git("rev-parse","HEAD"),
    branch:git("branch","--show-current"),runtime:Bun.version,created_at:new Date().toISOString(),selected,source_files:files,results,
    passed:results.length===selected.length&&results.every(r=>r.contract_pass)&&!process.exitCode};
  writeFileSync(join(out,"summary.json"),JSON.stringify(summary,null,2)+"\n");
  rmSync(temporary,{recursive:true,force:true});
  console.log(JSON.stringify({out:relative(root,out),passed:summary.passed,experiments:results.map(r=>({id:r.experiment,checks:r.checks,passed:r.passed}))},null,2));
  if(!summary.passed)process.exitCode=1;
}
