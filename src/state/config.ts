import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { statePaths, resolveStateDir } from "./paths.ts";

export type KeliConfig = {
  version: number;
  ownerId: string;
  defaultProjectId: string;
  primaryModel?: string;
  fallbackModel?: string;
};

const DEFAULT_CONFIG: KeliConfig = {
  version: 1,
  ownerId: "",
  defaultProjectId: "",
};

export async function readConfig(stateDir?: string): Promise<KeliConfig | null> {
  const paths = statePaths(resolveStateDir(stateDir));
  const file = Bun.file(paths.config);
  if (!(await file.exists())) return null;
  return (await file.json()) as KeliConfig;
}

export async function writeConfig(config: KeliConfig, stateDir?: string): Promise<void> {
  const paths = statePaths(resolveStateDir(stateDir));
  await mkdir(dirname(paths.config), { recursive: true });
  const tmp = `${paths.config}.tmp`;
  await Bun.write(tmp, JSON.stringify(config, null, 2) + "\n");
  await Bun.write(paths.config, await Bun.file(tmp).arrayBuffer());
  const { unlink } = await import("node:fs/promises");
  await unlink(tmp).catch(() => {});
}

export function defaultConfig(): KeliConfig {
  return { ...DEFAULT_CONFIG };
}
