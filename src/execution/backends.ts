import type { SandboxBackend, ShellResult } from "./sandbox.ts";
import { probeLandlock, runLandlocked } from "./linux-landlock.ts";

export type SandboxRunner = {
  backend: SandboxBackend;
  run(
    command: string[],
    workspace: string,
    readonlyRoots: string[],
    timeoutMs?: number,
  ): Promise<ShellResult>;
};

let cachedProbe: SandboxBackend | null = null;

export async function getSandboxBackend(): Promise<SandboxBackend> {
  if (cachedProbe) return cachedProbe;

  if (process.platform === "linux") {
    const landlock = await probeLandlock();
    cachedProbe = {
      platform: "linux",
      available: landlock.available,
      reason: landlock.available ? undefined : landlock.error ?? "landlock unavailable",
      landlockAbi: landlock.landlock_abi,
    };
    return cachedProbe;
  }

  if (process.platform === "darwin") {
    cachedProbe = {
      platform: "darwin",
      available: false,
      reason: "macOS sandbox backend not available in 0.1-B; shell execution fails closed",
    };
    return cachedProbe;
  }

  cachedProbe = {
    platform: process.platform,
    available: false,
    reason: "unsupported platform",
  };
  return cachedProbe;
}

export async function createSandboxRunner(): Promise<SandboxRunner> {
  const backend = await getSandboxBackend();
  return {
    backend,
    async run(command, workspace, readonlyRoots, timeoutMs) {
      if (!backend.available) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: backend.reason ?? "sandbox unavailable",
        };
      }
      return runLandlocked(command, workspace, readonlyRoots, timeoutMs);
    },
  };
}

/** Test helper: reset cached probe between tests. */
export function resetSandboxProbeCache(): void {
  cachedProbe = null;
}
