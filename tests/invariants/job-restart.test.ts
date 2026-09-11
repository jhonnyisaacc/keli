import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { openDatabase } from "../../src/state/db.ts";
import { createJob } from "../../src/jobs/store.ts";
import { tryCreateOccurrence } from "../../src/jobs/occurrences.ts";

describe("job restart recovery (A21)", () => {
  test("running occurrence is failed on database reopen", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-job-restart-"));
    const dbPath = join(stateDir, "state.sqlite");
    const db = new Database(dbPath, { create: true });
    migrate(db);
    createJob(db, {
      id: "job-restart",
      ownerId: "owner-1",
      scope: "project:proj-1",
      name: "restart",
      schedule: "every:1h",
      status: "active",
    });
    tryCreateOccurrence(db, {
      id: "occ-running",
      jobId: "job-restart",
      scheduledAt: new Date().toISOString(),
      status: "running",
    });
    db.close();

    const reopened = await openDatabase(stateDir);
    const row = reopened
      .query("SELECT status, reason FROM job_occurrences WHERE id = ?")
      .get("occ-running") as { status: string; reason: string };
    expect(row.status).toBe("failed");
    expect(row.reason).toContain("Interrupted on restart");
    reopened.close();
    await rm(stateDir, { recursive: true, force: true });
  });
});
