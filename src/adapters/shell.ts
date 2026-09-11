import type { CapabilityResult } from "../capabilities/types.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { DisposableWorkspace, runShellInWorkspace } from "../execution/sandbox.ts";
import { KeliError } from "../core/errors.ts";

export async function shellExec(
  input: { command: string; cwd?: string },
  policy: ResourcePolicy,
): Promise<CapabilityResult> {
  const workspace = await DisposableWorkspace.create();
  try {
    const parts = input.command.trim().split(/\s+/);
    if (parts.length === 0) {
      throw new KeliError("Empty command", "invalid_request");
    }

    const result = await runShellInWorkspace(parts, workspace, policy);
    return {
      capabilityId: "shell.exec",
      ok: result.exitCode === 0,
      output: {
        exitCode: result.exitCode,
        stdout: result.stdout.slice(0, 65_536),
        stderr: result.stderr.slice(0, 65_536),
        workspace: workspace.path,
      },
      error:
        result.exitCode === 0
          ? undefined
          : {
              code: "engine_error",
              message: `Command exited ${result.exitCode}`,
              retryable: false,
            },
    };
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: "shell.exec",
      ok: false,
      error: {
        code: keli?.code ?? "unknown",
        message: keli?.message ?? String(e),
        retryable: keli?.retryable ?? false,
      },
    };
  } finally {
    await workspace.destroy();
  }
}
