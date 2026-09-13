import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRun, finishRun } from "../../src/core/run-control.ts";
import { pauseAutonomy, resumeAutonomy } from "../../src/ops/control.ts";
import { readConfig, writeConfig } from "../../src/state/config.ts";
import { CURRENT_SCHEMA_VERSION, migrate } from "../../src/state/migrate.ts";
import { statePaths } from "../../src/state/paths.ts";
import { installUpdate, rollbackUpdate } from "../../src/update/install.ts";
import { currentVersionPointer, previousVersionPointer, stagedVersionPointer } from "../../src/update/paths.ts";
import { idleReport, runScheduledUpdate } from "../../src/update/policy.ts";

let root: string;
let stateDir: string;
let db: Database;
const prevEnv: Record<string, string | undefined> = {};

async function writeManifest(version: string, binaryContent: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const bin = join(root, `bin-${version}`);
  await writeFile(bin, binaryContent);
  const bytes = await readFile(bin);
  const manifest = {
    version,
    schemaReadMin: 1,
    schemaReadMax: CURRENT_SCHEMA_VERSION,
    schemaWriteMin: 1,
    schemaWriteMax: CURRENT_SCHEMA_VERSION,
    artifacts: [
      {
        name: "keli-linux-x64",
        platform: process.platform === "darwin" ? "darwin" : "linux",
        arch: process.arch === "arm64" ? "arm64" : "x64",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size: bytes.byteLength,
        url: `file://${bin}`,
      },
    ],
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
  const path = join(root, `manifest-${version}.json`);
  await writeFile(path, JSON.stringify(manifest));
  return path;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "keli-update-"));
  stateDir = join(root, "state");
  await mkdir(join(root, "bin"), { recursive: true });
  await mkdir(stateDir, { recursive: true });
  for (const key of ["KELI_INSTALL_ROOT", "KELI_INSTALL_BIN", "KELI_UPDATE_MANIFEST_URL"]) prevEnv[key] = process.env[key];
  process.env.KELI_INSTALL_ROOT = join(root, "lib");
  process.env.KELI_INSTALL_BIN = join(root, "bin", "keli");
  delete process.env.KELI_UPDATE_MANIFEST_URL;
  // A bootstrap-installed binary with no versions/ entry: the historical rollback gap.
  await writeFile(process.env.KELI_INSTALL_BIN, "bootstrap-binary");

  db = new Database(statePaths(stateDir).sqlite, { create: true });
  migrate(db);
  await writeConfig({ version: 2, ownerId: "owner-1", defaultProjectId: "proj-1" }, stateDir);
});

