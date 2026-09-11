import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { CapabilityRegistry } from "../../src/capabilities/registry.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import type { CapabilityDescriptor } from "../../src/capabilities/types.ts";

describe("capability gate truth", () => {
  test("denied capability action stays blocked, not executed", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: [] };

    const { actionId, result } = await gate.run(
      { capabilityId: "files.read", input: { path: "/etc/passwd" }, resources: ["/etc"] },
      policy,
      scope,
    );

    expect(result.ok).toBe(false);
    expect(gate.terminalStatus(actionId)).toBe("blocked");

    const row = env.db
      .query("SELECT status FROM actions WHERE id = ?")
      .get(actionId) as { status: string };
    expect(row.status).not.toBe("executed");
    env.close();
  });

  test("dispatch failure still terminalizes prepared action", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const unwired: CapabilityDescriptor = {
      id: "test.unwired",
      version: "0.0.0",
      summary: "test",
      actionClass: "read",
      resources: [],
      schema: { type: "object", properties: {}, required: [] },
    };
    const registry = new CapabilityRegistry([...defaultRegistry.index().map((c) => defaultRegistry.get(c.id)!), unwired]);
    const gate = new CapabilityGate(env.db, registry, env.stateDir, env.ownerId);
    const policy = { readableRoots: ["/tmp/rocket"], writableRoots: [] };

    const { actionId, result } = await gate.run(
      { capabilityId: "test.unwired", input: {}, resources: [] },
      policy,
      scope,
    );

    expect(result.ok).toBe(false);
    expect(gate.terminalStatus(actionId)).toBe("blocked");
    env.close();
  });

  test("provider-style error cannot become executed status", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const actionId = gate.prepare(
      { capabilityId: "files.read", input: { path: "x" }, resources: [] },
      scope,
    );

    const result = await gate.finish(actionId, {
      capabilityId: "files.read",
      ok: false,
      error: { code: "capability_denied", message: "denied" },
    });

    expect(result.ok).toBe(false);
    expect(gate.terminalStatus(actionId)).toBe("blocked");
    env.close();
  });
});
