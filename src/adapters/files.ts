import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { CapabilityResult } from "../capabilities/types.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { assertReadable, assertWritable } from "../execution/policy.ts";
import { KeliError } from "../core/errors.ts";

export async function filesRead(
  input: { path: string },
  policy: ResourcePolicy,
  cwd?: string,
): Promise<CapabilityResult> {
  try {
    const resolved = assertReadable(policy, input.path, cwd);
    const content = await readFile(resolved, "utf8");
    return {
      capabilityId: "files.read",
      ok: true,
      output: { path: resolved, content, bytes: Buffer.byteLength(content) },
    };
  } catch (e) {
    return capabilityError("files.read", e);
  }
}

export async function filesList(
  input: { path: string },
  policy: ResourcePolicy,
  cwd?: string,
): Promise<CapabilityResult> {
  try {
    const resolved = assertReadable(policy, input.path, cwd);
    const entries = await readdir(resolved, { withFileTypes: true });
    return {
      capabilityId: "files.list",
      ok: true,
      output: {
        path: resolved,
        entries: entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "dir" : "file",
        })),
      },
    };
  } catch (e) {
    return capabilityError("files.list", e);
  }
}

export async function filesWrite(
  input: { path: string; content: string },
  policy: ResourcePolicy,
  cwd?: string,
): Promise<CapabilityResult> {
  try {
    const resolved = assertWritable(policy, input.path, cwd);
    await mkdir(dirname(resolved), { recursive: true });
    await writeFile(resolved, input.content, "utf8");
    return {
      capabilityId: "files.write",
      ok: true,
      output: { path: resolved, bytes: Buffer.byteLength(input.content) },
    };
  } catch (e) {
    return capabilityError("files.write", e);
  }
}

function capabilityError(capabilityId: string, error: unknown): CapabilityResult {
  const keli = error instanceof KeliError ? error : null;
  return {
    capabilityId,
    ok: false,
    error: {
      code: keli?.code ?? "unknown",
      message: keli?.message ?? String(error),
      retryable: keli?.retryable ?? false,
    },
  };
}
