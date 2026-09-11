import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createJob } from "../../src/jobs/store.ts";
import { tickScheduler } from "../../src/jobs/scheduler.ts";
import { jobTickContext } from "../helpers/jobs.ts";
import { migrate } from "../../src/state/migrate.ts";
import { pauseAutonomy } from "../../src/ops/control.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeConfig, defaultConfig } from "../../src/state/config.ts";

describe("A14/A36 global pause", () => {
  test("paused scheduler does not tick", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-pause-"));
    const dbPath = join(stateDir, "state.sqlite");
    const db = new Database(dbPath, { create: true });
    migrate(db);
    await writeConfig({ ...defaultConfig(), ownerId: "o1", defaultProjectId: "p1" }, stateDir);
    createJob(db, {
      id: "job-1",
      ownerId: "o1",
      scope: "project:p1",
      name: "watch",
      schedule: "every:1m",
      status: "active",
    });
    await pauseAutonomy(stateDir);
    const result = await tickScheduler(db, jobTickContext(db, { stateDir }));
    expect(result.materialized).toHaveLength(0);
    db.close();
  });

  test("paused gate blocks effectful capabilities", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-pause-"));
    const dbPath = join(stateDir, "state.sqlite");
    const db = new Database(dbPath, { create: true });
    migrate(db);
    await writeConfig({ ...defaultConfig(), ownerId: "o1", defaultProjectId: "p1" }, stateDir);
    await pauseAutonomy(stateDir);
    const gate = new CapabilityGate(db, defaultRegistry, stateDir, "o1");
    const { result } = await gate.run(
      {
        capabilityId: "files.write",
        input: { path: "/tmp/x", content: "y" },
        resources: [],
      },
      { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
      "project:p1",
      "/tmp",
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("autonomy_paused");
    db.close();
  });
});
