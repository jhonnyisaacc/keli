import { BehaviorService } from "../core/behavior.ts";
import { GateService } from "../core/gate.ts";
import type { CodingDelegate } from "../core/types.ts";
import { ModelLoop } from "../model/loop.ts";
import { DelegateService } from "../model/delegate-service.ts";
import { FixtureModelProvider, type ModelProvider } from "../model/provider.ts";
import { resolveProvider, listProviders } from "../model/provider-registry.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { requireInitialized } from "../state/init.ts";
import { getProjectById, projectScope } from "../state/repos.ts";
import { resolveStateDir } from "../state/paths.ts";
import { isCodingDelegate } from "../core/types.ts";
import { createConversationApp } from "../conversation/app.ts";

export type CliGlobals = {
  cwd: string;
  stateDir?: string;
  outputFormat: "plain" | "json";
  fixture?: boolean;
  fixtureEndpoint?: string;
};

export async function openApp(
  globals: CliGlobals,
  options?: { requireProvider?: boolean },
) {
  const { stateDir, config, db, owner } = await requireInitialized(globals.stateDir);
  const behavior = new BehaviorService(db, owner.id);
  const gate = new GateService(db, behavior);
  const project = getProjectById(db, config.defaultProjectId);
  if (!project) throw new Error("Default project missing. Run: keli init");

  const requireProvider = options?.requireProvider ?? true;
  let provider: ModelProvider | undefined;
  if (globals.fixtureEndpoint) {
    provider = new FixtureModelProvider(globals.fixtureEndpoint);
  } else if (globals.fixture) {
    throw new Error("Fixture mode requires --fixture-endpoint or internal test harness");
  } else if (fixtureUrlFor("model")) {
    provider = resolveProvider("fixture");
  } else if (requireProvider && !listProviders(config).some((p) => p.available)) {
    throw new Error("No provider configured. Run: keli setup provider (or set KELI_FIXTURE_URL for fixtures).");
  }
  // When a configured provider exists, the loop creates it on demand with credentials.

  const scope = projectScope(project.id);
  const roots = JSON.parse(project.resource_roots_json) as string[];
  const workspace = roots[0] ?? globals.cwd;

  let delegateService: DelegateService | undefined;
  const delegateFixture = fixtureUrlFor("delegate");
  if (delegateFixture) {
    const rule = behavior.getRule(scope, "coding.delegate");
    const primary = (config.delegates?.primary ??
      rule?.value ??
      "Codex") as CodingDelegate;
    const fallback = config.delegates?.fallback;
    if (isCodingDelegate(primary)) {
      delegateService = new DelegateService(db, {
        primary,
        fallback: fallback && isCodingDelegate(fallback) ? fallback : undefined,
        fixtureUrl: delegateFixture,
      });
    }
  }

  const loop = new ModelLoop(
    behavior,
    gate,
    project.id,
    project.name,
    provider,
    delegateService,
    workspace,
    config,
  );

  const resolvedStateDir = resolveStateDir(stateDir);
  const conversation = createConversationApp({
    db,
    behavior,
    config,
    stateDir: resolvedStateDir,
    ownerId: owner.id,
    project: { id: project.id, name: project.name, resourceRoots: roots },
    codingLoop: loop,
  });

  return {
    stateDir: resolvedStateDir,
    config,
    db,
    owner,
    behavior,
    gate,
    project,
    loop,
    conversation,
    scope,
    close: () => db.close(),
  };
}