afterEach(async () => {
  db.close();
  for (const [key, value] of Object.entries(prevEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
});

describe("install and rollback bookkeeping", () => {
  test("install retains the previous release, snapshots state, and rollback restores both", async () => {
    const manifest = await writeManifest("0.2.0", "new-binary");
    const result = await installUpdate({ manifestUrl: manifest, stateDir });
    expect(result.activated).toBe(true);
    expect(result.rollbackAvailable).toBe(true);
    expect(result.backupPath).toBe(join(stateDir, "pre-update.sqlite"));

    expect((await readFile(currentVersionPointer(), "utf8")).trim()).toBe("0.2.0");
    expect((await readFile(previousVersionPointer(), "utf8")).trim()).toBe("0.1.0");
    await expect(readFile(stagedVersionPointer(), "utf8")).rejects.toThrow();
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("new-binary");
    expect(await readFile(join(process.env.KELI_INSTALL_ROOT!, "versions", "0.1.0", "keli"), "utf8")).toBe("bootstrap-binary");

    const recorded = (await readConfig(stateDir))!.update!.last!;
    expect(recorded.outcome).toBe("installed");
    expect(recorded.version).toBe("0.2.0");
    expect(recorded.detail).toContain("rollback retained");

    // Mutate state after the update, then roll back: binary and state move together.
    db.run("INSERT INTO owners(id, created_at) VALUES ('post-update', ?)", [new Date().toISOString()]);
    db.close();
    const rollback = await rollbackUpdate(stateDir);
    expect(rollback).toMatchObject({ restored: true, version: "0.1.0", stateRestored: true });
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("bootstrap-binary");
    expect((await readFile(currentVersionPointer(), "utf8")).trim()).toBe("0.1.0");
    expect((await readFile(previousVersionPointer(), "utf8")).trim()).toBe("0.2.0");

    db = new Database(statePaths(stateDir).sqlite);
    const owners = db.query("SELECT COUNT(*) AS n FROM owners WHERE id = 'post-update'").get() as { n: number };
    expect(owners.n).toBe(0);
  });

  test("rollback without a retained release fails closed", async () => {
    const rollback = await rollbackUpdate(stateDir);
    expect(rollback.restored).toBe(false);
    expect(rollback.reason).toContain("No previous release");
  });

  test("checksum, size, and schema mismatches leave the current release untouched and are recorded", async () => {
    const bad = await writeManifest("0.3.0", "evil", { schemaWriteMin: CURRENT_SCHEMA_VERSION + 5, schemaWriteMax: CURRENT_SCHEMA_VERSION + 6 });
    await expect(installUpdate({ manifestUrl: bad, stateDir })).rejects.toThrow(/Incompatible schema/);
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("bootstrap-binary");

    const tampered = await writeManifest("0.3.1", "payload");
    const manifest = JSON.parse(await readFile(tampered, "utf8"));
    manifest.artifacts[0].sha256 = "00".repeat(32);
    await writeFile(tampered, JSON.stringify(manifest));
    await expect(installUpdate({ manifestUrl: tampered, stateDir })).rejects.toThrow(/checksum mismatch/);
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("bootstrap-binary");
    await expect(readFile(stagedVersionPointer(), "utf8")).rejects.toThrow();
  });
});

describe("scheduled update policy", () => {
  test("off does nothing, even with an update available", async () => {
    const manifest = await writeManifest("0.2.0", "new-binary");
    const config = (await readConfig(stateDir))!;
    await writeConfig({ ...config, update: { mode: "off", manifestUrl: manifest } }, stateDir);
    const result = await runScheduledUpdate({ db, stateDir });
    expect(result.outcome).toBe("off");
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("bootstrap-binary");
  });

  test("notify announces a new version once and respects the daily interval", async () => {
    const manifest = await writeManifest("0.2.0", "new-binary");
    const config = (await readConfig(stateDir))!;
    await writeConfig({ ...config, update: { mode: "notify", manifestUrl: manifest } }, stateDir);
    const messages: string[] = [];
    const notify = async (t: string) => {
      messages.push(t);
    };
    const t0 = new Date("2026-09-13T10:00:00Z");

    const first = await runScheduledUpdate({ db, stateDir, notify, now: t0 });
    expect(first.outcome).toBe("available");
    expect(first.notified).toBe(true);
    expect(messages[0]).toContain("0.2.0 is available");

    const soon = await runScheduledUpdate({ db, stateDir, notify, now: new Date(t0.getTime() + 60_000) });
    expect(soon.outcome).toBe("checked-recently");

    const nextDay = await runScheduledUpdate({ db, stateDir, notify, now: new Date(t0.getTime() + 25 * 3_600_000) });
    expect(nextDay.outcome).toBe("available");
    expect(nextDay.notified).toBe(false);
    expect(messages.length).toBe(1);
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("bootstrap-binary");
  });

  test("auto defers while work is in flight or execution is paused, then installs at idle", async () => {
    const manifest = await writeManifest("0.2.0", "new-binary");
    const config = (await readConfig(stateDir))!;
    await writeConfig({ ...config, update: { mode: "auto", manifestUrl: manifest } }, stateDir);
    const messages: string[] = [];
    const notify = async (t: string) => {
      messages.push(t);
    };
    const now = new Date("2026-09-13T10:00:00Z");

    const runId = createRun(db, "project:proj-1", 1024);
    expect(idleReport(db)).toEqual({ idle: false, reasons: ["1 active run(s)"] });
    const busy = await runScheduledUpdate({ db, stateDir, notify, now });
    expect(busy.outcome).toBe("deferred");
    expect(busy.detail).toContain("active run");
    expect((await readConfig(stateDir))!.update!.lastCheckAt).toBeUndefined();
    finishRun(db, runId, "completed");

    await pauseAutonomy(stateDir);
    const paused = await runScheduledUpdate({ db, stateDir, notify, now });
    expect(paused.outcome).toBe("deferred");
    expect(paused.detail).toBe("execution paused");
    await resumeAutonomy(stateDir);

    const installed = await runScheduledUpdate({ db, stateDir, notify, now });
    expect(installed.outcome).toBe("installed");
    expect(installed.latest).toBe("0.2.0");
    expect(messages.at(-1)).toContain("updated to 0.2.0");
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("new-binary");
    const after = (await readConfig(stateDir))!.update!;
    expect(after.last?.outcome).toBe("installed");
    expect(after.lastCheckAt).toBe(now.toISOString());
    expect(messages.length).toBe(1);
  });

  test("auto records and reports install failure without touching the running release", async () => {
    const manifest = await writeManifest("0.2.0", "new-binary");
    const config = (await readConfig(stateDir))!;
    await writeConfig({ ...config, update: { mode: "auto", manifestUrl: manifest } }, stateDir);
    const messages: string[] = [];
    const result = await runScheduledUpdate({
      db,
      stateDir,
      notify: async (t) => {
        messages.push(t);
      },
      install: async () => {
        throw new Error("disk full");
      },
    });
    expect(result.outcome).toBe("failed");
    expect(result.detail).toBe("disk full");
    expect(messages[0]).toContain("failed: disk full");
    expect(await readFile(process.env.KELI_INSTALL_BIN!, "utf8")).toBe("bootstrap-binary");
  });
});
