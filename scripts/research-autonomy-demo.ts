/** Paired, scripted-provider demonstration. Argument is an isolated Keli source tree. */
import { Database } from "bun:sqlite";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve(process.argv[2] ?? ".");
const load = (file: string) => import(join(root, "src", file));
const { defaultRegistry } = await load("capabilities/registry.ts");
const { ConversationLoop } = await load("conversation/loop.ts");
const { BehaviorService } = await load("core/behavior.ts");
const { CapabilityGate } = await load("core/capability-gate.ts");
const { migrate } = await load("state/migrate.ts");
const { createOwner, createProject } = await load("state/repos.ts");
const { indexCollection } = await load("sources/index.ts");
const { createSourceReader } = await load("sources/reader.ts");
const { upsertWatch } = await load("watches/store.ts");
const { tickWatches } = await load("watches/heartbeat.ts");
const read = (id: string) => ({ type: "tool_call", capability: "sources.read", input: { sourceId: id } });
const answer = { type: "answer", text: "A conditional thesis", citations: [{ sourceId: "cava:a.md", quote: "A conditional thesis" }], attributions: [{ subject: "Cava", claim: "A conditional thesis", sourceIds: ["cava:a.md"] }] };
const results: Record<string, unknown> = {};
for (const scenario of ["dependency_recovery", "quiet_thesis", "unsupported_completion"]) {
  const dir = await mkdtemp(join(tmpdir(), "keli-paired-demo-"));
  const db = new Database(join(dir, "state.sqlite"));
  try {
    migrate(db); createOwner(db, "owner"); createProject(db, "p", "owner", "research", [dir]);
    const behavior = new BehaviorService(db, "owner"), sources = createSourceReader(db);
    async function source(c: string, name: string, body: string) { const path = join(dir,c); await mkdir(path, { recursive: true }); await writeFile(join(path,name),body); await indexCollection(db,{ id:c,path }); }
    await source("cava", "a.md", "A conditional thesis");
    const { watch } = upsertWatch(db, { ownerId: "owner", scope: "project:p", status: "active", definition: { name: "demo", kind: "source-collection", trigger: { schedule: "every:1s", target: "cava" }, evidence: { autonomy: true, question: "Track supported findings", requiredCollections: scenario === "dependency_recovery" ? ["shaul"] : ["cava"] } } });
    let calls = 0, notifications = 0, time = Date.parse("2026-09-15T00:00:00Z");
    const timeline: unknown[] = [];
    async function tick(steps: unknown[]) {
      let cursor = 0; const before = calls, beforeNotify = notifications;
      const provider = { complete: async () => { calls++; const decision = steps[cursor++]; return decision ? { content: JSON.stringify(decision), usage: { reportedIn:100, reportedOut:20 } } : { content:"", error:"script exhausted" }; } };
      const loop = new ConversationLoop({ db, behavior, registry: defaultRegistry, capabilityGate: new CapabilityGate(db,defaultRegistry,dir,"owner"), policy:{readableRoots:[dir],writableRoots:[dir]}, sources, model: async () => ({provider,providerId:"scripted",costKnown:false}), options:{retryBaseMs:0} });
      const result = await tickWatches(db,{ownerId:"owner",stateDir:dir,behavior,loop,sources,notify:async()=>{notifications++;}}, new Date(time+=2000));
      timeline.push({ modelCalls:calls-before, notifications:notifications-beforeNotify, outcome:result.outcomes[0]?.outcomeKind ?? result.outcomes[0]?.result });
    }
    if (scenario === "dependency_recovery") {
      await tick([read("cava:a.md"), {type:"missing_evidence",text:"Shaul is absent",needed:["shaul"]}]);
      await tick([]);
      await source("shaul","s.md","Shaul disagrees.");
      await tick([read("cava:a.md"),read("shaul:s.md"),{...answer,citations:[...answer.citations,{sourceId:"shaul:s.md",quote:"Shaul disagrees."}],attributions:[...answer.attributions,{subject:"Shaul",claim:"disagrees",sourceIds:["shaul:s.md"]}]}]);
    } else if (scenario === "quiet_thesis") {
      await tick([read("cava:a.md"),answer]); await tick([]);
      await source("cava","noise.md","Subscribe to the channel"); await tick([read("cava:a.md"),answer]);
    } else {
      await tick([{type:"tool_call",capability:"sources.search",input:{collection:"cava",query:"conditional"}},answer,answer]);
    }
    const hasOccurrences = db.query("SELECT name FROM sqlite_master WHERE name='watch_occurrences'").get();
    const occurrences = hasOccurrences ? db.query("SELECT status,run_id,generation FROM watch_occurrences WHERE watch_id=? ORDER BY rowid").all(watch.id) : [];
    const observations = db.query("SELECT id,run_id,kind FROM conversation_turns WHERE kind='tool_result' ORDER BY rowid").all();
    results[scenario] = { timeline, modelCalls:calls, notifications, occurrences, observations, steeringTurnsAfterApproval:0 };
  } finally { db.close(); await rm(dir,{recursive:true,force:true}); }
}
console.log(JSON.stringify({provider:"scripted; real loop, gate, index, SQLite and heartbeat",results},null,2));
