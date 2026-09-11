import { KELI_VERSION } from "../version.ts";
import type { ReleaseManifest } from "./manifest.ts";
import { findArtifact } from "./manifest.ts";
import { detectPlatformArch } from "./paths.ts";
import { readFile } from "node:fs/promises";

export type UpdateCheckResult = {
  current: string;
  latest: string;
  updateAvailable: boolean;
  artifact?: ReleaseManifest["artifacts"][number];
  manifest?: ReleaseManifest;
};

export async function fetchManifest(url: string): Promise<ReleaseManifest> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch release manifest: HTTP ${response.status}`);
  }
  return (await response.json()) as ReleaseManifest;
}

export async function loadManifestFromFile(path: string): Promise<ReleaseManifest> {
  return JSON.parse(await readFile(path, "utf8")) as ReleaseManifest;
}

export async function checkForUpdate(manifestUrl?: string): Promise<UpdateCheckResult> {
  const url = manifestUrl ?? process.env.KELI_UPDATE_MANIFEST_URL;
  if (!url) {
    return {
      current: KELI_VERSION,
      latest: KELI_VERSION,
      updateAvailable: false,
    };
  }

  const manifest = url.startsWith("file://")
    ? await loadManifestFromFile(url.replace("file://", ""))
    : url.startsWith("/")
      ? await loadManifestFromFile(url)
      : await fetchManifest(url);

  const { platform, arch } = detectPlatformArch();
  const artifact = findArtifact(manifest, platform, arch) ?? undefined;
  const updateAvailable = manifest.version !== KELI_VERSION;

  return {
    current: KELI_VERSION,
    latest: manifest.version,
    updateAvailable,
    artifact,
    manifest,
  };
}
