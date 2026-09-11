import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";

describe("A10 undo", () => {
  test("compensating revision restores prior behavior only", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    await env.loop.runTurn("Rocket changes use OpenCode");

    const undo = await env.loop.runTurn("", { undo: true });
    expect(undo.kind).toBe("correction");
    const rule = env.behavior.getRule(projectScope(env.rocketId), "coding.delegate");
    expect(rule?.value).toBe("Codex");

    const other = env.behavior.getRule(projectScope(env.otherId), "coding.delegate");
    expect(other).toBeNull();
    env.close();
  });
});
