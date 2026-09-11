import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../../src/state/db.ts";
import { getSchemaVersion, CURRENT_SCHEMA_VERSION } from "../../src/state/migrate.ts";

describe("openDatabase", () => {
  test("creates parent directory before opening SQLite on fresh state dir", async () => {
    const parent = await mkdtemp(join(tmpdir(), "keli-db-parent-"));
    const stateDir = join(parent, "nested", "keli-state");
    const db = await openDatabase(stateDir);
    expect(getSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
    db.close();
    await rm(parent, { recursive: true, force: true });
  });
});
