import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { indexCollection } from "../../src/sources/index.ts";
import { createSourceReader } from "../../src/sources/reader.ts";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";
import { compileHeartbeat, importHeartbeatFile } from "../../src/watches/heartbeat-file.ts";
import { tickWatches, type WatchNotification } from "../../src/watches/heartbeat.ts";
import { getWatch, listWatchEvents, listWatches, setWatchStatus, upsertWatch } from "../../src/watches/store.ts";
import { ScriptedChatModel, scriptedFactory, type ScriptedStep } from "../fixtures/scripted-model.ts";

/**
 * Cava replay: a YouTube channel proposes a market "caída". The watch must (1) do nothing when
 * the transcript collection is unchanged, (2) research once per material change with cited
 * transcript evidence, (3) explain conditional scenarios and invalidation rather than declare an
 * opportunity, and (4) notify exactly once.
 */

let stateDir: string;
let corpus: string;
let db: Database;
let behavior: BehaviorService;
let gate: CapabilityGate;
const OWNER = "owner-1";
const scope = projectScope("proj-finanzas");

const HEARTBEAT = `# Keli heartbeat

## cava
- kind: source-collection
- target: cava
- every: 6h
- question: Did José Luis Cava publish a new or materially changed market thesis? What would a conditional sell / re-entry plan look like, with assumptions and invalidation?
- requires: cava
- notify: material-change
- channel: chan-finanzas
- thread: thread-cava

## broken
- target: nothing
`;

const VIDEO_1 = `---
title: Caída de los mercados: lo que viene
author: José Luis Cava
channel: cava
url: https://youtube.com/watch?v=abc123
published_at: 2026-09-10T18:00:00Z
---
Cava propone una caída de los mercados en las próximas semanas. Señala la divergencia entre el S&P 500 y el sentimiento, y que el VIX en mínimos suele preceder correcciones. Si el S&P pierde los 5.800 puntos, espera una corrección del 10%.
`;

const VIDEO_2 = `---
title: Confirmación de la caída? Niveles clave
author: José Luis Cava
channel: cava
url: https://youtube.com/watch?v=def456
published_at: 2026-09-12T18:00:00Z
---
Cava mantiene la tesis bajista pero matiza: si el S&P recupera los 6.000 puntos con volumen, la tesis de caída queda invalidada. Recomienda paciencia y niveles de re-entrada escalonados.
`;

function makeLoop(steps: ScriptedStep[]) {
  const model = new ScriptedChatModel(steps);
  const loop = new ConversationLoop({
    db,
    behavior,
    capabilityGate: gate,
    registry: defaultRegistry,
    policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
    model: scriptedFactory(model),
    sources: createSourceReader(db),
    options: { retryBaseMs: 1 },
  });
  return { loop, model };
}

beforeAll(async () => {
  stateDir = await mkdtemp(join(tmpdir(), "keli-cava-"));
  corpus = join(stateDir, "cava");
  await mkdir(corpus, { recursive: true });
  await writeFile(join(stateDir, "HEARTBEAT.md"), HEARTBEAT);
  db = new Database(join(stateDir, "state.sqlite"), { create: true });
  migrate(db);
  createOwner(db, OWNER);
  createProject(db, "proj-finanzas", OWNER, "finanzas", [stateDir]);
  behavior = new BehaviorService(db, OWNER);
  gate = new CapabilityGate(db, defaultRegistry, stateDir, OWNER);
});

afterAll(async () => {
  db.close();
  await rm(stateDir, { recursive: true, force: true });
});

