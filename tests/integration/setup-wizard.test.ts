import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readConfig } from "../../src/state/config.ts";
import { runSetup } from "../../src/setup/wizard.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { Database } from "bun:sqlite";
import { migrate } from "../../src/state/migrate.ts";
import { listTransportRoutes } from "../../src/transports/routes.ts";

describe("setup wizard", () => {
  test("non-interactive discord setup binds route and records config", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-discord-"));
    const result = await runSetup({
      stateDir,
      nonInteractive: true,
      transport: "discord",
      discordChannel: "chan-setup",
      skipTransportTest: true,
      skipCalibration: true,
    });

    expect(result.routeBound).toBe(true);
    expect(result.transport).toBe("discord");

    const config = await readConfig(stateDir);
    expect(config?.setup?.completedAt).toBeTruthy();
    expect(config?.setup?.transport).toBe("discord");
    expect(config?.transports?.discord?.channelId).toBe("chan-setup");

    const db = new Database(join(stateDir, "state.sqlite"));
    migrate(db);
    const routes = listTransportRoutes(db, "discord");
    expect(routes.some((r) => r.externalId === "chan-setup")).toBe(true);
    db.close();

    await rm(stateDir, { recursive: true, force: true });
  });

  test("non-interactive telegram setup can send fixture test message", async () => {
    const fixture = startIntegrationFixture();
    const prev = process.env.KELI_TELEGRAM_FIXTURE_URL;
    process.env.KELI_TELEGRAM_FIXTURE_URL = fixture.endpoint;

    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-telegram-"));
    const result = await runSetup({
      stateDir,
      nonInteractive: true,
      transport: "telegram",
      telegramChat: "chat-setup",
      telegramTopic: "topic-1",
      skipCalibration: true,
    });

    expect(result.transportTested).toBe(true);
    expect(result.transport).toBe("telegram");

    const config = await readConfig(stateDir);
    expect(config?.transports?.telegram?.chatId).toBe("chat-setup");
    expect(config?.transports?.telegram?.topicId).toBe("topic-1");

    fixture.stop();
    process.env.KELI_TELEGRAM_FIXTURE_URL = prev;
    await rm(stateDir, { recursive: true, force: true });
  });
});
