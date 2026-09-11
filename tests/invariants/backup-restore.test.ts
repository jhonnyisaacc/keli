import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { createTestEnv } from "../helpers/setup.ts";
import { createBackup, restoreBackup } from "../../src/ops/backup.ts";
import { createJob } from "../../src/jobs/store.ts";
import { projectScope } from "../../src/state/repos.ts";
import { readControl } from "../../src/ops/control.ts";

describe("A14/A31 backup and restore", () => {
  test("restore into fresh state dir pauses jobs", async () => {
    const env = await createTestEnv();
    createJob(env.db, {
      id: "job-1",
      ownerId: env.ownerId,
      scope: projectScope(env.rocketId),
      name: "watch",
      schedule: "every:1h",
      status: "active",
    });
    env.db.run(
      `INSERT INTO actions(id, scope, capability, status, created_at) VALUES (?, ?, ?, 'executed', ?)`,
      ["act-1", projectScope(env.rocketId), "jobs.observe", new Date().toISOString()],
    );
    const backup = await createBackup(env.stateDir);
    env.close();

    const restoreDir = await mkdtemp(join(tmpdir(), "keli-restore-"));
    process.env.KELI_STATE_DIR = restoreDir;
    const restored = await restoreBackup(backup.path, restoreDir);
    expect(restored.manifest.includesCredentials).toBe(false);

    const control = await readControl(restoreDir);
    expect(control.autonomyPaused).toBe(true);
    expect(control.restoredAt).toBeTruthy();

    const db = new Database(join(restoreDir, "state.sqlite"));
    const job = db.query("SELECT status FROM jobs WHERE id = 'job-1'").get() as {
      status: string;
    };
    expect(job.status).toBe("paused");
    const action = db.query("SELECT status FROM actions WHERE id = 'act-1'").get() as {
      status: string;
    };
    expect(action.status).toBe("executed");
    db.close();
    delete process.env.KELI_STATE_DIR;
  });
});
