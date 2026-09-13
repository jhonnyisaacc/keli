import { homedir } from "node:os";
import { join } from "node:path";

export function resolveInstallRoot(): string {
  return process.env.KELI_INSTALL_ROOT ?? join(homedir(), ".local", "lib", "keli");
}

export function resolveInstallBin(): string {
  return process.env.KELI_INSTALL_BIN ?? join(homedir(), ".local", "bin", "keli");
}

export function versionDir(version: string): string {
  return join(resolveInstallRoot(), "versions", version);
}

export function currentVersionPointer(): string {
  return join(resolveInstallRoot(), "current-version");
}

export function stagedVersionPointer(): string {
  return join(resolveInstallRoot(), "staged-version");
}

/** The last known-good release retained for rollback. */
export function previousVersionPointer(): string {
  return join(resolveInstallRoot(), "previous-version");
}

export function artifactName(platform: string, arch: string): string {
  const map: Record<string, string> = {
    "linux-x64": "keli-linux-x64",
    "linux-arm64": "keli-linux-arm64",
    "darwin-x64": "keli-darwin-x64",
    "darwin-arm64": "keli-darwin-arm64",
  };
  return map[`${platform}-${arch}`] ?? `keli-${platform}-${arch}`;
}

export function detectPlatformArch(): { platform: string; arch: string } {
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return { platform, arch };
}
