import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { runDiscordCycle } from "../../src/conversation/inbox-handler.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { listTurns } from "../../src/conversation/turns.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";
import { FixtureDiscordBackend } from "../../src/transports/discord-backend.ts";
import { bindTransportRoute } from "../../src/transports/routes.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { ScriptedChatModel, scriptedFactory } from "../fixtures/scripted-model.ts";

describe("Discord conversation cycle", () => {
  test("thread message runs a turn, replies on the same thread, and never replies twice", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-discord-conv-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    createOwner(db, "owner-1");
    createProject(db, "proj-emunah", "owner-1", "emunah", [stateDir]);
    const scope = projectScope("proj-emunah");
    const behavior = new BehaviorService(db, "owner-1");
    const gate = new CapabilityGate(db, defaultRegistry, stateDir, "owner-1");
    const backend = new FixtureDiscordBackend(fixture.endpoint);

    // Two routes: the channel and one thread inside it. Only the thread should get the reply.
    bindTransportRoute(db, { transport: "discord", externalId: "chan-emunah", scope });
    bindTransportRoute(db, { transport: "discord", externalId: "thread:1548168218445873263", scope });

    const model = new ScriptedChatModel([
      { type: "clarify", question: "Which of Augustine's works should I compare: Confessions or City of God?" },
    ]);
    const loop = new ConversationLoop({
      db,
      behavior,
      capabilityGate: gate,
      registry: defaultRegistry,
      policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
      model: scriptedFactory(model),
      options: { retryBaseMs: 1 },
    });

    // A human posts in the thread; a bot (Nancy) also posts and must be ignored.
    await fetch(`${fixture.endpoint}/discord/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "1548168218445873300",
        channelId: "1548168218445873263",
        parentChannelId: "chan-emunah",
        authorId: "david",
        content: "Compare San Agustin with what Eric teaches",
      }),
    });
    await fetch(`${fixture.endpoint}/discord/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "1548168218445873301",
        channelId: "1548168218445873263",
        parentChannelId: "chan-emunah",
        authorId: "nancy",
        authorIsBot: true,
        content: "I'm on it!",
      }),
    });

    const first = await runDiscordCycle(db, { ownerId: "owner-1", backend, loop });
    expect(first.poll.routesPolled).toBe(2);
    expect(first.poll.recorded).toBe(1);
    expect(first.poll.ignored).toBe(1);
    expect(first.inbox.processed).toBe(1);
    expect(first.inbox.replied).toBe(1);
    expect(first.inbox.failed).toBe(0);

    expect(fixture.discord.sent.length).toBe(1);
    expect(fixture.discord.sent[0]!.threadId).toBe("1548168218445873263");
    expect(fixture.discord.sent[0]!.channelId).toBe("chan-emunah");
    expect(fixture.discord.sent[0]!.content).toContain("Confessions or City of God");

    const conversation = db
      .query("SELECT id, external_id, route_id FROM conversations WHERE transport = 'discord'")
      .get() as { id: string; external_id: string; route_id: string | null };
    expect(conversation.external_id).toBe("thread:1548168218445873263");
    expect(conversation.route_id).toBeTruthy();
    expect(listTurns(db, conversation.id).map((t) => t.kind)).toEqual(["message", "clarify"]);

    const outbox = db.query("SELECT status, payload_json FROM outbox_messages").all() as Array<{ status: string; payload_json: string }>;
    expect(outbox.length).toBe(1);
    expect(outbox[0]!.status).toBe("delivered");

    // Second cycle: cursor advanced, nothing new, no model call, no second reply.
    const second = await runDiscordCycle(db, { ownerId: "owner-1", backend, loop });
    expect(second.poll.fetched).toBe(0);
    expect(second.inbox.processed).toBe(0);
    expect(fixture.discord.sent.length).toBe(1);
    expect(model.calls.length).toBe(1);

    // Simulate a lost cursor (restart from an older snapshot): the message is re-fetched,
    // deduplicated by the inbox, and the stored reply is not resent.
    db.run("UPDATE transport_routes SET metadata_json = NULL WHERE external_id = 'thread:1548168218445873263'");
    const third = await runDiscordCycle(db, { ownerId: "owner-1", backend, loop });
    expect(third.poll.fetched).toBe(2);
    expect(third.poll.duplicates).toBe(1);
    expect(third.inbox.processed).toBe(0);
    expect(fixture.discord.sent.length).toBe(1);
    expect(model.calls.length).toBe(1);

    db.close();
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });

  test("handler failure is recorded on the inbox message instead of stalling silently", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-discord-fail-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    createOwner(db, "owner-1");
    createProject(db, "proj-1", "owner-1", "p1", [stateDir]);
    const scope = projectScope("proj-1");
    bindTransportRoute(db, { transport: "discord", externalId: "chan-1", scope });
    const backend = new FixtureDiscordBackend(fixture.endpoint);
    const loop = new ConversationLoop({
      db,
      behavior: new BehaviorService(db, "owner-1"),
      capabilityGate: new CapabilityGate(db, defaultRegistry, stateDir, "owner-1"),
      registry: defaultRegistry,
      policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
      model: async () => {
        throw new Error("provider exploded");
      },
      options: { retryBaseMs: 1 },
    });

    await fetch(`${fixture.endpoint}/discord/inbound`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "42", channelId: "chan-1", content: "hello" }),
    });
    const result = await runDiscordCycle(db, { ownerId: "owner-1", backend, loop });
    expect(result.inbox.processed).toBe(1);
    // The loop turns provider failure into an "error" outcome that is still replied.
    expect(fixture.discord.sent[0]!.content).toContain("Something failed");
    expect(fixture.discord.sent[0]!.content).toContain("provider exploded");

    db.close();
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });
});
