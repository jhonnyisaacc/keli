import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";
import { bindTransportRoute } from "../../src/transports/routes.ts";
import { pollTelegramRoutes, sendTelegramMessage } from "../../src/transports/telegram.ts";
import { RestTelegramBackend } from "../../src/transports/telegram-backend.ts";
import { runTelegramCycle } from "../../src/conversation/inbox-handler.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { ScriptedChatModel, scriptedFactory } from "../fixtures/scripted-model.ts";

describe("Telegram Bot API backend", () => {
  test("REST sendMessage and getUpdates connect to inbox/outbox (A18)", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-tg-rest-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    createOwner(db, "owner-1");
    createProject(db, "proj-1", "owner-1", "personal", [stateDir]);
    const scope = projectScope("proj-1");
    bindTransportRoute(db, { transport: "telegram", externalId: "100", scope });
    const backend = new RestTelegramBackend("fixture", fixture.endpoint);

    const sent = await sendTelegramMessage(
      db,
      { chatId: "100", message: "hello", scope },
      backend,
    );
    expect(sent.delivered).toBe(true);
    expect(fixture.telegram.sent[0]?.content).toBe("hello");

    await fetch(`${fixture.endpoint}/telegram/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updateId: "5", chatId: "100", content: "ping", authorId: "7" }),
    });
    const poll = await pollTelegramRoutes(db, backend);
    expect(poll.recorded).toBe(1);
    expect(poll.duplicates).toBe(0);
    const again = await pollTelegramRoutes(db, backend);
    expect(again.recorded).toBe(0);

    db.close();
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });

  test("conversation cycle replies on the same chat/topic", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-tg-cycle-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    createOwner(db, "owner-1");
    createProject(db, "proj-1", "owner-1", "personal", [stateDir]);
    const scope = projectScope("proj-1");
    bindTransportRoute(db, { transport: "telegram", externalId: "100:9", scope });
    const backend = new RestTelegramBackend("fixture", fixture.endpoint);
    const behavior = new BehaviorService(db, "owner-1");
    const gate = new CapabilityGate(db, defaultRegistry, stateDir, "owner-1");
    const model = new ScriptedChatModel([{ type: "clarify", question: "Which topic?" }]);
    const loop = new ConversationLoop({
      db,
      behavior,
      capabilityGate: gate,
      registry: defaultRegistry,
      policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
      model: scriptedFactory(model),
      options: { retryBaseMs: 1 },
    });

    await fetch(`${fixture.endpoint}/telegram/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        updateId: "8",
        chatId: "100",
        topicId: "9",
        content: "hello keli",
        authorId: "7",
      }),
    });

    const cycle = await runTelegramCycle(db, { ownerId: "owner-1", backend, loop });
    expect(cycle.poll.recorded).toBe(1);
    expect(cycle.inbox.replied).toBe(1);
    expect(fixture.telegram.sent.some((s) => s.chatId === "100" && s.topicId === "9")).toBe(true);

    db.close();
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });
});
