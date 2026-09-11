import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { migrate } from "../../src/state/migrate.ts";
import { acquireLease, validateFence } from "../../src/state/repos.ts";

describe("delegate fencing", () => {
  test("superseded delegate lease fails validateFence (used after delegate execution)", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const holder = "delegate:Codex";
    const token = acquireLease(db, holder);
    acquireLease(db, holder);
    expect(validateFence(db, holder, token)).toBe(false);
    db.close();
  });
});
