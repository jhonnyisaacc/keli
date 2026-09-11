import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { selectProviderForTurn } from "../../src/model/routing.ts";
import { consumeRequestBudget, DEFAULT_REQUESTS_MAX } from "../../src/core/budgets.ts";
import { createRun, getRun } from "../../src/core/run-control.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { createJob } from "../../src/jobs/store.ts";
import { grantJobCapabilities } from "../../src/jobs/grants.ts";
import {
  pinSkillVersion,
  listSkillIndex,
  activateSkill,
  rollbackSkill,
} from "../../src/skills/store.ts";

describe("0.1-G routing, budgets, skills, recurring writes", () => {
  test("routing table selects role mapping", () => {
    const provider = selectProviderForTurn(
      { cheap: "fixture", strong: "openai-compatible", task: "grok" },
      "action",
      "fixture",
    );
    expect(provider).toBe("grok");
    const correction = selectProviderForTurn({ strong: "openai-compatible" }, "correction", "fixture");
    expect(correction).toBe("openai-compatible");
  });

  test("request budget exhaust blocks run", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const runId = createRun(env.db, scope, 1_048_576, { requestsMax: 1 });
    consumeRequestBudget(env.db, runId);
    expect(() => consumeRequestBudget(env.db, runId)).toThrow(/request budget/i);
    env.close();
  });

  test("100 dummy skills keep compact index under full content (A41)", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    for (let i = 0; i < 100; i++) {
      const content = "x".repeat(10_000);
      pinSkillVersion(env.db, {
        id: `skill-${i}`,
        version: 1,
        scope,
        source: "fixture",
        content,
      });
    }
    const index = listSkillIndex(env.db, scope);
    const indexBytes = JSON.stringify(index).length;
    const inlinedBytes = 100 * 10_000;
    expect(indexBytes).toBeLessThan(inlinedBytes * 0.1);
    expect(index.every((row) => row.summary.length <= 80)).toBe(true);
    env.close();
  });

  test("mutate job blocked until grant", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const jobId = "mutate-job";
    createJob(env.db, {
      id: jobId,
      ownerId: env.ownerId,
      scope,
      name: "mutate",
      schedule: "every:1h",
      status: "active",
    });
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const blocked = await gate.run(
      { capabilityId: "files.write", input: { path: "/tmp/rocket/x", content: "y" }, resources: [] },
      { readableRoots: ["/tmp/rocket"], writableRoots: ["/tmp/rocket"] },
      scope,
      "/tmp/rocket",
      { jobId },
    );
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.error?.code).toBe("grant_required");

    grantJobCapabilities(env.db, jobId, { mutate: true });
    const allowed = await gate.run(
      { capabilityId: "files.write", input: { path: "/tmp/rocket/x", content: "y" }, resources: [] },
      { readableRoots: ["/tmp/rocket"], writableRoots: ["/tmp/rocket"] },
      scope,
      "/tmp/rocket",
      { jobId },
    );
    expect(allowed.result.ok).toBe(true);
    env.close();
  });

  test("durable skill activate and rollback", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    pinSkillVersion(env.db, { id: "lint", version: 1, scope, source: "local", content: "v1" });
    pinSkillVersion(env.db, { id: "lint", version: 2, scope, source: "local", content: "v2" });
    activateSkill(env.db, "lint", scope, 2);
    rollbackSkill(env.db, "lint", scope, 1);
    const active = env.db
      .query("SELECT version FROM skill_pins WHERE id = 'lint' AND activation_status = 'active'")
      .get() as { version: number };
    expect(active.version).toBe(1);
    env.close();
  });

  test("default requests max matches PRD baseline", async () => {
    expect(DEFAULT_REQUESTS_MAX).toBe(20);
    const env = await createTestEnv();
    const runId = createRun(env.db, projectScope(env.rocketId));
    expect(getRun(env.db, runId)?.requests_max).toBe(20);
    env.close();
  });
});
