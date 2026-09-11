import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";
import { resolveStateDir, statePaths } from "../state/paths.ts";
import { readConfig } from "../state/config.ts";
import { CURRENT_SCHEMA_VERSION, getSchemaVersion } from "../state/migrate.ts";

export type BackupManifest = {
  version: string;
  keliVersion: string;
  schemaVersion: number;
  createdAt: string;
  includesCredentials: false;
  sqliteSha256: string;
  configSha256: string;
};

export async function createBackup(
  stateDir?: string,
  outDir?: string,
): Promise<{ path: string; manifest: BackupManifest }> {
  const dir = resolveStateDir(stateDir);
  const paths = statePaths(dir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = outDir ?? join(dir, "backups", `keli-backup-${stamp}`);
  await mkdir(target, { recursive: true });

  const sqliteOut = join(target, "state.sqlite");
  const configOut = join(target, "config.json");
  const source = new Database(paths.sqlite, { readonly: true });
  source.run(`VACUUM INTO ?`, [sqliteOut]);
  source.close();

  const config = await readConfig(dir);
  if (!config) throw new Error("Cannot backup: config.json missing");
  const sanitized = { ...config };
  delete (sanitized as { credentials?: unknown }).credentials;
  await writeFile(configOut, JSON.stringify(sanitized, null, 2) + "\n");

  const sqliteSha256 = createHash("sha256")
    .update(await readFile(sqliteOut))
    .digest("hex");
  const configSha256 = createHash("sha256")
    .update(await readFile(configOut))
    .digest("hex");

  const manifest: BackupManifest = {
    version: "0.1.0",
    keliVersion: process.env.KELI_VERSION ?? "0.1.0",
    schemaVersion: getSchemaVersion(new Database(sqliteOut, { readonly: true })),
    createdAt: new Date().toISOString(),
    includesCredentials: false,
    sqliteSha256,
    configSha256,
  };
  await writeFile(join(target, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return { path: target, manifest };
}

export async function verifyBackupManifest(backupPath: string): Promise<BackupManifest> {
  const manifestPath = join(backupPath, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as BackupManifest;
  if (manifest.includesCredentials) {
    throw new Error("Backup manifest claims credentials included; refusing restore");
  }
  const sqliteSha256 = createHash("sha256")
    .update(await readFile(join(backupPath, "state.sqlite")))
    .digest("hex");
  const configSha256 = createHash("sha256")
    .update(await readFile(join(backupPath, "config.json")))
    .digest("hex");
  if (sqliteSha256 !== manifest.sqliteSha256 || configSha256 !== manifest.configSha256) {
    throw new Error("Backup checksum mismatch");
  }
  if (manifest.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Backup schema v${manifest.schemaVersion} newer than runtime v${CURRENT_SCHEMA_VERSION}`,
    );
  }
  return manifest;
}

export async function restoreBackup(
  backupPath: string,
  stateDir?: string,
): Promise<{ stateDir: string; manifest: BackupManifest }> {
  const manifest = await verifyBackupManifest(backupPath);
  const dir = resolveStateDir(stateDir);
  const paths = statePaths(dir);
  await mkdir(dirname(paths.sqlite), { recursive: true });

  const preRestore = join(dir, `pre-restore-${Date.now()}.sqlite`);
  try {
    await copyFile(paths.sqlite, preRestore);
  } catch {}

  await copyFile(join(backupPath, "state.sqlite"), paths.sqlite);
  const config = JSON.parse(await readFile(join(backupPath, "config.json"), "utf8")) as Record<
    string,
    unknown
  >;
  config.control = {
    autonomyPaused: true,
    stopAllExecution: true,
    restoredAt: new Date().toISOString(),
    routesRevalidated: false,
  };
  await writeFile(paths.config, JSON.stringify(config, null, 2) + "\n");

  const db = new Database(paths.sqlite);
  db.run("UPDATE jobs SET status = 'paused'");
  db.close();

  return { stateDir: dir, manifest };
}