describe("HEARTBEAT.md compiles to watch proposals", () => {
  test("sections become proposals; malformed sections are reported, not guessed", () => {
    const parsed = compileHeartbeat(HEARTBEAT);
    expect(parsed.proposals.length).toBe(1);
    expect(parsed.proposals[0]).toMatchObject({
      name: "cava",
      kind: "source-collection",
      trigger: { schedule: "every:6h", target: "cava" },
      evidence: { requiredCollections: ["cava"] },
      notify: { policy: "material-change", channelId: "chan-finanzas", threadId: "thread-cava", transport: "discord" },
    });
    expect(parsed.problems).toEqual([{ section: "broken", line: 13, message: "missing every, question" }]);
  });

  test("import creates proposed watches; re-import is a no-op; edits bump the version back to proposed", async () => {
    const first = await importHeartbeatFile(db, { ownerId: OWNER, scope, path: join(stateDir, "HEARTBEAT.md") });
    expect(first.created.length).toBe(1);
    expect(first.created[0]!.status).toBe("proposed");
    expect(first.created[0]!.sourceRef).toBe(`file:${join(stateDir, "HEARTBEAT.md")}#cava`);
    expect(listWatches(db, { status: "active" }).length).toBe(0);

    const again = await importHeartbeatFile(db, { ownerId: OWNER, scope, path: join(stateDir, "HEARTBEAT.md") });
    expect(again.created.length).toBe(0);
    expect(again.unchanged.length).toBe(1);

    const id = first.created[0]!.id;
    setWatchStatus(db, id, "active");
    expect(getWatch(db, id)!.status).toBe("active");

    await writeFile(join(stateDir, "HEARTBEAT.md"), HEARTBEAT.replace("every: 6h", "every: 1h"));
    const edited = await importHeartbeatFile(db, { ownerId: OWNER, scope, path: join(stateDir, "HEARTBEAT.md") });
    expect(edited.updated.length).toBe(1);
    expect(edited.updated[0]!.version).toBe(2);
    expect(edited.updated[0]!.status).toBe("proposed");
    expect(edited.updated[0]!.trigger.schedule).toBe("every:1h");

    // Approve the edited version for the tick tests below.
    setWatchStatus(db, id, "active");
  });
});

