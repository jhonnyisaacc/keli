import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { BehaviorService, ResearchResponsibilityService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { DeliveryRejectedError } from "../../src/transports/outbox.ts";
import { getRun, cancelRun } from "../../src/core/run-control.ts";
import { indexCollection } from "../../src/sources/index.ts";
import { createSourceReader } from "../../src/sources/reader.ts";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject } from "../../src/state/repos.ts";
import { tickWatches, type WatchNotification } from "../../src/watches/heartbeat.ts";
import { getWatch, upsertWatch, setWatchStatus } from "../../src/watches/store.ts";
import { listResearchOccurrences } from "../../src/watches/occurrences.ts";
import { idleReport } from "../../src/update/policy.ts";
import { ScriptedChatModel, scriptedFactory, type ScriptedStep } from "../fixtures/scripted-model.ts";
import type { WatchDefinition } from "../../src/watches/types.ts";

let dir: string, db: Database, behavior: BehaviorService, gate: CapabilityGate;
let clock: number;
const scope = "project:p";
const read = (id: string): ScriptedStep => ({ type: "tool_call", capability: "sources.read", input: { sourceId: id } });
const answer = (claim = "A conditional thesis", id = "cava:a.md", quote = "A conditional thesis"): ScriptedStep => ({
  type: "answer", text: claim, citations: [{ sourceId: id, quote }], attributions: [{ subject: "Cava", claim, sourceIds: [id] }],
});
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "keli-autonomy-"));
  db = new Database(join(dir, "state.sqlite")); migrate(db);
  createOwner(db, "owner"); createProject(db, "p", "owner", "research", [dir]);
  behavior = new BehaviorService(db, "owner"); gate = new CapabilityGate(db, defaultRegistry, dir, "owner");
  clock = Date.parse("2026-09-15T00:00:00Z");
});
afterEach(async () => { db.close(); await rm(dir, { recursive: true, force: true }); });
async function source(collection: string, name: string, text: string) {
  const path = join(dir, collection); await mkdir(path, { recursive: true }); await writeFile(join(path, name), text);
  await indexCollection(db, { id: collection, path });
}
function watch(extra: Partial<WatchDefinition> = {}) {
  return upsertWatch(db, { ownerId: "owner", scope, status: "active", definition: {
    name: "research", kind: "source-collection", trigger: { schedule: "every:1s", target: "cava" },
    evidence: { question: "Track supported thesis changes", autonomy: true }, budget: { requestsMax: 40 },
    ...extra,
  } }).watch;
}
function loop(steps: ScriptedStep[]) {
  const model = new ScriptedChatModel(steps);
  return { model, loop: new ConversationLoop({ db, behavior, capabilityGate: gate, registry: defaultRegistry,
    policy: { readableRoots: [dir], writableRoots: [dir] }, sources: createSourceReader(db), model: scriptedFactory(model),
    options: { retryBaseMs: 0 },
  }) };
}
async function tick(steps: ScriptedStep[], notify?: (n: WatchNotification) => Promise<void>) {
  const l = loop(steps); clock += 2000;
  const result = await tickWatches(db, { ownerId: "owner", stateDir: dir, behavior, loop: l.loop, sources: createSourceReader(db), notify }, new Date(clock));
  return { ...l, result };
}

