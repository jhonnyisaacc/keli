import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { indexCollection } from "../../src/sources/index.ts";
import { createSourceReader } from "../../src/sources/reader.ts";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject } from "../../src/state/repos.ts";
import type { KeliConfig } from "../../src/state/config.ts";
import { tickWatches } from "../../src/watches/heartbeat.ts";
import { compileHeartbeat } from "../../src/watches/heartbeat-file.ts";
import { investigationOf, listResearchOccurrences } from "../../src/watches/occurrences.ts";
import { getWatch, setWatchStatus, upsertWatch } from "../../src/watches/store.ts";
import { ScriptedChatModel, scriptedFactory, type ScriptedStep } from "../fixtures/scripted-model.ts";
import type { WatchDefinition } from "../../src/watches/types.ts";

const fixture = fileURLToPath(new URL("../fixtures/structured-tool-cli.ts", import.meta.url));
const scope = "project:p";

let dir: string, db: Database, behavior: BehaviorService, gate: CapabilityGate;

function rocketConfig(): KeliConfig {
  return {
    version: 2,
    ownerId: "owner",
    defaultProjectId: "p",
    tools: {
      rocket: {
        bin: process.execPath,
        args: [fixture, "{workflow}", "--json"],
        workflows: ["research", "positions", "macro", "health"],
        revision: "fixture",
        timeoutMs: 2000,
      },
    },
  };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "keli-responsibility-"));
  db = new Database(join(dir, "state.sqlite"));
  migrate(db);
  createOwner(db, "owner");
  createProject(db, "p", "owner", "research", [dir]);
  behavior = new BehaviorService(db, "owner");
  gate = new CapabilityGate(db, defaultRegistry, dir, "owner");
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

function responsibility(extra: Partial<WatchDefinition> = {}) {
  return upsertWatch(db, {
    ownerId: "owner",
    scope,
    status: "active",
    definition: {
      name: "portfolio",
      kind: "responsibility",
      trigger: { schedule: "daily:09:00", target: "portfolio" },
      evidence: {
        question: "Maintain a current assessment using approved tools",
        autonomy: true,
        capabilities: ["tools.rocket"],
        review: "scheduled",
      },
      budget: { requestsMax: 40, toolCallsMax: 20 },
      ...extra,
    },
  }).watch;
}

function loop(steps: ScriptedStep[]) {
  const model = new ScriptedChatModel(steps);
  return {
    model,
    loop: new ConversationLoop({
      db,
      behavior,
      capabilityGate: gate,
      registry: defaultRegistry,
      policy: { readableRoots: [dir], writableRoots: [dir] },
      sources: createSourceReader(db),
      model: scriptedFactory(model),
      config: rocketConfig(),
      options: { retryBaseMs: 0 },
    }),
  };
}

async function tick(at: string, steps: ScriptedStep[]) {
  const l = loop(steps);
  const result = await tickWatches(db, {
    ownerId: "owner",
    stateDir: dir,
    behavior,
    loop: l.loop,
    sources: createSourceReader(db),
  }, new Date(at));
  return { ...l, result };
}

function answerFromTool(workflow: string, claim: string): ScriptedStep {
  return (messages) => {
    const last = messages.at(-1)?.content ?? "";
    const payload = JSON.parse(last.replace(/^Tool result for tools\.rocket:\s*/, ""));
    const quote = JSON.stringify(payload.output.projection ?? payload.output.finding);
    const id = `tool:tools.rocket:${workflow}`;
    return {
      type: "answer",
      text: claim,
      citations: [{ sourceId: id, quote }],
      attributions: [{ subject: "portfolio", claim, sourceIds: [id] }],
    };
  };
}

