import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import {
  migrate,
  getSchemaVersion,
  CURRENT_SCHEMA_VERSION,
  applyTestMigrationV3,
} from "../../src/state/migrate.ts";

describe("migrations", () => {
  test("applies v1 baseline", () => {
    const db = new Database(":memory:");
    const version = migrate(db);
    expect(version).toBe(CURRENT_SCHEMA_VERSION);
    expect(getSchemaVersion(db)).toBe(CURRENT_SCHEMA_VERSION);
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain("rules");
    db.close();
  });

  test("upgrade harness v3 fixture", () => {
    const db = new Database(":memory:");
    migrate(db, 3);
    applyTestMigrationV3(db);
    expect(getSchemaVersion(db)).toBe(3);
    const col = db
      .query("PRAGMA table_info(projects)")
      .all() as { name: string }[];
    expect(col.some((c) => c.name === "description")).toBe(true);
    db.close();
  });

  test("v4 adds jobs and outbox tables", () => {
    const db = new Database(":memory:");
    migrate(db, 4);
    expect(getSchemaVersion(db)).toBe(4);
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('jobs','outbox_messages')")
      .all();
    expect(tables.length).toBe(2);
    db.close();
  });

  test("v3 adds runs table", () => {
    const db = new Database(":memory:");
    migrate(db, 3);
    expect(getSchemaVersion(db)).toBe(3);
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='runs'")
      .all();
    expect(tables.length).toBe(1);
    db.close();
  });

  test("v6 adds occurrence run and action linkage", () => {
    const db = new Database(":memory:");
    migrate(db, 6);
    expect(getSchemaVersion(db)).toBe(6);
    const cols = db
      .query("PRAGMA table_info(job_occurrences)")
      .all() as { name: string }[];
    expect(cols.some((c) => c.name === "run_id")).toBe(true);
    expect(cols.some((c) => c.name === "action_id")).toBe(true);
    db.close();
  });

  test("v5 adds transport inbox and occurrence completion columns", () => {
    const db = new Database(":memory:");
    migrate(db, 5);
    expect(getSchemaVersion(db)).toBe(5);
    const inbox = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='transport_inbox'")
      .all();
    expect(inbox.length).toBe(1);
    const cols = db
      .query("PRAGMA table_info(job_occurrences)")
      .all() as { name: string }[];
    expect(cols.some((c) => c.name === "completed_at")).toBe(true);
    expect(cols.some((c) => c.name === "reason")).toBe(true);
    db.close();
  });

  test("v7 adds job grants and preservation cursor", () => {
    const db = new Database(":memory:");
    migrate(db, 7);
    expect(getSchemaVersion(db)).toBe(7);
    const grants = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='job_grants'")
      .all();
    expect(grants.length).toBe(1);
    const cursor = db
      .query("SELECT last_journal_id FROM preservation_cursor WHERE id = 'default'")
      .get() as { last_journal_id: string | null };
    expect(cursor).toBeTruthy();
    db.close();
  });

  test("v2 adds artifacts table", () => {
    const db = new Database(":memory:");
    migrate(db, 2);
    expect(getSchemaVersion(db)).toBe(2);
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='artifacts'")
      .all();
    expect(tables.length).toBe(1);
    db.close();
  });
});
