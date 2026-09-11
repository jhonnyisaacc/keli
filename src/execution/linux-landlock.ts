import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import type { ShellResult } from "./sandbox.ts";

function resolveWorkerPath(): string {
  const besideBinary = join(dirname(process.execPath), "landlock-worker.py");
  if (existsSync(besideBinary)) return besideBinary;
  const besideSource = join(dirname(fileURLToPath(import.meta.url)), "landlock-worker.py");
  if (existsSync(besideSource)) return besideSource;
  return besideSource;
}

export type LandlockProbe = {
  available: boolean;
  landlock_abi?: number;
  platform: string;
  error?: string;
};

export async function probeLandlock(): Promise<LandlockProbe> {
  if (process.platform !== "linux") {
    return { available: false, platform: process.platform, error: "not linux" };
  }
  try {
    const proc = Bun.spawn(["python3", resolveWorkerPath(), "--probe"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      return { available: false, platform: "linux", error: err || `exit ${code}` };
    }
    return JSON.parse(await new Response(proc.stdout).text()) as LandlockProbe;
  } catch (e) {
    return { available: false, platform: "linux", error: String(e) };
  }
}

export async function runLandlocked(
  command: string[],
  workspace: string,
  readonlyRoots: string[],
  timeoutMs = 60_000,
): Promise<ShellResult> {
  const proc = Bun.spawn(["python3", resolveWorkerPath()], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  proc.stdin.write(
    JSON.stringify({ command, workspace, readonly_roots: readonlyRoots }) + "\n",
  );
  proc.stdin.end();

  const result = await Promise.race([
    proc.exited.then(async (code) => ({
      timedOut: false,
      code,
      stdout: await new Response(proc.stdout).text(),
      stderr: await new Response(proc.stderr).text(),
    })),
    new Promise<{ timedOut: boolean; code: number; stdout: string; stderr: string }>(
      (resolve) =>
        setTimeout(() => {
          proc.kill();
          resolve({ timedOut: true, code: 124, stdout: "", stderr: "timeout" });
        }, timeoutMs),
    ),
  ]);

  if (result.timedOut) {
    return { exitCode: 124, stdout: "", stderr: "command timed out" };
  }

  if (result.code !== 0) {
    return {
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr || "landlock worker failed",
    };
  }

  const payload = JSON.parse(result.stdout) as ShellResult;
  return payload;
}
