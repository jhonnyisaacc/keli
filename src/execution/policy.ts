import { resolve, normalize } from "node:path";
import { KeliError } from "../core/errors.ts";

export type ResourcePolicy = {
  readableRoots: string[];
  writableRoots: string[];
};

export function resolveWithinRoots(
  targetPath: string,
  roots: string[],
  cwd = process.cwd(),
): string {
  const resolved = normalize(resolve(cwd, targetPath));
  for (const root of roots) {
    const rootResolved = normalize(resolve(root));
    if (resolved === rootResolved || resolved.startsWith(rootResolved + "/")) {
      return resolved;
    }
  }
  throw new KeliError(
    `Path '${targetPath}' is outside allowed resource roots`,
    "capability_denied",
  );
}

export function assertReadable(policy: ResourcePolicy, targetPath: string, cwd?: string): string {
  return resolveWithinRoots(targetPath, policy.readableRoots, cwd);
}

export function assertWritable(policy: ResourcePolicy, targetPath: string, cwd?: string): string {
  return resolveWithinRoots(targetPath, policy.writableRoots, cwd);
}
