import { Database } from "bun:sqlite";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { recoverInterruptedActions } from "../../src/state/db.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";
import { writeConfig, defaultConfig } from "../../src/state/config.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { GateService } from "../../src/core/gate.ts";
import { ModelLoop } from "../../src/model/loop.ts";
import { FixtureModelProvider } from "../../src/model/provider.ts";
import { startFixtureProvider, type FixtureServer } from "../fixtures/provider.ts";

export type TestEnv = {
  stateDir: string;
  db: Database;
  ownerId: string;
  rocketId: string;
  otherId: string;
  behavior: BehaviorService;
  gate: GateService;
  loop: ModelLoop;
  fixture: FixtureServer;
  provider: FixtureModelProvider;
  close: () => void;
};

export async function createTestEnv(): Promise<TestEnv> {
  const stateDir = await mkdtemp(join(tmpdir(), "keli-test-"));
  const dbPath = join(stateDir, "state.sqlite");
  const db = new Database(dbPath, { create: true });
  migrate(db);
  recoverInterruptedActions(db);

  const ownerId = crypto.randomUUID();
  const rocketId = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  createOwner(db, ownerId);
  createProject(db, rocketId, ownerId, "Rocket", ["/tmp/rocket"]);
  createProject(db, otherId, ownerId, "Other", ["/tmp/other"]);

  await writeConfig(
    { ...defaultConfig(), ownerId, defaultProjectId: rocketId },
    stateDir,
  );

  const fixture = startFixtureProvider();
  const provider = new FixtureModelProvider(fixture.endpoint);
  const behavior = new BehaviorService(db, ownerId);
  const gate = new GateService(db, behavior);
  const loop = new ModelLoop(behavior, gate, provider, rocketId, "Rocket");

  return {
    stateDir,
    db,
    ownerId,
    rocketId,
    otherId,
    behavior,
    gate,
    loop,
    fixture,
    provider,
    close: () => {
      db.close();
      fixture.stop();
    },
  };
}

export function reopenDb(stateDir: string): Database {
  const dbPath = join(stateDir, "state.sqlite");
  const db = new Database(dbPath);
  migrate(db);
  recoverInterruptedActions(db);
  return db;
}

export { projectScope };