describe("evidence-driven research responsibilities", () => {
  test("Augustine/Shaul: discriminating retrieval, durable evidence wait, same-budget resume and scoped correction", async () => {
    await source("augustine", "a.md", "Augustine interprets the passage.");
    const w = watch({ trigger: { schedule: "every:1s", target: "augustine" }, evidence: { question: "Compare Augustine and Shaul", autonomy: true, requiredCollections: ["shaul"], requiredSubjects: ["Augustine", "Shaul"] } });
    const missing: ScriptedStep = { type: "tool_call", capability: "sources.read", input: { sourceId: "augustine:wrong.md" } };
    const first = await tick([missing, missing, read("augustine:a.md"), { type: "missing_evidence", text: "Shaul is absent", needed: ["shaul"] }]);
    expect(first.model.calls.length).toBe(4);
    const o = listResearchOccurrences(db, w.id)[0]!;
    expect(o.status).toBe("waiting_for_evidence");
    expect(getRun(db, o.run_id)!.tool_calls_used).toBe(2); // duplicate wrong read was suppressed
    const spent = getRun(db, o.run_id)!.requests_used!;
    expect((await tick([])).model.calls.length).toBe(0);
    await source("unrelated", "b.md", "Irrelevant new evidence");
    expect((await tick([])).model.calls.length).toBe(0);
    db.close(); db = new Database(join(dir, "state.sqlite")); behavior = new BehaviorService(db, "owner"); gate = new CapabilityGate(db, defaultRegistry, dir, "owner");
    await source("shaul", "s.md", "Shaul disagrees with that interpretation.");
    const second = await tick([read("shaul:s.md"), messages => {
      expect(messages.some(m => m.content.includes("Recovered observation") && m.content.includes("Augustine interprets"))).toBe(true);
      return { type: "answer", text: "Their interpretations differ.", citations: [
        { sourceId: "augustine:a.md", quote: "Augustine interprets the passage." }, { sourceId: "shaul:s.md", quote: "Shaul disagrees with that interpretation." }],
        attributions: [{ subject: "Augustine", claim: "interprets", sourceIds: ["augustine:a.md"] }, { subject: "Shaul", claim: "disagrees", sourceIds: ["shaul:s.md"] }] };
    }]);
    expect(second.result.outcomes[0]!.outcomeKind).toBe("answer");
    const resumed = listResearchOccurrences(db, w.id);
    expect(resumed).toHaveLength(1); expect(resumed[0]!.id).toBe(o.id); expect(resumed[0]!.status).toBe("verified");
    expect(getRun(db, o.run_id)!.requests_used).toBe(spent + 3);
    expect(behavior.listRulesByPrefix("project:finanzas", "research.")).toEqual([]);
  });

  test("Cava: quiet unchanged/irrelevant evidence; changed thesis creates one outbox intent; rejected delivery retries without research", async () => {
    await source("cava", "a.md", "A conditional thesis"); const w = watch();
    let rejected = true, deliveries = 0;
    const notify = async () => { if (rejected) throw new DeliveryRejectedError("not sent"); deliveries++; };
    await tick([read("cava:a.md"), answer()], notify);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
    expect((db.query("SELECT status FROM outbox_messages").get() as any).status).toBe("failed");
    rejected = false;
    expect((await tick([], notify)).model.calls.length).toBe(0); expect(deliveries).toBe(1);
    await source("cava", "noise.md", "Subscribe to the channel");
    await tick([read("cava:a.md"), answer()], notify); expect(deliveries).toBe(1);
    await source("cava", "b.md", "The thesis is invalidated at 6000.");
    await tick([read("cava:b.md"), answer("Invalidated at 6000", "cava:b.md", "The thesis is invalidated at 6000.")], notify);
    expect(deliveries).toBe(2);
    expect((db.query("SELECT COUNT(*) n FROM outbox_messages").get() as any).n).toBe(2);
    expect((await tick([], notify)).model.calls.length).toBe(0);
  });

  test("ambiguous delivery acknowledgement stays unknown and is never blind-retried", async () => {
    await source("cava", "a.md", "A conditional thesis"); watch(); let attempts = 0;
    const notify = async () => { attempts++; throw new Error("connection lost after send"); };
    await tick([read("cava:a.md"), answer()], notify); await tick([], notify);
    expect(attempts).toBe(1); expect((db.query("SELECT status FROM outbox_messages").get() as any).status).toBe("unknown");
  });

  test("out-of-contract sources and search identifiers cannot falsely complete an occurrence", async () => {
    await source("cava", "a.md", "A conditional thesis"); const w = watch();
    await source("private", "secret.md", "PRIVATE_SOURCE_MARKER");
    const attempt = await tick([read("private:secret.md"), { type: "tool_call", capability: "sources.search", input: { query: "conditional", collection: "cava" } }, answer(), answer()]);
    expect(attempt.model.calls.flat().some(m => m.content.includes("PRIVATE_SOURCE_MARKER"))).toBe(false);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("waiting_for_evidence");
    expect((await tick([])).model.calls).toHaveLength(0);
  });

  test("source revision changes invalidate retained passages; next evidence arrival recovers", async () => {
    await source("cava", "a.md", "A conditional thesis"); const w = watch();
    const l = loop([read("cava:a.md"), () => {
      db.run("UPDATE source_documents SET hash='new-revision', body='Different thesis' WHERE id='cava:a.md'"); return answer() as any;
    }, answer()]);
    await tickWatches(db, { ownerId: "owner", stateDir: dir, behavior, loop: l.loop, sources: createSourceReader(db) }, new Date(clock));
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("waiting_for_evidence");
    await tick([read("cava:a.md"), answer("Different thesis", "cava:a.md", "Different thesis")]);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
  });

  test("interruption after observation resumes evidence; concurrent ticks cannot claim a live worker", async () => {
    await source("cava", "a.md", "A conditional thesis"); const w = watch();
    const first = await tick([read("cava:a.md"), () => { throw new Error("simulated process interruption"); }]);
    const o = listResearchOccurrences(db, w.id)[0]!; expect(o.status).toBe("active"); expect(idleReport(db).idle).toBe(false);
    const recovered = await tick([messages => { expect(messages.some(m => m.content.includes("Recovered observation"))).toBe(true); return answer() as any; }]);
    expect(recovered.model.calls.length).toBe(1); expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
    await source("cava", "b.md", "Another input");
    const a = loop([read("cava:a.md"), answer()]), b = loop([]);
    const deps = { ownerId: "owner", stateDir: dir, behavior, sources: createSourceReader(db) };
    await Promise.all([tickWatches(db, { ...deps, loop: a.loop }, new Date(clock + 3000)), tickWatches(db, { ...deps, loop: b.loop }, new Date(clock + 3000))]);
    expect(b.model.calls.length).toBe(0);
    expect(listResearchOccurrences(db, w.id)).toHaveLength(2);
  });

  test("waiting input is scoped, current policy supersedes old work, cancellation blocks the next tool", async () => {
    await source("cava", "a.md", "A conditional thesis"); const w = watch();
    await tick([{ type: "clarify", question: "Which thesis?" }]);
    const service = new ResearchResponsibilityService(db, "owner");
    expect(service.supplyInput(w.id, "project:other", "Use Cava", "x")).toBe(false);
    expect(service.supplyInput(w.id, scope, "Use Cava", "x")).toBe(true);
    expect(service.supplyInput(w.id, scope, "Use Cava", "x")).toBe(false);
    await tick([read("cava:a.md"), answer()]);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
    await source("cava", "b.md", "Another input");
    const result = await tick([() => { setWatchStatus(db, w.id, "paused"); return read("cava:a.md") as any; }]);
    expect(result.result.outcomes[0]!.result).toBe("failed");
    const latest = listResearchOccurrences(db, w.id)[0]!; expect(getRun(db, latest.run_id)!.tool_calls_used).toBe(0);
  });

  test("tool and request budgets survive waiting and cannot refill on resume", async () => {
    await source("cava", "a.md", "A conditional thesis"); const w = watch({ budget: { requestsMax: 2, toolCallsMax: 0 } });
    await tick([{ type: "clarify", question: "Input?" }]);
    const o = listResearchOccurrences(db, w.id)[0]!;
    new ResearchResponsibilityService(db, "owner").supplyInput(w.id, scope, "Cava", "x");
    await tick([read("cava:a.md")]);
    expect(getRun(db, o.run_id)!.requests_used).toBe(2);
    expect(getRun(db, o.run_id)!.tool_calls_used).toBe(0);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("failed");
    expect((await tick([])).model.calls.length).toBe(0);
  });
});

