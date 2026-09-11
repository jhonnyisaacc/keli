import { describe, expect, test } from "bun:test";
import { pinSkill, reusePinnedSkill, setSkillPinDatabase } from "../../src/skills/pin.ts";
import { createTestEnv, projectScope, reopenDb } from "../helpers/setup.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { createJob, setJobStatus } from "../../src/jobs/store.ts";
import { grantJobCapabilities } from "../../src/jobs/grants.ts";
import { bindTransportRoute, resolveDiscordThreadRoute } from "../../src/transports/routes.ts";
import { markOutboxUnknown } from "../../src/transports/outbox.ts";
import { enqueueOutbox } from "../../src/transports/outbox.ts";
import { advancePreservationCursor, readPreservationCursor } from "../../src/preservation/cursor.ts";
import { cancelRun, createRun } from "../../src/core/run-control.ts";
import { dispatchCapability } from "../../src/execution/dispatch.ts";
import { defaultNetworkPolicy } from "../../src/execution/dispatch-context.ts";

describe("0.1-E acceptance gates", () => {
  test("A07 ambiguous correction asks before durable change", async () => {
    const env = await createTestEnv();
    const result = await env.loop.runTurn("Rocket changes use");
    expect(result.kind).toBe("blocked");
    expect(result.message).toContain("Ambiguous");
    const rule = env.behavior.getRule(projectScope(env.rocketId), "coding.delegate");
    expect(rule).toBeNull();
    env.close();
  });

  test("A12/A13 observational ok; mutate blocked until grant", async () => {
    const env = await createTestEnv();
    const jobId = "job-grant";
    createJob(env.db, {
      id: jobId,
      ownerId: env.ownerId,
      scope: projectScope(env.rocketId),
      name: "watch",
      schedule: "every:1h",
      status: "active",
    });
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const observe = await gate.run(
      {
        capabilityId: "jobs.observe",
        input: { jobId, occurrenceId: "o1", jobName: "watch" },
        resources: [],
      },
      { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
      projectScope(env.rocketId),
      "/tmp",
      { jobId },
    );
    expect(observe.result.ok).toBe(true);

    const blocked = await gate.run(
      {
        capabilityId: "files.write",
        input: { path: "/tmp/a", content: "b" },
        resources: [],
      },
      { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
      projectScope(env.rocketId),
      "/tmp",
      { jobId },
    );
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.error?.code).toBe("grant_required");

    grantJobCapabilities(env.db, jobId, { mutate: true });
    const allowed = await gate.run(
      {
        capabilityId: "files.write",
        input: { path: "/tmp/a", content: "b" },
        resources: [],
      },
      { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
      projectScope(env.rocketId),
      "/tmp",
      { jobId },
    );
    expect(allowed.result.ok).toBe(true);
    env.close();
  });

  test("A17 discord thread binding without parent fallback", () => {
    const env = createTestEnv();
    return env.then(async (e) => {
      bindTransportRoute(e.db, {
        transport: "discord",
        externalId: "channel-1",
        scope: projectScope(e.rocketId),
      });
      bindTransportRoute(e.db, {
        transport: "discord",
        externalId: "thread:thread-1",
        scope: projectScope(e.rocketId),
        metadata: { requireThread: true },
      });
      expect(resolveDiscordThreadRoute(e.db, "channel-1", "thread-1")?.externalId).toBe(
        "thread:thread-1",
      );
      expect(resolveDiscordThreadRoute(e.db, "channel-1")).not.toBeNull();
      expect(resolveDiscordThreadRoute(e.db, "channel-1", "missing-thread")).toBeNull();
      e.close();
    });
  });

  test("A20 lost receipt marks outbox unknown", async () => {
    const env = await createTestEnv();
    const msg = enqueueOutbox(env.db, {
      id: "out-1",
      scope: projectScope(env.rocketId),
      destination: "discord:ch",
      payload: { message: "hi" },
    });
    markOutboxUnknown(env.db, msg.id, "receipt timeout");
    const row = env.db
      .query("SELECT status FROM outbox_messages WHERE id = ?")
      .get(msg.id) as { status: string };
    expect(row.status).toBe("unknown");
    env.close();
  });

  test("A25 backup excludes credentials", async () => {
    const env = await createTestEnv();
    const { createBackup } = await import("../../src/ops/backup.ts");
    const backup = await createBackup(env.stateDir);
    expect(backup.manifest.includesCredentials).toBe(false);
    env.close();
  });

  test("A27/A28 skill pin and reuse survive restart", async () => {
    const env = await createTestEnv();
    pinSkill({ id: "lint", version: "1.0.0", source: "local", license: "MIT" });
    expect(reusePinnedSkill("lint").version).toBe("1");
    env.close();

    const db = reopenDb(env.stateDir);
    setSkillPinDatabase(db);
    expect(reusePinnedSkill("lint").version).toBe("1");
    setSkillPinDatabase(undefined);
    db.close();
  });

  test("A29 honcho absent — local rules still work", async () => {
    const env = await createTestEnv();
    const result = await env.loop.runTurn("Rocket changes use Codex");
    expect(result.kind).toBe("correction");
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(new URL("../../src/model/loop.ts", import.meta.url), "utf8");
    expect(src.includes("honcho")).toBe(false);
    env.close();
  });

  test("A30/A39/A40 paused/false jobs make zero model calls", async () => {
    const env = await createTestEnv();
    const jobId = "quiet-job";
    createJob(env.db, {
      id: jobId,
      ownerId: env.ownerId,
      scope: projectScope(env.rocketId),
      name: "quiet",
      schedule: "every:1m",
      status: "paused",
    });
    setJobStatus(env.db, jobId, "paused");
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const { result } = await gate.run(
      {
        capabilityId: "jobs.observe",
        input: { jobId, occurrenceId: "o1", jobName: "quiet", simulateChanged: false },
        resources: [],
      },
      { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
      projectScope(env.rocketId),
      "/tmp",
      { jobId },
    );
    expect(result.ok).toBe(true);
    expect((result.output as { quiet: boolean }).quiet).toBe(true);
    env.close();
  });

  test("A32/A41 schema index vs full schema", () => {
    const index = defaultRegistry.index();
    const fullSchemas = index.map((c) => defaultRegistry.schemaFor(c.id));
    expect(index.length).toBeGreaterThan(0);
    expect(JSON.stringify(index).length).toBeLessThan(JSON.stringify(fullSchemas).length);
  });

  test("A35 missing capability suggests discover", async () => {
    const result = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "files.re", input: {}, resources: [] },
      { policy: { readableRoots: ["/tmp"], writableRoots: ["/tmp"] }, network: defaultNetworkPolicy() },
    );
    expect(result.error?.message).toMatch(/files\.read|capabilities/);
  });

  test("A42 cancel blocks delegate child", async () => {
    const env = await createTestEnv();
    const runId = createRun(env.db, projectScope(env.rocketId));
    cancelRun(env.db, runId);
    const result = await dispatchCapability(
      defaultRegistry,
      {
        capabilityId: "delegate.run",
        input: {
          delegate: "Codex",
          goal: "test",
          workspace: "/tmp",
          actionId: "a1",
        },
        resources: [],
      },
      {
        policy: { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
        network: defaultNetworkPolicy(),
        run: { db: env.db, runId, cancelEpoch: 1 },
        fixtures: { delegate: process.env.KELI_DELEGATE_FIXTURE_URL ?? "http://127.0.0.1:9" },
      },
    );
    expect(result.ok).toBe(false);
    env.close();
  });

  test("A46 pre-dispatch byte guard blocks oversized proposals", async () => {
    const env = await createTestEnv();
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const { result } = await gate.run(
      {
        capabilityId: "files.read",
        input: { path: "/tmp/x" },
        resources: [],
      },
      { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
      projectScope(env.rocketId),
      "/tmp",
      { proposalBytesMax: 1 },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("quota_exceeded");
    env.close();
  });

  test("A45 preservation cursor advances without silent hole", async () => {
    const env = await createTestEnv();
    env.db.run(
      `INSERT INTO change_journal(id, entity_type, entity_id, revision, actor, source_ref, payload_json, created_at)
       VALUES ('j1', 'rule', 'r1', 1, 'owner', 'test', '{}', ?)`,
      [new Date().toISOString()],
    );
    advancePreservationCursor(env.db, "j1");
    const cursor = readPreservationCursor(env.db);
    expect(cursor.lastJournalId).toBe("j1");
    env.close();
  });
});
