import { mkdir } from "node:fs/promises";
import { openDatabase } from "./db.ts";
import { writeConfig, defaultConfig, readConfig } from "./config.ts";
import { resolveStateDir, statePaths } from "./paths.ts";
import { createOwner, createProject, getOwner } from "./repos.ts";

export type InitResult = {
  stateDir: string;
  ownerId: string;
  projectId: string;
  projectName: string;
  created: boolean;
};

export async function initializeState(
  stateDir?: string,
  options?: { projectName?: string; cwd?: string },
): Promise<InitResult> {
  const dir = resolveStateDir(stateDir);
  const paths = statePaths(dir);
  await mkdir(paths.root, { recursive: true });
  await mkdir(paths.cache, { recursive: true });

  const existing = await readConfig(dir);
  if (existing?.ownerId) {
    const db = openDatabase(dir);
    const owner = getOwner(db);
    db.close();
    if (!owner) throw new Error("Config exists but owner record missing");
    return {
      stateDir: dir,
      ownerId: existing.ownerId,
      projectId: existing.defaultProjectId,
      projectName: options?.projectName ?? "Rocket",
      created: false,
    };
  }

  const ownerId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const projectName = options?.projectName ?? "Rocket";
  const cwd = options?.cwd ?? process.cwd();

  const db = openDatabase(dir);
  createOwner(db, ownerId);
  createProject(db, projectId, ownerId, projectName, [cwd]);
  db.close();

  await writeConfig(
    {
      ...defaultConfig(),
      ownerId,
      defaultProjectId: projectId,
    },
    dir,
  );

  return { stateDir: dir, ownerId, projectId, projectName, created: true };
}

export async function requireInitialized(stateDir?: string) {
  const dir = resolveStateDir(stateDir);
  const config = await readConfig(dir);
  if (!config?.ownerId) {
    throw new Error("Keli is not initialized. Run: keli init");
  }
  const db = openDatabase(dir);
  const owner = getOwner(db);
  if (!owner) {
    db.close();
    throw new Error("Owner record missing. Run: keli init");
  }
  return { stateDir: dir, config, db, owner };
}