test("a canonical correction between model reply and dispatch supersedes the occurrence without stale action", async () => {
  await source("cava", "a.md", "A conditional thesis"); const w = watch();
  await tick([() => {
    behavior.reviseRule({ scope, key: "research.requiredCollections", value: "shaul" }, { actor: "owner", text: "Also require Shaul", source: "user-correction", trusted: true });
    return read("cava:a.md") as any;
  }]);
  const old = listResearchOccurrences(db,w.id)[0]!;
  expect(getRun(db,old.run_id)!.tool_calls_used).toBe(0);
  await tick([{type:"missing_evidence",text:"Shaul required"}]);
  const rows = listResearchOccurrences(db,w.id);
  expect(rows.find(o=>o.id===old.id)!.status).toBe("cancelled");
  expect(rows[0]!.status).toBe("waiting_for_evidence");
  expect(JSON.parse(rows[0]!.contract_json).policy.requiredCollections).toContain("shaul");
  expect(behavior.listRulesByPrefix("project:finanzas","research.")).toEqual([]);
});

test("explicit cancellation persists and the same input cannot resurrect its budget", async () => {
  await source("cava","a.md","A conditional thesis"); const w=watch();
  await tick([read("cava:a.md"),()=>{ throw new Error("interruption"); }]);
  const o=listResearchOccurrences(db,w.id)[0]!; cancelRun(db,o.run_id);
  await tick([]); await tick([]);
  expect(listResearchOccurrences(db,w.id)[0]!.status).toBe("cancelled");
  expect(getRun(db,o.run_id)!.status).toBe("cancelled");
});

