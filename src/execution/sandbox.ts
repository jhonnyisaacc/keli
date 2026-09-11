import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KeliError } from "../core/errors.ts";
import type { ResourcePolicy } from "./policy.ts";
import { createSandboxRunner, getSandboxBackend, type SandboxRunner } from "./backends.ts";

export type SandboxBackend = {
  platform: string;
  available: boolean;
  reason?: string;
  landlockAbi?: number;
};

export type ShellResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function probeSandbox(): Promise<SandboxBackend> {
  return getSandboxBackend();
}

export class DisposableWorkspace {
  readonly path: string;

  private constructor(path: string) {
    this.path = path;
  }

  static async create(prefix = "keli-work-"): Promise<DisposableWorkspace> {
    const path = await mkdtemp(join(tmpdir(), prefix));
    return new DisposableWorkspace(path);
  }

  async destroy(): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }
}

export async function runShellInWorkspace(
  command: string[],
  workspace: DisposableWorkspace,
  policy: ResourcePolicy,
  runner?: SandboxRunner,
  timeoutMs = 60_000,
): Promise<ShellResult> {
  const sandbox = runner ?? await createSandboxRunner();
  if (!sandbox.backend.available) {
    throw new KeliError(
      `Sandbox unavailable: ${sandbox.backend.reason ?? sandbox.backend.platform}`,
      "sandbox_denied",
    );
  }

  return sandbox.run(
    command,
    workspace.path,
    policy.readableRoots,
    timeoutMs,
  );
}