describe("general responsibility controller", () => {
  test("HEARTBEAT responsibility defaults to daily 09:00 UTC without making that Keli-wide", () => {
    const parsed = compileHeartbeat(`# heartbeat
## portfolio-daily
- kind: responsibility
- objective: Maintain a current investment assessment
- capabilities: tools.rocket
- notify: daily-brief

## cava
- kind: source-collection
- target: cava
- every: 6h
- question: Did Cava change?
`);
    expect(parsed.problems).toEqual([]);
    expect(parsed.proposals[0]).toMatchObject({
      name: "portfolio-daily",
      kind: "responsibility",
      trigger: { schedule: "daily:09:00", target: "portfolio-daily" },
      evidence: { autonomy: true, review: "scheduled", capabilities: ["tools.rocket"] },
      notify: { policy: "daily-brief" },
    });
    expect(parsed.proposals[1]!.trigger.schedule).toBe("every:6h");
    expect(parsed.proposals[1]!.evidence.review).toBeUndefined();
  });

  test("scheduled daily reviews fire once per UTC day even when sources are unchanged", async () => {
    const w = responsibility();
    db.run("UPDATE watches SET created_at=? WHERE id=?", ["2026-09-15T08:00:00.000Z", w.id]);
    expect((await tick("2026-09-15T08:30:00.000Z", [])).result.outcomes[0]!.result).toBe("not-due");
    expect(listResearchOccurrences(db, w.id)).toHaveLength(0);

    const first = await tick("2026-09-15T09:00:00.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } },
      answerFromTool("positions", "Hold the current book"),
    ]);
    expect(first.result.outcomes[0]!.result).toBe("researched");
    expect(listResearchOccurrences(db, w.id)).toHaveLength(1);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
    expect(listResearchOccurrences(db, w.id)[0]!.fingerprint).toBe("review:daily:2026-09-15");

    expect((await tick("2026-09-15T18:00:00.000Z", [])).result.outcomes[0]!.result).toBe("not-due");
    expect(listResearchOccurrences(db, w.id)).toHaveLength(1);

    const next = await tick("2026-09-16T09:00:00.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } },
      answerFromTool("positions", "Hold the current book"),
    ]);
    expect(next.result.outcomes[0]!.result).toBe("researched");
    expect(listResearchOccurrences(db, w.id)).toHaveLength(2);
    expect(listResearchOccurrences(db, w.id)[0]!.fingerprint).toBe("review:daily:2026-09-16");
  });

  test("tools.rocket is approved only on the responsibility allowlist", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = join(dir, "cava");
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "a.md"), "A conditional thesis");
    await indexCollection(db, { id: "cava", path });
    const sourceWatch = upsertWatch(db, {
      ownerId: "owner",
      scope,
      status: "active",
      definition: {
        name: "research",
        kind: "source-collection",
        trigger: { schedule: "every:1s", target: "cava" },
        evidence: { question: "Track thesis", autonomy: true },
        budget: { requestsMax: 20, toolCallsMax: 8 },
      },
    }).watch;
    const refused = await tick("2026-09-15T00:00:02.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } },
      { type: "missing_evidence", text: "rocket is outside this watch" },
    ]);
    expect(refused.model.calls.flat().some(m => /not allowed in research turns|not approved for this responsibility/.test(m.content))).toBe(true);
    setWatchStatus(db, sourceWatch.id, "paused");

    const allowed = responsibility({ name: "allowed-rocket" });
    db.run("UPDATE watches SET created_at=? WHERE id=?", ["2026-09-15T08:00:00.000Z", allowed.id]);
    const ok = await tick("2026-09-15T09:00:00.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } },
      answerFromTool("positions", "Hold"),
    ]);
    expect(listResearchOccurrences(db, allowed.id)[0]!.status).toBe("verified");
    expect(investigationOf(listResearchOccurrences(db, allowed.id)[0]!).attempts.some(a => a.capability === "tools.rocket" && a.ok)).toBe(true);
    expect(ok.model.calls.length).toBeGreaterThan(0);
  });

  test("a healthy no-finding tool result cannot verify the occurrence", async () => {
    const w = responsibility();
    db.run("UPDATE watches SET created_at=? WHERE id=?", ["2026-09-15T08:00:00.000Z", w.id]);
    const closed = {
      type: "answer" as const,
      text: "Nothing new, so the question is closed",
      citations: [{ sourceId: "tool:tools.rocket:macro", quote: "nothing" }],
      attributions: [{ subject: "macro", claim: "resolved", sourceIds: ["tool:tools.rocket:macro"] }],
    };
    await tick("2026-09-15T09:00:00.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "macro" } },
      closed,
      closed,
    ]);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("waiting_for_evidence");
  });

  test("InMind: current scoped rule applies without repeating its wording or leaking projects", async () => {
    createProject(db, "other", "owner", "other", [dir]);
    behavior.reviseRule(
      { scope, key: "conversation.language", value: "es" },
      { actor: "owner", text: "Reply in Spanish from now on", source: "user-correction", trusted: true },
    );
    behavior.reviseRule(
      { scope: "project:other", key: "conversation.language", value: "fr" },
      { actor: "owner", text: "French only", source: "user-correction", trusted: true },
    );
    const w = responsibility({
      evidence: {
        question: "Maintain a current assessment using approved tools",
        autonomy: true,
        capabilities: ["tools.rocket"],
        review: "scheduled",
        constraints: "Apply the current language rule",
      },
    });
    db.run("UPDATE watches SET created_at=? WHERE id=?", ["2026-09-15T08:00:00.000Z", w.id]);
    const first = await tick("2026-09-15T09:00:00.000Z", [
      (messages) => {
        const blob = messages.map(m => m.content).join("\n");
        expect(blob).toContain("conversation.language");
        expect(blob).toContain("\"value\":\"es\"");
        expect(blob).not.toContain("Reply in Spanish from now on");
        expect(blob).not.toContain("\"value\":\"fr\"");
        expect(blob).not.toContain("French only");
        return { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } };
      },
      answerFromTool("positions", "Hold"),
    ]);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
    expect(first.model.calls.length).toBe(2);
    expect(behavior.getRule("project:other", "conversation.language")?.value).toBe("fr");
  });

  test("bounded discovery loads an approved schema without expanding authority", async () => {
    const w = responsibility();
    db.run("UPDATE watches SET created_at=? WHERE id=?", ["2026-09-15T08:00:00.000Z", w.id]);
    await tick("2026-09-15T09:00:00.000Z", [
      (messages) => {
        const system = messages[0]!.content;
        expect(system).toContain("tools.rocket");
        expect(system).toContain("capabilities.lookup");
        expect(system).toContain("Approved tools (ids only)");
        expect(system).not.toContain("input keys: workflow");
        expect(system).not.toContain("files.write");
        return { type: "tool_call", capability: "capabilities.lookup", input: { query: "rocket" } };
      },
      (messages) => {
        const last = messages.at(-1)!.content;
        expect(last).toContain("tools.rocket");
        expect(last).toContain("workflow");
        expect(last).not.toContain("files.write");
        return { type: "tool_call", capability: "files.write", input: { path: "owned.txt", content: "no" } };
      },
      (messages) => {
        expect(messages.at(-1)!.content).toMatch(/not approved for this responsibility|not allowed in research turns/);
        return { type: "tool_call", capability: "tools.rocket", input: { workflow: "swap" } };
      },
      (messages) => {
        expect(messages.at(-1)!.content).toMatch(/capability_denied|not approved|undeclared|invalid/);
        return { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } };
      },
      answerFromTool("positions", "Hold; no orders"),
    ]);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
  });

  test("daily-brief notifies on a verified review even when the thesis is unchanged", async () => {
    const w = responsibility({ notify: { policy: "daily-brief" } });
    db.run("UPDATE watches SET created_at=? WHERE id=?", ["2026-09-15T08:00:00.000Z", w.id]);
    await tick("2026-09-15T09:00:00.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } },
      answerFromTool("positions", "Hold the current book"),
    ]);
    await tick("2026-09-16T09:00:00.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } },
      answerFromTool("positions", "Hold the current book"),
    ]);
    const n = (db.query("SELECT COUNT(*) n FROM outbox_messages").get() as { n: number }).n;
    expect(n).toBe(2);
    expect(getWatch(db, w.id)!.notify.policy).toBe("daily-brief");
  });
});

test("migration 13 preserves approved watches and adds investigation_json", () => {
  const old = new Database(":memory:");
  try {
    migrate(old, 12);
    createOwner(old, "owner");
    createProject(old, "p", "owner", "research", []);
    const w = upsertWatch(old, {
      ownerId: "owner",
      scope,
      status: "active",
      definition: {
        name: "old",
        kind: "source-collection",
        trigger: { schedule: "every:1s", target: "cava" },
        evidence: { question: "Old watch" },
      },
    }).watch;
    migrate(old);
    expect(getWatch(old, w.id)!.status).toBe("active");
    const cols = old.query("PRAGMA table_info(watch_occurrences)").all() as Array<{ name: string }>;
    expect(cols.some(c => c.name === "investigation_json")).toBe(true);
    expect(old.query("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
  } finally {
    old.close();
  }
});
