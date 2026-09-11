import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { createJob } from "../../src/jobs/store.ts";
import { tickScheduler } from "../../src/jobs/scheduler.ts";
import { dispatchJobOccurrence } from "../../src/jobs/dispatch.ts";
import { linkOccurrenceRun, tryCreateOccurrence } from "../../src/jobs/occurrences.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { enqueueOutbox } from "../../src/transports/outbox.ts";
import { reconcileOutbox } from "../../src/transports/reconcile.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { jobTickContext } from "../helpers/jobs.ts";
import { projectScope } from "../../src/state/repos.ts";

describe("job dispatch through gate", () => {
  test("A15 quiet unchanged observation records run without outbox", async () => {
    const db = new Database(":memory:");
    migrate(db);
    createJob(db, {
      id: "job-quiet",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "heartbeat",
      schedule: "every:1s",
      status: "active",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const result = await tickScheduler(db, jobTickContext(db));
    expect(result.processed.length).toBe(1);

    const runs = db.query("SELECT COUNT(*) AS n FROM runs").get() as { n: number };
    const actions = db
      .query("SELECT status, capability FROM actions LIMIT 1")
      .get() as { status: string; capability: string };
    const outbox = db.query("SELECT COUNT(*) AS n FROM outbox_messages").get() as { n: number };
    const occurrence = db
      .query("SELECT status, run_id, action_id, reason FROM job_occurrences LIMIT 1")
      .get() as { status: string; run_id: string; action_id: string; reason: string };

    expect(runs.n).toBe(1);
    expect(actions.status).toBe("executed");
    expect(actions.capability).toBe("jobs.observe");
    expect(outbox.n).toBe(0);
    expect(occurrence.status).toBe("completed");
    expect(occurrence.run_id).toBeTruthy();
    expect(occurrence.action_id).toBeTruthy();
    expect(occurrence.reason).toContain("unchanged observation");
    db.close();
  });

  test("A19 execution truth retained when delivery fails after changed observation", async () => {
    const fixture = startIntegrationFixture();
    const prevUrl = process.env.KELI_DISCORD_FIXTURE_URL;
    const prevFail = process.env.KELI_FIXTURE_FAIL_DISCORD;
    process.env.KELI_DISCORD_FIXTURE_URL = fixture.endpoint;
    process.env.KELI_FIXTURE_FAIL_DISCORD = "1";

    const db = new Database(":memory:");
    migrate(db);
    createJob(db, {
      id: "job-changed",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "alerts",
      schedule: "every:1s",
      status: "active",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const ctx = jobTickContext(db, { notifyChannel: "chan-1", simulateChanged: true });
    await tickScheduler(db, ctx);

    const action = db
      .query("SELECT status FROM actions LIMIT 1")
      .get() as { status: string };
    const outbox = db
      .query("SELECT status FROM outbox_messages LIMIT 1")
      .get() as { status: string };
    const occurrence = db
      .query("SELECT status, reason FROM job_occurrences LIMIT 1")
      .get() as { status: string; reason: string };

    expect(action.status).toBe("executed");
    expect(outbox.status).toBe("failed");
    expect(occurrence.status).toBe("completed");
    expect(occurrence.reason).toContain("delivery failed");

    db.close();
    fixture.stop();
    process.env.KELI_DISCORD_FIXTURE_URL = prevUrl;
    process.env.KELI_FIXTURE_FAIL_DISCORD = prevFail;
  });

  test("A21 does not repeat dispatch for already acknowledged occurrence", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const job = createJob(db, {
      id: "job-a21",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "recover",
      schedule: "every:1h",
      status: "active",
    });
    const occurrenceId = "occ-ack";
    tryCreateOccurrence(db, {
      id: occurrenceId,
      jobId: job.id,
      scheduledAt: new Date().toISOString(),
      status: "running",
    });
    linkOccurrenceRun(db, occurrenceId, "run-existing", "action-existing");

    const gate = new CapabilityGate(db, defaultRegistry, "/tmp/keli-a21", "owner-1");
    const result = await dispatchJobOccurrence(
      db,
      {
        gate,
        policy: { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
        stateDir: "/tmp/keli-a21",
      },
      job,
      occurrenceId,
      1,
    );

    expect(result.actionId).toBe("action-existing");
    const actions = db.query("SELECT COUNT(*) AS n FROM actions").get() as { n: number };
    expect(actions.n).toBe(0);
    db.close();
  });

  test("reconciles pending discord outbox deliveries", async () => {
    const fixture = startIntegrationFixture();
    const prevUrl = process.env.KELI_DISCORD_FIXTURE_URL;
    process.env.KELI_DISCORD_FIXTURE_URL = fixture.endpoint;

    const db = new Database(":memory:");
    migrate(db);
    const scope = projectScope("proj-1");
    enqueueOutbox(db, {
      id: "outbox-pending",
      scope,
      destination: "discord:chan-1",
      payload: { message: "retry me" },
    });

    const result = await reconcileOutbox(db);
    expect(result.delivered).toBe(1);

    const row = db
      .query("SELECT status FROM outbox_messages WHERE id = ?")
      .get("outbox-pending") as { status: string };
    expect(row.status).toBe("delivered");

    db.close();
    fixture.stop();
    process.env.KELI_DISCORD_FIXTURE_URL = prevUrl;
  });
});
