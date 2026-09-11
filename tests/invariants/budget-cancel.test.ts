import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { cancelRun, getRun } from "../../src/core/run-control.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";

describe("budget and cancellation", () => {
  test("run budget blocks oversized capability output", async () => {
    const fixture = startIntegrationFixture();
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: [] };

    const { result, runId } = await gate.run(
      { capabilityId: "http.fetch", input: { url: `${fixture.endpoint}/page` }, resources: [] },
      policy,
      scope,
      undefined,
      {
        networkHosts: ["127.0.0.1"],
        fixtures: { search: fixture.endpoint },
        budgetBytesMax: 1,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("quota_exceeded");
    expect(getRun(env.db, runId)?.status).toBe("failed");
    fixture.stop();
    env.close();
  });

  test("cancelled run terminalizes capability action as blocked", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: ["/tmp/rocket"] };

    const { runId } = await gate.run(
      { capabilityId: "files.list", input: { path: "/tmp/rocket" }, resources: [] },
      policy,
      scope,
      "/tmp/rocket",
    );
    cancelRun(env.db, runId);

    const { actionId, result } = await gate.run(
      { capabilityId: "files.list", input: { path: "/tmp/rocket" }, resources: [] },
      policy,
      scope,
      "/tmp/rocket",
      { runId },
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("cancelled");
    expect(gate.terminalStatus(actionId)).toBe("blocked");
    env.close();
  });

  test("cancelRun bumps epoch for active run", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: [] };

    const first = await gate.run(
      { capabilityId: "files.list", input: { path: "/tmp/rocket" }, resources: [] },
      policy,
      scope,
      "/tmp/rocket",
    );
    cancelRun(env.db, first.runId);
    const row = getRun(env.db, first.runId);
    expect(row?.cancel_epoch).toBeGreaterThan(0);
    expect(row?.status).toBe("cancelled");
    env.close();
  });
});
