import { describe, expect, test } from "bun:test";
import { createTestEnv, reopenDb, projectScope } from "../helpers/setup.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { GateService } from "../../src/core/gate.ts";
import { ModelLoop } from "../../src/model/loop.ts";
import { FixtureModelProvider } from "../../src/model/provider.ts";

describe("A01-A03 corrections", () => {
  test("A01 teach Rocket changes use Codex", async () => {
    const env = await createTestEnv();
    const result = await env.loop.runTurn("Rocket changes use Codex");
    expect(result.kind).toBe("correction");
    expect(result.rule?.value).toBe("Codex");
    const rule = env.behavior.getRule(projectScope(env.rocketId), "coding.delegate");
    expect(rule?.value).toBe("Codex");
    env.close();
  });

  test("A03 survives restart", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    env.db.close();

    const db = reopenDb(env.stateDir);
    const behavior = new BehaviorService(db, env.ownerId);
    const rule = behavior.getRule(projectScope(env.rocketId), "coding.delegate");
    expect(rule?.value).toBe("Codex");
    expect(rule?.revision).toBe(1);
    db.close();
    env.fixture.stop();
  });

  test("A05 run override does not change durable rule", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const override = await env.loop.runTurn("Use OpenCode only this time");
    expect(override.kind).toBe("action");
    const rule = env.behavior.getRule(projectScope(env.rocketId), "coding.delegate");
    expect(rule?.value).toBe("Codex");
    env.close();
  });
});
