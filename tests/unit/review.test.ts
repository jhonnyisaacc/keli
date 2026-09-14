import { describe, expect, test } from "bun:test";
import { commitmentProjection, isWatchDue, occurrenceFingerprint, reviewMode, reviewSlot } from "../../src/watches/review.ts";
import type { WatchRecord } from "../../src/watches/types.ts";

function watch(partial: Partial<WatchRecord> = {}): WatchRecord {
  return {
    id: "w",
    ownerId: "owner",
    scope: "project:p",
    name: "portfolio",
    kind: "responsibility",
    version: 1,
    status: "active",
    trigger: { schedule: "daily:09:00", target: "portfolio" },
    budget: {},
    evidence: { question: "Assess the wallet", autonomy: true, review: "scheduled" },
    notify: { policy: "material-change" },
    attempts: 0,
    createdAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-09-15T08:00:00.000Z",
    ...partial,
  };
}

describe("responsibility review slots", () => {
  test("source-collection is due immediately; responsibility waits for its first slot", () => {
    const created = new Date("2026-09-15T08:00:00.000Z");
    const morning = new Date("2026-09-15T08:30:00.000Z");
    const slot = new Date("2026-09-15T09:00:00.000Z");
    expect(isWatchDue(watch({ kind: "source-collection", lastAttemptAt: undefined, createdAt: created.toISOString() }), morning)).toBe(true);
    expect(isWatchDue(watch({ createdAt: created.toISOString() }), morning)).toBe(false);
    expect(isWatchDue(watch({ createdAt: created.toISOString() }), slot)).toBe(true);
  });

  test("scheduled fingerprints occupy one UTC day and ignore an unchanged event hash", () => {
    const day = new Date("2026-09-15T09:00:00.000Z");
    const later = new Date("2026-09-15T18:00:00.000Z");
    const next = new Date("2026-09-16T09:00:00.000Z");
    expect(reviewSlot("daily:09:00", day)).toBe("daily:2026-09-15");
    expect(occurrenceFingerprint(watch(), "abc", day)).toBe("review:daily:2026-09-15");
    expect(occurrenceFingerprint(watch(), "xyz", later)).toBe("review:daily:2026-09-15");
    expect(occurrenceFingerprint(watch(), "abc", next)).toBe("review:daily:2026-09-16");
    expect(reviewMode(watch({ kind: "source-collection", evidence: { question: "q" } }))).toBe("event");
  });

  test("same-day ticks after an attempt are not due; the next UTC day is", () => {
    const w = watch({ lastAttemptAt: "2026-09-15T09:00:00.000Z" });
    expect(isWatchDue(w, new Date("2026-09-15T09:05:00.000Z"))).toBe(false);
    expect(isWatchDue(w, new Date("2026-09-16T09:00:00.000Z"))).toBe(true);
  });

  test("commitment projection carries current rules without old wording", () => {
    const text = commitmentProjection(watch({ evidence: { question: "Assess", constraints: "current risk rule applies" } }), {
      rules: [{ key: "conversation.language", value: "pt", revision: 2 }],
      previousFindings: [{ subject: "stale", claim: "Reply in Spanish" }],
    });
    expect(text).toContain("conversation.language");
    expect(text).toContain("pt");
    expect(text).toContain("Current rules supersede");
    expect(text).not.toContain("Reply in Spanish is authorization");
  });
});
