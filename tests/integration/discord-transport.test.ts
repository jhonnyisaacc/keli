import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { projectScope } from "../../src/state/repos.ts";
import { sendDiscordMessage, recordDiscordUpdate } from "../../src/transports/discord.ts";
import { processTransportInbox } from "../../src/transports/inbox-processor.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";

describe("Discord transport stub", () => {
  test("send enqueues outbox and marks delivered via fixture", async () => {
    const fixture = startIntegrationFixture();
    const prev = process.env.KELI_DISCORD_FIXTURE_URL;
    process.env.KELI_DISCORD_FIXTURE_URL = fixture.endpoint;

    const stateDir = await mkdtemp(join(tmpdir(), "keli-discord-send-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    const scope = projectScope("proj-1");

    const result = await sendDiscordMessage(db, {
      channelId: "chan-1",
      message: "hello keli",
      scope,
    });
    expect(result.delivered).toBe(true);
    expect(result.messageId).toMatch(/^discord-/);

    const outbox = db
      .query("SELECT status FROM outbox_messages WHERE id = ?")
      .get(result.outboxId) as { status: string };
    expect(outbox.status).toBe("delivered");

    db.close();
    fixture.stop();
    process.env.KELI_DISCORD_FIXTURE_URL = prev;
    await rm(stateDir, { recursive: true, force: true });
  });

  test("send marks outbox failed on transport error", async () => {
    const fixture = startIntegrationFixture();
    const prevUrl = process.env.KELI_DISCORD_FIXTURE_URL;
    const prevFail = process.env.KELI_FIXTURE_FAIL_DISCORD;
    process.env.KELI_DISCORD_FIXTURE_URL = fixture.endpoint;
    process.env.KELI_FIXTURE_FAIL_DISCORD = "1";

    const stateDir = await mkdtemp(join(tmpdir(), "keli-discord-fail-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    const scope = projectScope("proj-1");

    await expect(
      sendDiscordMessage(db, {
        channelId: "chan-1",
        message: "will fail",
        scope,
      }),
    ).rejects.toThrow("Discord fixture HTTP 503");

    const row = db
      .query("SELECT status, payload_json FROM outbox_messages LIMIT 1")
      .get() as { status: string; payload_json: string };
    expect(row.status).toBe("failed");
    expect(JSON.parse(row.payload_json).failureReason).toContain("503");

    db.close();
    fixture.stop();
    process.env.KELI_DISCORD_FIXTURE_URL = prevUrl;
    process.env.KELI_FIXTURE_FAIL_DISCORD = prevFail;
    await rm(stateDir, { recursive: true, force: true });
  });

  test("inbox deduplicates Discord update_id and processes on demand", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-discord-inbox-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    const scope = projectScope("proj-1");

    const first = recordDiscordUpdate(db, {
      updateId: "upd-100",
      channelId: "chan-1",
      scope,
      payload: { text: "first" },
    });
    const second = recordDiscordUpdate(db, {
      updateId: "upd-100",
      channelId: "chan-1",
      scope,
      payload: { text: "duplicate" },
    });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const pending = db
      .query("SELECT COUNT(*) AS n FROM transport_inbox WHERE processed_at IS NULL")
      .get() as { n: number };
    expect(pending.n).toBe(1);

    const processed = await processTransportInbox(db);
    expect(processed.processed).toBe(1);

    const count = db
      .query("SELECT COUNT(*) AS n FROM transport_inbox WHERE dedupe_key = ?")
      .get("upd-100") as { n: number };
    expect(count.n).toBe(1);

    db.close();
    await rm(stateDir, { recursive: true, force: true });
  });
});
