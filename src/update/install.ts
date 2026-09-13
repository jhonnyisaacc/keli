import { mkdir, readFile, rename, writeFile, copyFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { KELI_VERSION } from "../version.ts";
import { CURRENT_SCHEMA_VERSION, getSchemaVersion, migrate } from "../state/migrate.ts";
import { resolveStateDir, statePaths } from "../state/paths.ts";
import { readConfig, writeConfig, type KeliConfig } from "../state/config.ts";
import type { ReleaseManifest } from "./manifest.ts";
import { verifyArtifactChecksum } from "./manifest.ts";
import {
  resolveInstallBin,
  versionDir,
  currentVersionPointer,
  stagedVersionPointer,
  previousVersionPointer,
  detectPlatformArch,
} from "./paths.ts";
import { checkForUpdate } from "./check.ts";

export type InstallResult = {
  version: string;
  binaryPath: string;
  previousVersion?: string;
  /** Whether the previous release binary is retained for rollback. */
  rollbackAvailable: boolean;
  backupPath?: string;
  activated: boolean;
};

export type UpdateOutcome = NonNullable<KeliConfig["update"]>["last"];

async function readPointer(path: string): Promise<string | null> {
  try {
    return (await readFile(path, "utf8")).trim() || null;
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

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/** SQLite-consistent snapshot (WAL-safe) of the live database before any migration runs. */
async function snapshotState(stateDir: string): Promise<string> {
  const paths = statePaths(stateDir);
  const backupPath = join(stateDir, "pre-update.sqlite");
  await rm(backupPath, { force: true });
  const source = new Database(paths.sqlite, { readonly: true });
  try {
    source.run("VACUUM INTO ?", [backupPath]);
  } finally {
    source.close();
  }
  return backupPath;
}

/**
 * Pre-activation check: migrate a throwaway copy of the snapshot and run an integrity check so
 * the live database is only touched after the migration path is known to succeed on this data.
 */
async function rehearseMigration(backupPath: string): Promise<{ from: number; to: number }> {
  const rehearsal = `${backupPath}.rehearsal`;
  await rm(rehearsal, { force: true });
  await copyFile(backupPath, rehearsal);
  const db = new Database(rehearsal);
  try {
    const from = getSchemaVersion(db);
    migrate(db, CURRENT_SCHEMA_VERSION);
    const integrity = db.query("PRAGMA integrity_check").get() as { integrity_check: string };
    if (integrity.integrity_check !== "ok") {
      throw new Error(`Migration rehearsal failed integrity check: ${integrity.integrity_check}`);
    }
    return { from, to: getSchemaVersion(db) };
  } finally {
    db.close();
    await rm(rehearsal, { force: true });
    await rm(`${rehearsal}-wal`, { force: true });
    await rm(`${rehearsal}-shm`, { force: true });
  }
}

export function assertSchemaCompatible(manifest: ReleaseManifest, dbSchemaVersion?: number): void {
  if (CURRENT_SCHEMA_VERSION < manifest.schemaReadMin || CURRENT_SCHEMA_VERSION > manifest.schemaReadMax) {
    throw new Error(
      `Incompatible schema: running v${CURRENT_SCHEMA_VERSION}, manifest allows read ${manifest.schemaReadMin}-${manifest.schemaReadMax}`,
    );
  }
  if (dbSchemaVersion !== undefined && (dbSchemaVersion < manifest.schemaWriteMin || dbSchemaVersion > manifest.schemaWriteMax)) {
    throw new Error(
      `Incompatible schema: state is v${dbSchemaVersion}, candidate ${manifest.version} writes ${manifest.schemaWriteMin}-${manifest.schemaWriteMax}`,
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
  await rm(linkTmp, { force: true });
  await copyFile(binaryPath, linkTmp);
  await rename(linkTmp, binLink);

  await writePointer(currentVersionPointer(), version);
  return binaryPath;
}

/**
 * Rollback bookkeeping repair: the previously working release must survive activation. If the
 * running binary was installed by bootstrap (no versions/ entry), copy it into place first.
 */
async function retainPreviousRelease(previousVersion: string): Promise<boolean> {
  const retained = join(versionDir(previousVersion), "keli");
  if (await exists(retained)) return true;
  const binLink = resolveInstallBin();
  if (!(await exists(binLink))) return false;
  await mkdir(dirname(retained), { recursive: true });
  await copyFile(binLink, retained);
  return true;
}

export async function recordUpdateOutcome(stateDir: string, outcome: NonNullable<UpdateOutcome>, patch: Partial<NonNullable<KeliConfig["update"]>> = {}): Promise<void> {
  const config = await readConfig(stateDir);
  if (!config) return;
  await writeConfig({ ...config, update: { ...(config.update ?? {}), ...patch, last: outcome } }, stateDir);
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
      const { platform, arch } = detectPlatformArch();
      throw new Error(`No update artifact available for ${platform}-${arch}`);
    }
    manifest = check.manifest;
    assertSchemaCompatible(manifest);
    if (!check.artifact.url) throw new Error("Release artifact has no download url");

    const url = check.artifact.url;
    if (url.startsWith("file://")) {
      bytes = new Uint8Array(await readFile(url.slice("file://".length)));
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Artifact download failed: HTTP ${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (check.artifact.size && bytes.byteLength !== check.artifact.size) {
      throw new Error(`Artifact size mismatch: expected ${check.artifact.size} bytes, got ${bytes.byteLength}`);
    }
    if (!verifyArtifactChecksum(bytes, check.artifact.sha256)) {
      throw new Error("Artifact checksum mismatch");
    }
  }

  const config = await readConfig(stateDir);
  let backupPath: string | undefined;
  if (config) {
    const paths = statePaths(stateDir);
    const live = new Database(paths.sqlite, { readonly: true });
    const dbSchema = getSchemaVersion(live);
    live.close();
    assertSchemaCompatible(manifest, dbSchema);
  } else {
    assertSchemaCompatible(manifest);
  }

  // Staged = "activation in progress". Cleared once the current pointer moves.
  await writePointer(stagedVersionPointer(), manifest.version);
  const rollbackAvailable = await retainPreviousRelease(previousVersion);

  try {
    if (config) {
      backupPath = await snapshotState(stateDir);
      await rehearseMigration(backupPath);
      const db = new Database(statePaths(stateDir).sqlite);
      try {
        migrate(db, CURRENT_SCHEMA_VERSION);
      } finally {
        db.close();
      }
    }

    const binaryPath = await activateBinary(manifest.version, bytes);
    if (rollbackAvailable) await writePointer(previousVersionPointer(), previousVersion);
    await rm(stagedVersionPointer(), { force: true });
    await recordUpdateOutcome(stateDir, {
      at: new Date().toISOString(),
      outcome: "installed",
      version: manifest.version,
      detail: `from ${previousVersion}${rollbackAvailable ? "; rollback retained" : "; no rollback binary"}`,
    });
    return { version: manifest.version, binaryPath, previousVersion, rollbackAvailable, backupPath, activated: true };
  } catch (e) {
    await rm(stagedVersionPointer(), { force: true });
    await recordUpdateOutcome(stateDir, {
      at: new Date().toISOString(),
      outcome: "failed",
      version: manifest.version,
      detail: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export type RollbackResult = {
  restored: boolean;
  reason?: string;
  version?: string;
  stateRestored?: boolean;
};

/**
 * Roll back to the retained previous release and the pre-update state snapshot. Binary and
 * state move together: the previous binary may not understand the migrated schema.
 */
export async function rollbackUpdate(stateDir?: string): Promise<RollbackResult> {
  const previous = await readPointer(previousVersionPointer());
  const current = await readPointer(currentVersionPointer());
  if (!previous || previous === current) {
    return { restored: false, reason: "No previous release retained for rollback" };
  }
  const previousBinary = join(versionDir(previous), "keli");
  if (!(await exists(previousBinary))) {
    return { restored: false, reason: `Previous release binary missing: ${previousBinary}` };
  }
  try {
    const bytes = new Uint8Array(await readFile(previousBinary));
    await activateBinary(previous, bytes);
    const dir = resolveStateDir(stateDir);
    const paths = statePaths(dir);
    const backupPath = join(dir, "pre-update.sqlite");
    let stateRestored = false;
    if (await exists(backupPath)) {
      await rm(`${paths.sqlite}-wal`, { force: true });
      await rm(`${paths.sqlite}-shm`, { force: true });
      await copyFile(backupPath, paths.sqlite);
      stateRestored = true;
    }
    // The release we just left becomes the rollback target, so a rollback can itself be undone.
    if (current) await writePointer(previousVersionPointer(), current);
    await recordUpdateOutcome(dir, {
      at: new Date().toISOString(),
      outcome: "installed",
      version: previous,
      detail: `rolled back from ${current ?? "unknown"}${stateRestored ? "; state restored from pre-update snapshot" : ""}`,
    });
    return { restored: true, version: previous, stateRestored };
  } catch (e) {
    return { restored: false, reason: String(e) };
  }
}
