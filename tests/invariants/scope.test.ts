import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { BehaviorService } from "../../src/core/behavior.ts";

describe("A06 A43 scope", () => {
  test("A06 two projects different delegates", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const behavior = env.behavior;
    behavior.reviseCodingDelegate("Other", "OpenCode", {
      actor: "owner",
      source: "test",
      trusted: true,
    });

    const rocket = behavior.getRule(projectScope(env.rocketId), "coding.delegate");
    const other = behavior.getRule(projectScope(env.otherId), "coding.delegate");
    expect(rocket?.value).toBe("Codex");
    expect(other?.value).toBe("OpenCode");
    env.close();
  });

  test("A43 project B cannot read project A rule via scope filter", async () => {
    const env = await createTestEnv();
    env.behavior.reviseCodingDelegate("Rocket", "Codex", {
      actor: "owner",
      trusted: true,
    });
    const otherRule = env.behavior.getRule(projectScope(env.otherId), "coding.delegate");
    expect(otherRule).toBeNull();
    env.close();
  });
});
