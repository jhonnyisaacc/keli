import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { conversationInboxHandler } from "../../src/conversation/inbox-handler.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";
import { consumePairing, issuePairingCode, pairingExpiresAt, pairingPhrase } from "../../src/transports/pairing.ts";
import type { PairingChallenge } from "../../src/transports/pairing.ts";
import { ScriptedChatModel, scriptedFactory } from "../fixtures/scripted-model.ts";

describe("inbox pairing route binding", () => {
  test("the pairing code is bound to one transport route and consumed in memory", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-pair-inbox-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    createOwner(db, "owner-1");
    createProject(db, "proj", "owner-1", "personal", [stateDir]);
    const loop = new ConversationLoop({
      db,
      behavior: new BehaviorService(db, "owner-1"),
      capabilityGate: new CapabilityGate(db, defaultRegistry, stateDir, "owner-1"),
      registry: defaultRegistry,
      policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
      model: scriptedFactory(new ScriptedChatModel([{ type: "answer", text: "hello", citations: [], attributions: [] }])),
    });
    const code = issuePairingCode();
    const challenge: PairingChallenge = {
      transport: "telegram",
      externalId: "chat-1",
      code,
      expiresAt: pairingExpiresAt(),
    };
    const verified: PairingChallenge[] = [];
    const handler = conversationInboxHandler(db, "owner-1", loop, undefined, {
      challenge,
      onVerified: (next) => {
        verified.push(next);
      },
    });
    const conversation = {
      id: "conv-1",
      scope: projectScope("proj"),
      createdAt: new Date().toISOString(),
    };
    const phrase = pairingPhrase(code);
    const discord = await handler(
      {
        id: "in-1",
        transport: "discord",
        dedupeKey: "d1",
        payload: { text: phrase, authorId: "actor-discord" },
        createdAt: new Date().toISOString(),
      },
      { id: "r-d", transport: "discord", externalId: "chan-1", scope: projectScope("proj"), createdAt: new Date().toISOString() },
      conversation,
    );
    expect(discord?.reply).not.toContain("Pairing confirmed");
    expect(challenge.verifiedAt).toBeUndefined();
    expect(verified).toHaveLength(0);

    const first = await handler(
      {
        id: "in-2",
        transport: "telegram",
        dedupeKey: "t1",
        payload: { text: phrase, authorId: "actor-one" },
        createdAt: new Date().toISOString(),
      },
      { id: "r-t", transport: "telegram", externalId: "chat-1", scope: projectScope("proj"), createdAt: new Date().toISOString() },
      conversation,
    );
    expect(first?.reply).toContain("Pairing confirmed");
    expect(challenge.verifiedAt).toBeTruthy();
    expect(challenge.pairedActorId).toBe("actor-one");
    expect(verified).toHaveLength(1);

    const reuse = await handler(
      {
        id: "in-3",
        transport: "telegram",
        dedupeKey: "t2",
        payload: { text: phrase, authorId: "actor-two" },
        createdAt: new Date().toISOString(),
      },
      { id: "r-t", transport: "telegram", externalId: "chat-1", scope: projectScope("proj"), createdAt: new Date().toISOString() },
      conversation,
    );
    expect(reuse?.reply).not.toContain("Pairing confirmed");
    expect(challenge.pairedActorId).toBe("actor-one");
    expect(verified).toHaveLength(1);
    expect(consumePairing(challenge, "actor-two").pairedActorId).toBe("actor-one");

    db.close();
    await rm(stateDir, { recursive: true, force: true });
  });
});
