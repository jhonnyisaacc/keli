import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export type ReleaseArtifact = {
  name: string;
  platform: string;
  arch: string;
  sha256: string;
  size: number;
  url?: string;
};

export type ReleaseManifest = {
  version: string;
  gitSha?: string;
  bunVersion?: string;
  schemaReadMin: number;
  schemaReadMax: number;
  schemaWriteMin: number;
  schemaWriteMax: number;
  artifacts: ReleaseArtifact[];
  publishedAt: string;
};

export async function sha256File(path: string): Promise<string> {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

export function verifyArtifactChecksum(bytes: Uint8Array, expected: string): boolean {
  const actual = createHash("sha256").update(bytes).digest("hex");
  return actual === expected;
}

export function findArtifact(
  manifest: ReleaseManifest,
  platform: string,
  arch: string,
): ReleaseArtifact | null {
  return manifest.artifacts.find((a) => a.platform === platform && a.arch === arch) ?? null;
}
