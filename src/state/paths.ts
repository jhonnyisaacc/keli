import { homedir } from "node:os";
import { join } from "node:path";

export function resolveStateDir(override?: string): string {
  if (override ?? process.env.KELI_STATE_DIR) {
    return override ?? process.env.KELI_STATE_DIR!;
  }
  const xdg = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
  return join(xdg, "keli");
}

export function statePaths(stateDir: string) {
  return {
    root: stateDir,
    sqlite: join(stateDir, "state.sqlite"),
    config: join(stateDir, "config.json"),
    cache: join(stateDir, "cache"),
  };
}
