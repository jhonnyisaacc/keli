import { structuredToolDescriptors } from "../tools/profiles.ts";
import type { Database } from "bun:sqlite";
import { CapabilityRegistry } from "../capabilities/registry.ts";
import type { BehaviorService } from "../core/behavior.ts";
import { CapabilityGate } from "../core/capability-gate.ts";
import { KeliError } from "../core/errors.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { isChatModelProvider } from "../model/chat-provider.ts";
import type { ModelLoop } from "../model/loop.ts";
import { createModelProvider } from "../model/provider-factory.ts";
import { createSourceReader } from "../sources/reader.ts";
import type { KeliConfig } from "../state/config.ts";
import { ConversationLoop, type ChatModelFactory } from "./loop.ts";
import type { TurnContext } from "./types.ts";

export type ConversationAppInput = {
  db: Database;
  behavior: BehaviorService;
  config: KeliConfig;
  stateDir: string;
  ownerId: string;
  project: { id: string; name: string; resourceRoots: string[] };
  codingLoop?: ModelLoop;
  networkHosts?: string[];
};

/** Chat-capable provider from saved config and credentials; fixtures are not chat providers. */
export function chatModelFactory(config: KeliConfig): ChatModelFactory {
  return async () => {
    const created = await createModelProvider({ config });
    if (!isChatModelProvider(created.provider)) {
      throw new KeliError(
        `${created.providerId} does not support chat completions; configure an OpenAI-compatible provider for research turns`,
        "capability_unavailable",
      );
    }
    return { provider: created.provider, providerId: created.providerId, model: created.model, costKnown: created.costKnown };
  };
}

export function policyFor(roots: string[], stateDir: string): ResourcePolicy {
  const readable = [...new Set([...roots, stateDir])];
  return { readableRoots: readable, writableRoots: roots };
}

/** Assembles the conversation loop from app context; the only place CLI/transports build it. */
export function createConversationApp(input: ConversationAppInput) {
  // Per-app registration keeps configured tools discoverable without leaking into other projects.
  const registry = new CapabilityRegistry();
  for (const descriptor of structuredToolDescriptors(input.config)) {
    if (!registry.get(descriptor.id) || descriptor.id === "tools.rocket") registry.register(descriptor);
  }
  const capabilityGate = new CapabilityGate(input.db, registry, input.stateDir, input.ownerId);
  const policy = policyFor(input.project.resourceRoots, input.stateDir);
  const sources = createSourceReader(input.db);
  const fixtures = {
    search: fixtureUrlFor("search"),
    browser: fixtureUrlFor("browser"),
    mcp: fixtureUrlFor("mcp"),
    delegate: fixtureUrlFor("delegate"),
  };
  const loop = new ConversationLoop({
    db: input.db,
    behavior: input.behavior,
    capabilityGate,
    registry,
    policy,
    model: chatModelFactory(input.config),
    config: input.config,
    sources,
    networkHosts: input.networkHosts ?? input.config.network?.allowedHosts,
    fixtures,
    codingLoop: input.codingLoop,
    options: { retryBaseMs: input.config.budgets?.retryBaseMs },
  });
  const cliContext = (conversationId: string): TurnContext => ({
    ownerId: input.ownerId,
    projectId: input.project.id,
    projectName: input.project.name,
    scope: `project:${input.project.id}`,
    conversationId,
    origin: { transport: "cli" },
  });
  return { loop, capabilityGate, policy, sources, cliContext };
}
