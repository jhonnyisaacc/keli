import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { migrate } from "../../src/state/migrate.ts";
import { projectScope } from "../../src/state/repos.ts";
import { bindTransportRoute } from "../../src/transports/routes.ts";
import { recordTelegramUpdate } from "../../src/transports/telegram.ts";
import { recordDiscordUpdate } from "../../src/transports/discord.ts";
import { processTransportInbox } from "../../src/transports/inbox-processor.ts";

describe("transport inbox and routes", () => {
  test("queues unprocessed updates until processTransportInbox", () => {
    const db = new Database(":memory:");
    migrate(db);
    const scope = projectScope("proj-1");
    bindTransportRoute(db, {
      transport: "discord",
      externalId: "chan-42",
      scope,
    });

    recordDiscordUpdate(db, {
      updateId: "d-1",
      channelId: "chan-42",
      payload: { text: "hi" },
    });

    const pending = db
      .query("SELECT COUNT(*) AS n FROM transport_inbox WHERE processed_at IS NULL")
      .get() as { n: number };
    expect(pending.n).toBe(1);

    const result = processTransportInbox(db);
    expect(result.processed).toBe(1);

    const done = db
      .query("SELECT processed_at, scope FROM transport_inbox WHERE dedupe_key = ?")
      .get("d-1") as { processed_at: string; scope: string };
    expect(done.processed_at).toBeTruthy();
    expect(done.scope).toBe(scope);
  });

  test("telegram topic route resolves scoped inbox processing (A18)", () => {
    const db = new Database(":memory:");
    migrate(db);
    const scope = projectScope("proj-telegram");
    bindTransportRoute(db, {
      transport: "telegram",
      externalId: "chat-9:topic-3",
      scope,
      metadata: { chatId: "chat-9", topicId: "topic-3" },
    });

    recordTelegramUpdate(db, {
      updateId: "tg-topic-1",
      chatId: "chat-9",
      topicId: "topic-3",
      payload: { text: "topic message" },
    });

    const result = processTransportInbox(db);
    expect(result.processed).toBe(1);

    const row = db
      .query("SELECT scope, processed_at FROM transport_inbox WHERE dedupe_key = ?")
      .get("tg-topic-1") as { scope: string; processed_at: string };
    expect(row.scope).toBe(scope);
    expect(row.processed_at).toBeTruthy();
    db.close();
  });
});
