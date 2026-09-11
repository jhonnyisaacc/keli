import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { projectScope } from "../../src/state/repos.ts";
import { sendTelegramMessage, recordTelegramUpdate } from "../../src/transports/telegram.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";

describe("Telegram transport stub", () => {
  test("send enqueues outbox and marks delivered via fixture", async () => {
    const fixture = startIntegrationFixture();
    const prev = process.env.KELI_TELEGRAM_FIXTURE_URL;
    process.env.KELI_TELEGRAM_FIXTURE_URL = fixture.endpoint;

    const stateDir = await mkdtemp(join(tmpdir(), "keli-telegram-send-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    const scope = projectScope("proj-1");

    const result = await sendTelegramMessage(db, {
      chatId: "chat-1",
      topicId: "topic-9",
      message: "hello keli",
      scope,
    });
    expect(result.delivered).toBe(true);
    expect(result.messageId).toMatch(/^telegram-/);

    const outbox = db
      .query("SELECT status, destination FROM outbox_messages WHERE id = ?")
      .get(result.outboxId) as { status: string; destination: string };
    expect(outbox.status).toBe("delivered");
    expect(outbox.destination).toBe("telegram:chat-1:topic-9");

    db.close();
    fixture.stop();
    process.env.KELI_TELEGRAM_FIXTURE_URL = prev;
    await rm(stateDir, { recursive: true, force: true });
  });

  test("inbox deduplicates Telegram update_id (A18)", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-telegram-inbox-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    const scope = projectScope("proj-1");

    const first = recordTelegramUpdate(db, {
      updateId: "tg-100",
      chatId: "chat-1",
      topicId: "topic-1",
      scope,
      payload: { text: "first" },
    });
    const second = recordTelegramUpdate(db, {
      updateId: "tg-100",
      chatId: "chat-1",
      topicId: "topic-1",
      scope,
      payload: { text: "duplicate" },
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const count = db
      .query("SELECT COUNT(*) AS n FROM transport_inbox WHERE dedupe_key = ?")
      .get("tg-100") as { n: number };
    expect(count.n).toBe(1);

    db.close();
    await rm(stateDir, { recursive: true, force: true });
  });
});
