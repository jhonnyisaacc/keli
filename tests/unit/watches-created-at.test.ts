import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { isWatchDue } from "../../src/watches/review.ts";
import { getWatch, upsertWatch } from "../../src/watches/store.ts";
import { migrate } from "../../src/state/migrate.ts";

describe("watch createdAt injection", () => {
  test("upsertWatch stores injected createdAt so historical ticks stay due after the calendar moves", () => {
    const db = new Database(":memory:");
    migrate(db);
    const createdAt = "2026-09-01T00:00:00.000Z";
    const { watch } = upsertWatch(db, {
      ownerId: "owner",
      scope: "project:p",
      status: "active",
      createdAt,
      definition: {
        name: "augustine-shaul",
        kind: "responsibility",
        trigger: { schedule: "every:1s", target: "augustine-shaul" },
        evidence: { question: "Compare Augustine and Shaul", autonomy: true },
      },
    });
    expect(watch.createdAt).toBe(createdAt);
    expect(getWatch(db, watch.id)?.createdAt).toBe(createdAt);
    expect(isWatchDue(watch, new Date("2026-09-15T00:00:02.000Z"))).toBe(true);
    const wall = upsertWatch(db, {
      ownerId: "owner",
      scope: "project:p",
      status: "active",
      createdAt: "2026-09-15T00:50:00.000Z",
      definition: {
        name: "too-new",
        kind: "responsibility",
        trigger: { schedule: "every:1s", target: "too-new" },
        evidence: { question: "Later create time", autonomy: true },
      },
    }).watch;
    expect(isWatchDue(wall, new Date("2026-09-15T00:00:02.000Z"))).toBe(false);
    db.close();
  });
});
