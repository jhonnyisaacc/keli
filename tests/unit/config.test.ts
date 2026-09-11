import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeConfig, readConfig, defaultConfig } from "../../src/state/config.ts";

describe("config", () => {
  test("atomic write and read", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keli-config-"));
    const config = { ...defaultConfig(), ownerId: "owner-1", defaultProjectId: "proj-1" };
    await writeConfig(config, dir);
    const loaded = await readConfig(dir);
    expect(loaded?.ownerId).toBe("owner-1");
    const raw = await readFile(join(dir, "config.json"), "utf8");
    expect(raw).toContain("owner-1");
    expect(raw.includes("\0")).toBe(false);
  });
});
