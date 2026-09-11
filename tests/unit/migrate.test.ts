import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  migrate,
  getSchemaVersion,
  CURRENT_SCHEMA_VERSION,
  applyTestMigrationV2,
} from "../../src/state/migrate.ts";

describe("migrations", () => {
  test("applies v1 baseline", () => {
    const db = new Database(":memory:");
    const version = migrate(db);
    expect(version).toBe(CURRENT_SCHEMA_VERSION);
    expect(getSchemaVersion(db)).toBe(1);
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain("rules");
    db.close();
  });

  test("upgrade harness v2 fixture", () => {
    const db = new Database(":memory:");
    migrate(db);
    applyTestMigrationV2(db);
    expect(getSchemaVersion(db)).toBe(2);
    const col = db
      .query("PRAGMA table_info(projects)")
      .all() as { name: string }[];
    expect(col.some((c) => c.name === "description")).toBe(true);
    db.close();
  });
});