test("Discord input requires configured owner and exact watch route, with durable replay dedupe", async () => {
  const { conversationInboxHandler } = await import("../../src/conversation/inbox-handler.ts");
  const { upsertConversation } = await import("../../src/memory/conversations.ts");
  const w=watch({notify:{policy:"silent",channelId:"channel",threadId:"thread"}});
  await tick([{type:"clarify",question:"Which thesis?"}]);
  const l=loop([]), handler=conversationInboxHandler(db,"owner",l.loop,"discord-owner");
  const conversation=upsertConversation(db,{scope,transport:"discord",externalId:"thread:thread"});
  const message:any={id:"inbox",transport:"discord",dedupeKey:"message-1",payload:{text:`/watch-input ${w.id} Cava`,authorId:"stranger"}};
  const route:any={scope,externalId:"thread:thread",transport:"discord"};
  expect((await handler(message,route,conversation))?.reply).toContain("requires");
  message.payload.authorId="discord-owner";
  expect((await handler(message,{...route,externalId:"other"},conversation))?.reply).toContain("requires");
  expect((await handler(message,route,conversation))?.reply).toContain("Input recorded");
  await tick([{type:"clarify",question:"Need a source too"}]);
  expect((await handler(message,route,conversation))?.reply).toContain("No matching");
  expect(l.model.calls).toHaveLength(0);
});

test("migration 12 preserves existing approved watches and run counters", () => {
  const old = new Database(":memory:");
  try {
    migrate(old,11); createOwner(old,"owner"); createProject(old,"p","owner","research",[]);
    const w=upsertWatch(old,{ownerId:"owner",scope,status:"active",definition:{name:"old",kind:"source-collection",trigger:{schedule:"every:1s",target:"cava"},evidence:{question:"Old watch"}}}).watch;
    migrate(old);
    expect(getWatch(old,w.id)!.status).toBe("active");
    expect(getWatch(old,w.id)!.evidence.autonomy).toBeUndefined();
    expect(old.query("PRAGMA integrity_check").get()).toEqual({integrity_check:"ok"});
  } finally { old.close(); }
});

test("resuming after the trigger collection changes records the consumed revision without a duplicate occurrence", async () => {
  const w=watch();
  await tick([{type:"missing_evidence",text:"No Cava source yet"}]);
  const original=listResearchOccurrences(db,w.id)[0]!;
  await source("cava","a.md","A conditional thesis");
  await tick([read("cava:a.md"),answer()]);
  expect((await tick([])).model.calls).toHaveLength(0);
  expect(listResearchOccurrences(db,w.id)).toHaveLength(1);
  expect(listResearchOccurrences(db,w.id)[0]!.id).toBe(original.id);
});
