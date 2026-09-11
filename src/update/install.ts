import { mkdir, readFile, rename, writeFile, copyFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { KELI_VERSION } from "../version.ts";
import { CURRENT_SCHEMA_VERSION, migrate } from "../state/migrate.ts";
import { resolveStateDir, statePaths } from "../state/paths.ts";
import { readConfig, writeConfig } from "../state/config.ts";
import type { ReleaseManifest } from "./manifest.ts";
import { verifyArtifactChecksum } from "./manifest.ts";
import {
  resolveInstallBin,
  versionDir,
  currentVersionPointer,
  stagedVersionPointer,
} from "./paths.ts";
import { checkForUpdate } from "./check.ts";

export type InstallResult = {
  version: string;
  binaryPath: string;
  previousVersion?: string;
  activated: boolean;
};

async function readPointer(path: string): Promise<string | null> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return null;
  }
}

async function writePointer(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, value + "\n", "utf8");
  await rename(tmp, path);
}

async function snapshotState(stateDir: string): Promise<string> {
  const paths = statePaths(stateDir);
  const backupPath = join(stateDir, "pre-update.sqlite");
  await copyFile(paths.sqlite, backupPath);
  return backupPath;
}

function assertSchemaCompatible(manifest: ReleaseManifest): void {
  if (CURRENT_SCHEMA_VERSION < manifest.schemaReadMin || CURRENT_SCHEMA_VERSION > manifest.schemaReadMax) {
    throw new Error(
      `Incompatible schema: running v${CURRENT_SCHEMA_VERSION}, manifest allows read ${manifest.schemaReadMin}-${manifest.schemaReadMax}`,
    );
  }
}

async function activateBinary(version: string, binaryBytes: Uint8Array): Promise<string> {
  const targetDir = versionDir(version);
  await mkdir(targetDir, { recursive: true });
  const binaryPath = join(targetDir, "keli");
  const tmp = `${binaryPath}.tmp`;
  await writeFile(tmp, binaryBytes);
  await rename(tmp, binaryPath);
  await Bun.spawn(["chmod", "+x", binaryPath]).exited;

  const binLink = resolveInstallBin();
  await mkdir(dirname(binLink), { recursive: true });
  const linkTmp = `${binLink}.tmp`;
  try {
    await rm(linkTmp, { force: true });
  } catch {}
  await copyFile(binaryPath, linkTmp);
  await rename(linkTmp, binLink);

  await writePointer(currentVersionPointer(), version);
  return binaryPath;
}

export async function installUpdate(options?: {
  manifestUrl?: string;
  binaryPath?: string;
  stateDir?: string;
}): Promise<InstallResult> {
  const stateDir = resolveStateDir(options?.stateDir);
  const previousVersion = (await readPointer(currentVersionPointer())) ?? KELI_VERSION;

  let manifest: ReleaseManifest;
  let bytes: Uint8Array;

  if (options?.binaryPath) {
    bytes = new Uint8Array(await readFile(options.binaryPath));
    manifest = {
      version: KELI_VERSION,
      schemaReadMin: 1,
      schemaReadMax: CURRENT_SCHEMA_VERSION,
      schemaWriteMin: 1,
      schemaWriteMax: CURRENT_SCHEMA_VERSION,
      artifacts: [],
      publishedAt: new Date().toISOString(),
    };
  } else {
    const check = await checkForUpdate(options?.manifestUrl);
    if (!check.manifest || !check.artifact) {
      throw new Error("No update artifact available for this platform");
    }
    manifest = check.manifest;
    assertSchemaCompatible(manifest);

    const response = await fetch(check.artifact.url ?? check.manifest.version);
    if (!response.ok && !check.artifact.url) {
      throw new Error(`Artifact download failed: HTTP ${response.status}`);
    }
    bytes = new Uint8Array(await response.arrayBuffer());
    if (!verifyArtifactChecksum(bytes, check.artifact.sha256)) {
      throw new Error("Artifact checksum mismatch");
    }
  }

  assertSchemaCompatible(manifest);
  await writePointer(stagedVersionPointer(), manifest.version);

  const config = await readConfig(stateDir);
  if (config) {
    await snapshotState(stateDir);
    const db = new Database(statePaths(stateDir).sqlite);
    migrate(db, CURRENT_SCHEMA_VERSION);
    db.close();
    await writeConfig(config, stateDir);
  }

  const binaryPath = await activateBinary(manifest.version, bytes);
  return { version: manifest.version, binaryPath, previousVersion, activated: true };
}

export async function rollbackUpdate(stateDir?: string): Promise<{ restored: boolean; reason?: string }> {
  const staged = await readPointer(stagedVersionPointer());
  const current = await readPointer(currentVersionPointer());
  if (!staged || staged === current) {
    return { restored: false, reason: "No staged rollback target" };
  }
  const stagedBinary = join(versionDir(staged), "keli");
  try {
    const bytes = new Uint8Array(await readFile(stagedBinary));
    await activateBinary(staged, bytes);
    const paths = statePaths(resolveStateDir(stateDir));
    const backupPath = join(resolveStateDir(stateDir), "pre-update.sqlite");
    try {
      await copyFile(backupPath, paths.sqlite);
    } catch {}
    return { restored: true };
  } catch (e) {
    return { restored: false, reason: String(e) };
  }
}
