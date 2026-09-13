import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { ModelLoop } from "../../src/model/loop.ts";
import { listRequestUsage } from "../../src/core/budgets.ts";
import { defaultConfig } from "../../src/state/config.ts";

describe("budgets enforced per attempt", () => {
  test("every retry is accounted and no-progress terminalizes the action", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const loop = new ModelLoop(env.behavior, env.gate, env.rocketId, "Rocket", env.provider, undefined, "/tmp", null, {
      retryBaseMs: 0,
    });

    const result = await loop.runTurn("perform", { mode: "http" });
    expect(result.kind).toBe("blocked");
    expect(result.message).toContain("no progress");

    const runs = env.db.query("SELECT id, status, requests_used FROM runs ORDER BY created_at DESC LIMIT 1").get() as {
      id: string;
      status: string;
      requests_used: number;
    };
    expect(runs.status).toBe("failed");
    expect(runs.requests_used).toBe(3);
    const usage = listRequestUsage(env.db, runs.id);
    expect(usage.length).toBe(3);
    expect(usage.map((u) => u.attempt)).toEqual([1, 2, 3]);
    expect(usage.every((u) => u.outcome === "error")).toBe(true);
    env.close();
  });

  test("token cap blocks before the first request and cost stays visibly unknown", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const config = { ...defaultConfig(), ownerId: env.ownerId, defaultProjectId: env.rocketId, budgets: { tokensMax: 1 } };
    const loop = new ModelLoop(env.behavior, env.gate, env.rocketId, "Rocket", env.provider, undefined, "/tmp", config, {
      retryBaseMs: 0,
    });
    const result = await loop.runTurn("perform");
    expect(result.kind).toBe("blocked");
    expect(result.message).toMatch(/token budget/i);
    expect(result.costUnknown).toBe(true);
    const run = env.db.query("SELECT status FROM runs ORDER BY created_at DESC LIMIT 1").get() as { status: string };
    expect(run.status).toBe("failed");
    expect(env.gate.listEffects().length).toBe(0);
    env.close();
  });

  test("successful turn reconciles reservation and completes the run", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const result = await env.loop.runTurn("perform");
    expect(result.kind).toBe("action");
    const run = env.db
      .query("SELECT status, requests_used, tokens_used FROM runs WHERE scope = ? ORDER BY created_at DESC LIMIT 1")
      .get(projectScope(env.rocketId)) as { status: string; requests_used: number; tokens_used: number };
    expect(run.status).toBe("completed");
    expect(run.requests_used).toBe(1);
    expect(run.tokens_used).toBeGreaterThan(0);
    env.close();
  });
});
