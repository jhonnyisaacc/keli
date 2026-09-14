import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";
import { ScriptedChatModel, scriptedFactory } from "../fixtures/scripted-model.ts";
import type { TurnContext } from "../../src/conversation/types.ts";

let stateDir: string;
let db: Database;
let behavior: BehaviorService;
let gate: CapabilityGate;
const OWNER = "owner-1";

function ctx(conversationId: string, mode: TurnContext["mode"] = "ordinary"): TurnContext {
  return {
    ownerId: OWNER,
    projectId: "proj",
    projectName: "personal",
    scope: projectScope("proj"),
    conversationId,
    origin: { transport: "cli" },
    mode,
  };
}

beforeAll(async () => {
  stateDir = await mkdtemp(join(tmpdir(), "keli-mode-"));
  db = new Database(join(stateDir, "state.sqlite"), { create: true });
  migrate(db);
  createOwner(db, OWNER);
  createProject(db, "proj", OWNER, "personal", [stateDir]);
  behavior = new BehaviorService(db, OWNER);
  gate = new CapabilityGate(db, defaultRegistry, stateDir, OWNER);
});

afterAll(async () => {
  db.close();
  await rm(stateDir, { recursive: true, force: true });
});

describe("ordinary vs research conversation", () => {
  test("a greeting still answers after a required-collection correction", async () => {
    const loop = new ConversationLoop({
      db,
      behavior,
      capabilityGate: gate,
      registry: defaultRegistry,
      policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
      model: scriptedFactory(new ScriptedChatModel([])),
    });
    const correction = await loop.runTurn(ctx("conv-greet-1"), "personal research must cite keli-docs");
    expect(correction.kind).toBe("correction");

    const chat = new ConversationLoop({
      db,
      behavior,
      capabilityGate: gate,
      registry: defaultRegistry,
      policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
      model: scriptedFactory(
        new ScriptedChatModel([{ type: "answer", text: "Hello — I can help with this project.", citations: [], attributions: [] }]),
      ),
    });
    const greeting = await chat.runTurn(ctx("conv-greet-2"), "hi");
    expect(greeting.kind).toBe("answer");
    expect(greeting.text).toContain("Hello");
  });

  test("attributed answers and research watches still require collections", async () => {
    const chat = new ConversationLoop({
      db,
      behavior,
      capabilityGate: gate,
      registry: defaultRegistry,
      policy: { readableRoots: [stateDir], writableRoots: [stateDir] },
      model: scriptedFactory(
        new ScriptedChatModel([
          {
            type: "answer",
            text: "The docs say X.",
            citations: [],
            attributions: [{ subject: "Keli", claim: "X", sourceIds: [] }],
          },
          {
            type: "answer",
            text: "The docs say X.",
            citations: [],
            attributions: [{ subject: "Keli", claim: "X", sourceIds: [] }],
          },
        ]),
      ),
      options: { evidenceRetries: 1, retryBaseMs: 1 },
    });
    const outcome = await chat.runTurn(ctx("conv-attr"), "What does Keli claim?");
    expect(outcome.kind).toBe("missing_evidence");
  });
});
