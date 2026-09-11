import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { cancelRun, getRun } from "../../src/core/run-control.ts";
import { countActiveHelpers, MAX_HELPER_FANOUT } from "../../src/execution/helpers.ts";
import { grantJobCapabilities } from "../../src/jobs/grants.ts";
import { createJob } from "../../src/jobs/store.ts";

describe("0.1-H helper fan-out (A42)", () => {
  test("cancel parent cancels children", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: [] };

    const parent = await gate.run(
      { capabilityId: "files.list", input: { path: "/tmp/rocket" }, resources: [] },
      policy,
      scope,
      "/tmp/rocket",
    );
    cancelRun(env.db, parent.runId);
    const children = env.db
      .query("SELECT child_run_id FROM helper_runs WHERE parent_run_id = ?")
      .all(parent.runId) as Array<{ child_run_id: string }>;
    for (const child of children) {
      expect(getRun(env.db, child.child_run_id)?.status).toBe("cancelled");
    }
    env.close();
  });

  test("helper fan-out cap enforced", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: [] };
    const parent = await gate.run(
      { capabilityId: "files.list", input: { path: "/tmp/rocket" }, resources: [] },
      policy,
      scope,
      "/tmp/rocket",
    );

    for (let i = 0; i < MAX_HELPER_FANOUT; i++) {
      const { result } = await gate.run(
        {
          capabilityId: "helpers.spawn",
          input: {
            capabilityId: "files.list",
            input: { path: "/tmp/rocket" },
          },
          resources: [],
        },
        policy,
        scope,
        "/tmp/rocket",
        { runId: parent.runId },
      );
      expect(result.ok).toBe(true);
    }

    const blocked = await gate.run(
      {
        capabilityId: "helpers.spawn",
        input: { capabilityId: "files.list", input: { path: "/tmp/rocket" } },
        resources: [],
      },
      policy,
      scope,
      "/tmp/rocket",
      { runId: parent.runId },
    );
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.error?.message).toContain("fan-out");
    expect(countActiveHelpers(env.db, parent.runId)).toBe(0);
    const total = env.db
      .query("SELECT COUNT(*) AS n FROM helper_runs WHERE parent_run_id = ?")
      .get(parent.runId) as { n: number };
    expect(total.n).toBe(MAX_HELPER_FANOUT);
    env.close();
  });

  test("child mutate blocked by parent job grant", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const jobId = "parent-job";
    createJob(env.db, {
      id: jobId,
      ownerId: env.ownerId,
      scope,
      name: "parent",
      schedule: "every:1h",
      status: "active",
    });
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: ["/tmp/rocket"] };
    const parent = await gate.run(
      { capabilityId: "files.list", input: { path: "/tmp/rocket" }, resources: [] },
      policy,
      scope,
      "/tmp/rocket",
      { jobId },
    );

    const child = await gate.run(
      {
        capabilityId: "helpers.spawn",
        input: {
          capabilityId: "files.write",
          input: { path: "/tmp/rocket/child.txt", content: "x" },
        },
        resources: [],
      },
      policy,
      scope,
      "/tmp/rocket",
      { runId: parent.runId, jobId },
    );
    expect(child.result.ok).toBe(false);
    expect(child.result.error?.code).toBe("grant_required");

    grantJobCapabilities(env.db, jobId, { mutate: true });
    const allowed = await gate.run(
      {
        capabilityId: "helpers.spawn",
        input: {
          capabilityId: "files.write",
          input: { path: "/tmp/rocket/child.txt", content: "x" },
        },
        resources: [],
      },
      policy,
      scope,
      "/tmp/rocket",
      { runId: parent.runId, jobId },
    );
    expect(allowed.result.ok).toBe(true);
    const childRow = env.db
      .query("SELECT child_run_id FROM helper_runs WHERE parent_run_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(parent.runId) as { child_run_id: string };
    expect(getRun(env.db, childRow.child_run_id)?.status).toBe("completed");
    env.close();
  });

  test("spawned child run terminalizes after success", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: [] };
    const parent = await gate.run(
      { capabilityId: "files.list", input: { path: "/tmp/rocket" }, resources: [] },
      policy,
      scope,
      "/tmp/rocket",
    );
    const spawned = await gate.run(
      {
        capabilityId: "helpers.spawn",
        input: { capabilityId: "files.list", input: { path: "/tmp/rocket" } },
        resources: [],
      },
      policy,
      scope,
      "/tmp/rocket",
      { runId: parent.runId },
    );
    expect(spawned.result.ok).toBe(true);
    const childId = (spawned.result.output as { childRunId: string }).childRunId;
    expect(getRun(env.db, childId)?.status).toBe("completed");
    env.close();
  });
});
