import type { Database } from "bun:sqlite";
import { parseSchedule, coalescedDueOccurrence } from "./schedule.ts";
import {
  hasActiveOccurrence,
  latestScheduledAt,
  tryCreateOccurrence,
  recoverRunningOccurrences,
} from "./occurrences.ts";
import { listJobs } from "./store.ts";
import type { JobRecord } from "./types.ts";
import type { JobTickContext } from "./tick-context.ts";

export type SchedulerTickResult = {
  scanned: number;
  materialized: string[];
  processed: string[];
  coalesced: number;
};

export function reconcileJobs(db: Database): number {
  return recoverRunningOccurrences(db);
}

function anchorForJob(db: Database, job: JobRecord): Date {
  const last = latestScheduledAt(db, job.id);
  return last ? new Date(last) : new Date(job.createdAt);
}

/** One occurrence per active job per tick; missed observational ticks coalesce (PRD D8). */
export async function tickScheduler(
  db: Database,
  ctx: JobTickContext,
  now = new Date(),
): Promise<SchedulerTickResult> {
  const jobs = listJobs(db).filter((j) => j.status === "active");
  const materialized: string[] = [];
  const processed: string[] = [];
  let coalesced = 0;

  for (const job of jobs) {
    if (hasActiveOccurrence(db, job.id)) {
      coalesced += 1;
      continue;
    }

    const schedule = parseSchedule(job.schedule);
    const anchor = anchorForJob(db, job);
    const due = coalescedDueOccurrence(schedule, anchor, now);
    if (!due) continue;

    const occurrence = tryCreateOccurrence(db, {
      id: crypto.randomUUID(),
      jobId: job.id,
      scheduledAt: due.dueAt.toISOString(),
    });
    if (!occurrence) {
      coalesced += 1;
      continue;
    }
    materialized.push(occurrence.id);
    await ctx.dispatch(db, job, occurrence.id, due.missedSlots);
    processed.push(occurrence.id);
  }

  return { scanned: jobs.length, materialized, processed, coalesced };
}
