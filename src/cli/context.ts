import { BehaviorService } from "../core/behavior.ts";
import { GateService } from "../core/gate.ts";
import { ModelLoop } from "../model/loop.ts";
import { FixtureModelProvider } from "../model/provider.ts";
import { requireInitialized } from "../state/init.ts";
import { getProjectById, projectScope } from "../state/repos.ts";
import { resolveStateDir } from "../state/paths.ts";

export type CliGlobals = {
  cwd: string;
  stateDir?: string;
  outputFormat: "plain" | "json";
  fixture?: boolean;
  fixtureEndpoint?: string;
};

export async function openApp(globals: CliGlobals) {
  const { stateDir, config, db, owner } = await requireInitialized(globals.stateDir);
  const behavior = new BehaviorService(db, owner.id);
  const gate = new GateService(db, behavior);
  const project = getProjectById(db, config.defaultProjectId);
  if (!project) throw new Error("Default project missing. Run: keli init");

  let provider;
  if (globals.fixtureEndpoint) {
    provider = new FixtureModelProvider(globals.fixtureEndpoint);
  } else if (globals.fixture) {
    throw new Error("Fixture mode requires --fixture-endpoint or internal test harness");
  } else {
    throw new Error("Live providers not configured in 0.1-A. Use --fixture.");
  }

  const loop = new ModelLoop(behavior, gate, provider, project.id, project.name);

  return {
    stateDir: resolveStateDir(stateDir),
    config,
    db,
    owner,
    behavior,
    gate,
    project,
    loop,
    scope: projectScope(project.id),
    close: () => db.close(),
  };
}
