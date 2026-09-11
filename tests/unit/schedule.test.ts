import { describe, expect, test } from "bun:test";
import {
  parseSchedule,
  nextOccurrence,
  coalescedDueOccurrence,
} from "../../src/jobs/schedule.ts";

describe("job schedule", () => {
  test("parses interval schedules", () => {
    expect(parseSchedule("every:30s")).toEqual({ kind: "interval", seconds: 30 });
    expect(parseSchedule("every:5m")).toEqual({ kind: "interval", seconds: 300 });
    expect(parseSchedule("every:2h")).toEqual({ kind: "interval", seconds: 7200 });
  });

  test("parses daily UTC schedules", () => {
    expect(parseSchedule("daily:09:30")).toEqual({ kind: "daily", hour: 9, minute: 30 });
  });

  test("rejects invalid schedules", () => {
    expect(() => parseSchedule("cron:* * * * *")).toThrow();
    expect(() => parseSchedule("daily:25:00")).toThrow();
  });

  test("next interval occurrence is anchor plus interval", () => {
    const anchor = new Date("2026-01-01T12:00:00.000Z");
    const next = nextOccurrence({ kind: "interval", seconds: 60 }, anchor);
    expect(next.toISOString()).toBe("2026-01-01T12:01:00.000Z");
  });

  test("coalesced due occurrence skips intermediate missed slots", () => {
    const anchor = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:00:35.000Z");
    const result = coalescedDueOccurrence({ kind: "interval", seconds: 10 }, anchor, now);
    expect(result?.missedSlots).toBe(3);
    expect(result?.dueAt.toISOString()).toBe("2026-01-01T00:00:30.000Z");
  });

  test("next daily occurrence rolls to next day when anchor is after slot", () => {
    const anchor = new Date("2026-01-01T10:00:00.000Z");
    const next = nextOccurrence({ kind: "daily", hour: 9, minute: 0 }, anchor);
    expect(next.toISOString()).toBe("2026-01-02T09:00:00.000Z");
  });
});