describe("Cava watch heartbeat", () => {
  const notifications: WatchNotification[] = [];
  const notify = async (n: WatchNotification) => {
    notifications.push(n);
  };

  test("first observation with an empty collection: nothing to research, no notification", async () => {
    await indexCollection(db, { id: "cava", path: corpus, kind: "transcripts", author: "José Luis Cava" });
    const { loop, model } = makeLoop([]);
    const now = new Date("2026-09-13T00:00:00Z");
    const result = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, sources: createSourceReader(db), notify }, now);
    expect(result.scanned).toBe(1);
    expect(result.due).toBe(1);
    // An empty collection has a fingerprint too; the first observation still wakes the model
    // (there is no baseline), so the scripted model has nothing and the loop reports an error.
    // We treat that as: the watch is observed, failure recorded, nothing notified.
    expect(model.calls.length).toBe(1);
    expect(notifications.length).toBe(0);
    const watch = listWatches(db, { scope })[0]!;
    expect(watch.lastError).toContain("Model request failed");
  });

  test("new transcript wakes the model once, requires cited Cava evidence, notifies once", async () => {
    await writeFile(join(corpus, "2026-09-10-caida.md"), VIDEO_1);
    await indexCollection(db, { id: "cava", path: corpus, kind: "transcripts", author: "José Luis Cava" });

    const { loop, model } = makeLoop([
      (messages) => {
        expect(messages.at(-1)!.content).toContain("Watch \"cava\"");
        expect(messages.at(-1)!.content).toContain("Do not recommend executing any trade");
        return { type: "tool_call", capability: "sources.search", input: { query: "caída mercados S&P", collection: "cava" } };
      },
      {
        type: "answer",
        text:
          "New thesis (2026-09-10): Cava expects a market fall. Conditional plan: if S&P 500 loses 5,800, his own scenario is a ~10% correction; a staged re-entry would only make sense after that level breaks and stabilizes. Assumptions: VIX-low-precedes-correction pattern holds; sentiment divergence matters. Invalidation: S&P holds 5,800 or makes new highs. A bearish video alone is not an opportunity.",
        citations: [{ sourceId: "cava:2026-09-10-caida.md", quote: "Si el S&P pierde los 5.800 puntos, espera una corrección del 10%" }],
        attributions: [{ subject: "José Luis Cava", claim: "expects a market fall; 5,800 is the trigger", sourceIds: ["cava:2026-09-10-caida.md"], stance: "interprets" }],
      },
    ]);
    const now = new Date("2026-09-13T02:00:00Z");
    const result = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, sources: createSourceReader(db), notify }, now);
    expect(result.due).toBe(1);
    expect(result.modelWakes).toBe(1);
    expect(result.notifications).toBe(1);
    expect(result.outcomes[0]!.result).toBe("researched");
    expect(result.outcomes[0]!.outcomeKind).toBe("answer");
    expect(model.calls.length).toBe(2);
    expect(notifications.length).toBe(1);
    expect(notifications[0]!.kind).toBe("changed");
    expect(notifications[0]!.text).toContain("Invalidation");
    expect(notifications[0]!.watch.notify.threadId).toBe("thread-cava");

    const watch = listWatches(db, { scope })[0]!;
    expect(watch.lastSuccessAt).toBe(now.toISOString());
    expect(watch.lastError).toBeUndefined();
    expect(watch.attempts).toBe(0);
    expect(watch.lastFingerprint).toBe(createSourceReader(db).fingerprint("cava").hash);
  });

  test("unchanged collection: zero model calls, zero notifications", async () => {
    const { loop, model } = makeLoop([{ type: "answer", text: "must not be asked", citations: [], attributions: [] }]);
    const now = new Date("2026-09-13T04:00:00Z");
    const result = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, sources: createSourceReader(db), notify }, now);
    expect(result.due).toBe(1);
    expect(result.modelWakes).toBe(0);
    expect(result.outcomes[0]!.result).toBe("unchanged");
    expect(model.calls.length).toBe(0);
    expect(notifications.length).toBe(1);
  });

  test("not due yet: skipped without touching the source", async () => {
    const { loop, model } = makeLoop([]);
    const now = new Date("2026-09-13T04:30:00Z");
    const result = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, sources: createSourceReader(db), notify }, now);
    expect(result.due).toBe(0);
    expect(result.outcomes[0]!.result).toBe("not-due");
    expect(model.calls.length).toBe(0);
  });

  test("a follow-up video changes the fingerprint; the answer must distinguish confirmation from invalidation", async () => {
    await writeFile(join(corpus, "2026-09-12-niveles.md"), VIDEO_2);
    await indexCollection(db, { id: "cava", path: corpus, kind: "transcripts", author: "José Luis Cava" });
    const { loop, model } = makeLoop([
      { type: "tool_call", capability: "sources.search", input: { query: "invalidada 6.000 re-entrada", collection: "cava" } },
      // First draft attributes a position to an unrelated subject without evidence → rejected.
      {
        type: "answer",
        text: "Cava confirms the fall and so do most analysts.",
        citations: [{ sourceId: "cava:2026-09-12-niveles.md" }],
        attributions: [
          { subject: "José Luis Cava", claim: "maintains bearish thesis", sourceIds: ["cava:2026-09-12-niveles.md"] },
          { subject: "most analysts", claim: "agree", sourceIds: [] },
        ],
      },
      {
        type: "answer",
        text: "Update (2026-09-12): Cava keeps the bearish thesis but names its invalidation: S&P reclaiming 6,000 with volume. Re-entry is staged, not a single buy. No change to the conditional plan unless 5,800 breaks or 6,000 is reclaimed.",
        citations: [{ sourceId: "cava:2026-09-12-niveles.md", quote: "si el S&P recupera los 6.000 puntos con volumen, la tesis de caída queda invalidada" }],
        attributions: [{ subject: "José Luis Cava", claim: "bearish thesis with explicit invalidation at 6,000", sourceIds: ["cava:2026-09-12-niveles.md"], stance: "interprets" }],
      },
    ]);
    const now = new Date("2026-09-13T06:00:00Z");
    const result = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, sources: createSourceReader(db), notify }, now);
    expect(result.modelWakes).toBe(1);
    expect(result.notifications).toBe(1);
    expect(model.calls.length).toBe(3);
    expect(notifications.length).toBe(2);
    expect(notifications[1]!.text).toContain("invalidation");
  });

  test("restart with the same fingerprint replays the stored research and does not notify again", async () => {
    const watch = listWatches(db, { scope })[0]!;
    // Simulate a lost fingerprint after a restore: the change is seen again...
    db.run("UPDATE watches SET last_fingerprint = NULL, last_attempt_at = NULL WHERE id = ?", [watch.id]);
    const { loop, model } = makeLoop([{ type: "answer", text: "must not be asked", citations: [], attributions: [] }]);
    const now = new Date("2026-09-13T08:00:00Z");
    const result = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, sources: createSourceReader(db), notify }, now);
    // ...but the research turn for that fingerprint already exists, so the model stays asleep.
    expect(result.outcomes[0]!.result).toBe("already-researched");
    expect(result.modelWakes).toBe(0);
    expect(model.calls.length).toBe(0);
    expect(notifications.length).toBe(2);
    expect(getWatch(db, watch.id)!.lastFingerprint).toBeTruthy();
  });

  test("silent policy researches but never notifies; events still record what happened", async () => {
    const { watch } = upsertWatch(db, {
      ownerId: OWNER,
      scope,
      status: "active",
      definition: {
        name: "cava-quiet",
        kind: "source-collection",
        trigger: { schedule: "every:1h", target: "cava" },
        evidence: { question: "Summarize the newest Cava video." },
        notify: { policy: "silent" },
      },
    });
    const before = notifications.length;
    const { loop } = makeLoop([
      { type: "tool_call", capability: "sources.search", input: { query: "Cava", collection: "cava" } },
      { type: "answer", text: "Summary.", citations: [{ sourceId: "cava:2026-09-12-niveles.md" }], attributions: [] },
    ]);
    const result = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, sources: createSourceReader(db), notify }, new Date("2026-09-13T09:00:00Z"));
    const quiet = result.outcomes.find((o) => o.watchId === watch.id)!;
    expect(quiet.result).toBe("researched");
    expect(quiet.notified).toBe(false);
    expect(notifications.length).toBe(before);
    expect(listWatchEvents(db, watch.id).map((e) => e.kind)).toEqual(["researched", "changed", "approved"]);
  });

  test("repeated fingerprint failures pause the watch and say so once", async () => {
    const { watch } = upsertWatch(db, {
      ownerId: OWNER,
      scope,
      status: "active",
      definition: {
        name: "missing-collection",
        kind: "source-collection",
        trigger: { schedule: "every:1s", target: "does-not-exist" },
        evidence: { question: "?" },
        budget: { maxConsecutiveFailures: 2 },
      },
    });
    // A missing collection fingerprints as empty, which is a valid observation; force a failure
    // by removing the source reader instead.
    const { loop } = makeLoop([]);
    const before = notifications.length;
    const t1 = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, notify }, new Date("2026-09-14T00:00:00Z"));
    expect(t1.outcomes.find((o) => o.watchId === watch.id)!.result).toBe("failed");
    expect(getWatch(db, watch.id)!.attempts).toBe(1);
    expect(getWatch(db, watch.id)!.lastError).toContain("no source reader");
    const t2 = await tickWatches(db, { ownerId: OWNER, stateDir, behavior, loop, notify }, new Date("2026-09-14T00:00:05Z"));
    expect(t2.outcomes.find((o) => o.watchId === watch.id)!.result).toBe("paused");
    expect(getWatch(db, watch.id)!.status).toBe("paused");
    expect(notifications.length).toBe(before + 1);
    expect(notifications.at(-1)!.kind).toBe("paused");
  });
});
