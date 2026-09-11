import { describe, expect, test } from "bun:test";
import { GateService } from "../../src/core/gate.ts";
import { ModelLoop } from "../../src/model/loop.ts";
import { DelegateService } from "../../src/model/delegate-service.ts";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";

describe("A37 delegate fallback", () => {
  test("uses fallback delegate after primary failure with fencing", async () => {
    const integration = startIntegrationFixture();
    process.env.KELI_FIXTURE_FAIL_CODEX = "1";
    process.env.KELI_DELEGATE_FIXTURE_URL = integration.endpoint;

    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    await env.loop.runTurn("Rocket changes use Codex");

    const delegateService = new DelegateService(env.db, {
      primary: "Codex",
      fallback: "OpenCode",
      fixtureUrl: integration.endpoint,
    });
    const loop = new ModelLoop(
      env.behavior,
      env.gate,
      env.rocketId,
      "Rocket",
      undefined,
      delegateService,
      "/tmp/rocket",
    );

    const result = await loop.runTurn("Perform the next Rocket coding action.");
    expect(result.kind).toBe("action");
    expect(result.message).toContain("OpenCode");
    expect(result.message).toContain("fallback");
    expect(env.gate.listEffects().length).toBe(1);

    delete process.env.KELI_FIXTURE_FAIL_CODEX;
    delete process.env.KELI_DELEGATE_FIXTURE_URL;
    integration.stop();
    env.close();
  });

  test("honors sole configured delegate without silent alternative", async () => {
    const integration = startIntegrationFixture();
    process.env.KELI_FIXTURE_FAIL_CODEX = "1";

    const env = await createTestEnv();
    const delegateService = new DelegateService(env.db, {
      primary: "Codex",
      fixtureUrl: integration.endpoint,
    });
    const gate = new GateService(env.db, env.behavior);
    const loop = new ModelLoop(
      env.behavior,
      gate,
      env.rocketId,
      "Rocket",
      undefined,
      delegateService,
      "/tmp/rocket",
    );
    await loop.runTurn("Rocket changes use Codex");

    const result = await loop.runTurn("Perform the next Rocket coding action.");
    expect(result.kind).not.toBe("action");
    expect(env.gate.listEffects().length).toBe(0);

    delete process.env.KELI_FIXTURE_FAIL_CODEX;
    integration.stop();
    env.close();
  });
});
