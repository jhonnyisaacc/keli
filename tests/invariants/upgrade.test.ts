import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { Database } from "bun:sqlite";
import { createTestEnv, reopenDb, projectScope } from "../helpers/setup.ts";
import { verifyArtifactChecksum } from "../../src/update/manifest.ts";
import { checkForUpdate } from "../../src/update/check.ts";
import { CURRENT_SCHEMA_VERSION } from "../../src/state/migrate.ts";

describe("A04/A33 upgrade", () => {
  test("wrong hash rejected", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(verifyArtifactChecksum(bytes, "deadbeef")).toBe(false);
  });

  test("incompatible schema fails closed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keli-manifest-"));
    const manifest = {
      version: "9.9.9",
      schemaReadMin: CURRENT_SCHEMA_VERSION + 1,
      schemaReadMax: CURRENT_SCHEMA_VERSION + 2,
      schemaWriteMin: 1,
      schemaWriteMax: CURRENT_SCHEMA_VERSION,
      artifacts: [
        {
          name: "keli-linux-x64",
          platform: "linux",
          arch: "x64",
          sha256: "00",
          size: 0,
          url: "file:///dev/null",
        },
      ],
      publishedAt: new Date().toISOString(),
    };
    const path = join(dir, "manifest.json");
    await writeFile(path, JSON.stringify(manifest));
    const check = await checkForUpdate(path);
    expect(check.updateAvailable).toBe(true);
    const { installUpdate } = await import("../../src/update/install.ts");
    await expect(installUpdate({ manifestUrl: path, stateDir: dir })).rejects.toThrow(
      /Incompatible schema/,
    );
  });

  test("seeded rules survive upgrade snapshot path", async () => {
    const env = await createTestEnv();
    await env.loop.runTurn("Rocket changes use Codex");
    const ruleBefore = env.behavior.getRule(projectScope(env.rocketId), "coding.delegate");
    env.db.close();

    const db = reopenDb(env.stateDir);
    const ruleAfter = db
      .query("SELECT value FROM rules WHERE scope = ? AND key = ? AND status = 'active'")
      .get(projectScope(env.rocketId), "coding.delegate") as { value: string };
    expect(ruleAfter.value).toBe("Codex");
    expect(ruleBefore?.revision).toBe(1);
    db.close();
    env.fixture.stop();
  });

  test("manifest checksum roundtrip", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keli-artifact-"));
    const bin = join(dir, "keli");
    await writeFile(bin, "keli-binary-stub");
    const sha256 = createHash("sha256").update(await readFile(bin)).digest("hex");
    const manifestPath = join(dir, "manifest.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        version: "0.1.0-test",
        schemaReadMin: 1,
        schemaReadMax: CURRENT_SCHEMA_VERSION,
        schemaWriteMin: 1,
        schemaWriteMax: CURRENT_SCHEMA_VERSION,
        artifacts: [
          {
            name: "keli-linux-x64",
            platform: "linux",
            arch: "x64",
            sha256,
            size: (await readFile(bin)).byteLength,
            url: `file://${bin}`,
          },
        ],
        publishedAt: new Date().toISOString(),
      }),
    );
    const check = await checkForUpdate(manifestPath);
    expect(check.artifact?.sha256).toBe(sha256);
    const installRoot = await mkdtemp(join(tmpdir(), "keli-install-"));
    process.env.KELI_INSTALL_ROOT = join(installRoot, "lib");
    process.env.KELI_INSTALL_BIN = join(installRoot, "bin", "keli");
    await mkdir(dirname(process.env.KELI_INSTALL_BIN!), { recursive: true });
    const { installUpdate } = await import("../../src/update/install.ts");
    const result = await installUpdate({
      manifestUrl: manifestPath,
      stateDir: join(installRoot, "state"),
    });
    expect(result.activated).toBe(true);
    delete process.env.KELI_INSTALL_ROOT;
    delete process.env.KELI_INSTALL_BIN;
  });
});
