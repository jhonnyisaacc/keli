import { readConfig, writeConfig, type KeliConfig } from "../state/config.ts";
import { resolveStateDir } from "../state/paths.ts";

export type ControlState = NonNullable<KeliConfig["control"]>;

export async function readControl(stateDir?: string): Promise<ControlState> {
  const config = await readConfig(resolveStateDir(stateDir));
  return config?.control ?? {};
}

export function isExecutionBlocked(control: ControlState): boolean {
  return Boolean(control.autonomyPaused || control.stopAllExecution);
}

export function isEffectfulBlocked(control: ControlState): boolean {
  return isExecutionBlocked(control);
}

async function patchControl(
  stateDir?: string,
  patch: Partial<ControlState> = {},
): Promise<ControlState> {
  const dir = resolveStateDir(stateDir);
  const config = (await readConfig(dir)) ?? { version: 1, ownerId: "", defaultProjectId: "" };
  const next = { ...config.control, ...patch };
  await writeConfig({ ...config, control: next }, dir);
  return next;
}

export async function pauseAutonomy(stateDir?: string): Promise<ControlState> {
  return patchControl(stateDir, {
    autonomyPaused: true,
    pausedAt: new Date().toISOString(),
  });
}

export async function stopAllExecution(stateDir?: string): Promise<ControlState> {
  return patchControl(stateDir, {
    autonomyPaused: true,
    stopAllExecution: true,
    pausedAt: new Date().toISOString(),
  });
}

export async function resumeAutonomy(
  stateDir?: string,
  options?: { routesRevalidated?: boolean },
): Promise<ControlState> {
  const current = await readControl(stateDir);
  if (current.restoredAt && !options?.routesRevalidated && !current.routesRevalidated) {
    throw new Error(
      "Restore requires route/grant revalidation before resume. Run `keli routes list` and `keli resume --revalidated`.",
    );
  }
  return patchControl(stateDir, {
    autonomyPaused: false,
    stopAllExecution: false,
    routesRevalidated: options?.routesRevalidated ? true : current.routesRevalidated,
  });
}
