import { createHash } from "node:crypto";
import { coalescedDueOccurrence, nextOccurrence, parseSchedule } from "../jobs/schedule.ts";
import type { WatchRecord } from "./types.ts";

/** UTC daily slot or interval window that a scheduled review occupies. */
export function reviewSlot(schedule: string, now: Date): string {
  const parsed = parseSchedule(schedule);
  if (parsed.kind === "daily") {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), parsed.hour, parsed.minute, 0, 0));
    const slot = now.getTime() >= today.getTime() ? today : new Date(today.getTime() - 86_400_000);
    return `daily:${slot.toISOString().slice(0, 10)}`;
  }
  const window = Math.floor(now.getTime() / (parsed.seconds * 1000));
  return `every:${parsed.seconds}:${window}`;
}

export function reviewMode(watch: WatchRecord): NonNullable<WatchRecord["evidence"]["review"]> {
  return watch.evidence.review ?? (watch.kind === "responsibility" ? "scheduled" : "event");
}

export function occurrenceFingerprint(watch: WatchRecord, eventHash: string, now: Date): string {
  const mode = reviewMode(watch);
  if (mode === "event") return eventHash;
  const slot = reviewSlot(watch.trigger.schedule, now);
  if (mode === "scheduled") return `review:${slot}`;
  return `review:${slot}|event:${eventHash}`;
}

export function isWatchDue(watch: WatchRecord, now: Date): boolean {
  const schedule = parseSchedule(watch.trigger.schedule);
  const created = new Date(watch.createdAt);
  if (watch.kind === "responsibility" && !watch.lastAttemptAt) {
    return nextOccurrence(schedule, new Date(created.getTime() - 1)).getTime() <= now.getTime();
  }
  const anchor = watch.lastAttemptAt ? new Date(watch.lastAttemptAt) : created;
  if (!watch.lastAttemptAt) return true;
  return coalescedDueOccurrence(schedule, anchor, now) !== null;
}

export function commitmentProjection(watch: WatchRecord, extras: {
  rules: Array<{ key: string; value: string; revision: number }>;
  previousFindings?: unknown;
  investigation?: unknown;
}): string {
  return JSON.stringify({
    objective: watch.evidence.objective ?? watch.evidence.question,
    constraints: watch.evidence.constraints ?? null,
    completion: watch.evidence.completion ?? null,
    approvedCapabilities: watch.evidence.capabilities ?? null,
    hypotheses: watch.evidence.hypotheses ?? null,
    nextReview: watch.evidence.nextReview ?? null,
    currentRules: extras.rules,
    previousFindings: extras.previousFindings ?? null,
    investigation: extras.investigation ?? null,
    note: "Current rules supersede any earlier summary. Old wording is not authorization.",
  });
}

export function policyFingerprint(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
