import { describe, expect, test } from "bun:test";
import { createTestEnv, reopenDb, projectScope } from "../helpers/setup.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { GateService } from "../../src/core/gate.ts";

describe("restart recovery", () => {
  test("prepared action becomes interrupted on restart", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const scope = projectScope(env.rocketId);
    const prepared = env.gate.prepare("pending action", scope, "coding.delegate");
    expect(prepared.id).toBeTruthy();

    env.db.close();
    const db = reopenDb(env.stateDir);
    const row = db
      .query("SELECT status, reason FROM actions WHERE id = ?")
      .get(prepared.id) as { status: string; reason: string };
    expect(row.status).toBe("interrupted");
    expect(row.reason).toContain("restart");
    db.close();
    env.fixture.stop();
  });

  test("no false success for interrupted action", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const scope = projectScope(env.rocketId);
    const prepared = env.gate.prepare("pending", scope, "coding.delegate");
    env.db.close();

    const db = reopenDb(env.stateDir);
    const effectsBefore = db.query("SELECT COUNT(*) AS n FROM effects").get() as { n: number };
    const action = db.query("SELECT status FROM actions WHERE id = ?").get(prepared.id) as {
      status: string;
    };
    expect(action.status).not.toBe("executed");
    expect(effectsBefore.n).toBe(0);
    db.close();
    env.fixture.stop();
  });
});
