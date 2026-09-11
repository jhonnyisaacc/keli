import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { migrate } from "../../src/state/migrate.ts";
import { createJob } from "../../src/jobs/store.ts";
import { tryCreateOccurrence } from "../../src/jobs/occurrences.ts";
import { tickScheduler } from "../../src/jobs/scheduler.ts";
import { jobTickContext } from "../helpers/jobs.ts";

describe("job scheduler", () => {
  test("materializes due occurrence and completes with zero-model reason", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const createdAt = new Date(Date.now() - 60_000).toISOString();
    const job = createJob(db, {
      id: "job-1",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "heartbeat",
      schedule: "every:1s",
      status: "active",
      createdAt,
    });

    const result = await tickScheduler(db, jobTickContext(db));
    expect(result.scanned).toBe(1);
    expect(result.materialized.length).toBe(1);
    expect(result.processed.length).toBe(1);

    const row = db
      .query("SELECT status, reason FROM job_occurrences WHERE job_id = ?")
      .get(job.id) as { status: string; reason: string };
    expect(row.status).toBe("completed");
    expect(row.reason).toContain("unchanged observation");
    db.close();
  });

  test("coalesces when an active occurrence already exists", async () => {
    const db = new Database(":memory:");
    migrate(db);
    createJob(db, {
      id: "job-2",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "pending",
      schedule: "every:1s",
      status: "active",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
    tryCreateOccurrence(db, {
      id: "occ-pending",
      jobId: "job-2",
      scheduledAt: new Date().toISOString(),
      status: "pending",
    });

    const result = await tickScheduler(db, jobTickContext(db));
    expect(result.materialized.length).toBe(0);
    expect(result.coalesced).toBe(1);
    db.close();
  });

  test("coalesces long outage into one occurrence per tick", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const createdAt = new Date(Date.now() - 100_000).toISOString();
    createJob(db, {
      id: "job-outage",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "outage",
      schedule: "every:10s",
      status: "active",
      createdAt,
    });

    const result = await tickScheduler(db, jobTickContext(db));
    expect(result.materialized.length).toBe(1);

    const rows = db
      .query("SELECT reason FROM job_occurrences WHERE job_id = ?")
      .all("job-outage") as { reason: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0].reason).toContain("coalesced");
    db.close();
  });

  test("dedupes identical job_id + scheduled_at", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const scheduledAt = "2026-01-01T00:00:00.000Z";
    createJob(db, {
      id: "job-3",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "dedupe",
      schedule: "every:1s",
      status: "active",
      createdAt: "2025-12-31T23:59:00.000Z",
    });
    const first = tryCreateOccurrence(db, {
      id: "occ-a",
      jobId: "job-3",
      scheduledAt,
    });
    const second = tryCreateOccurrence(db, {
      id: "occ-b",
      jobId: "job-3",
      scheduledAt,
    });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    db.close();
  });
});
