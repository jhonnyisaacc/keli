import type { Database } from "bun:sqlite";
import type { JobOccurrenceStatus } from "./types.ts";

export type JobOccurrenceRecord = {
  id: string;
  jobId: string;
  scheduledAt: string;
  status: JobOccurrenceStatus;
  createdAt: string;
  completedAt?: string;
  reason?: string;
  runId?: string;
  actionId?: string;
};

export function listOccurrences(db: Database, jobId?: string, limit = 50): JobOccurrenceRecord[] {
  const rows = jobId
    ? db
        .query(
          "SELECT * FROM job_occurrences WHERE job_id = ? ORDER BY scheduled_at DESC LIMIT ?",
        )
        .all(jobId, limit)
    : db
        .query("SELECT * FROM job_occurrences ORDER BY scheduled_at DESC LIMIT ?")
        .all(limit);
  return (rows as Array<Record<string, string | null>>).map(rowToOccurrence);
}

export function latestScheduledAt(db: Database, jobId: string): string | null {
  const row = db
    .query(
      "SELECT scheduled_at FROM job_occurrences WHERE job_id = ? ORDER BY scheduled_at DESC LIMIT 1",
    )
    .get(jobId) as { scheduled_at: string } | null;
  return row?.scheduled_at ?? null;
}

export function hasActiveOccurrence(db: Database, jobId: string): boolean {
  const row = db
    .query(
      `SELECT COUNT(*) AS n FROM job_occurrences
       WHERE job_id = ? AND status IN ('pending', 'running')`,
    )
    .get(jobId) as { n: number };
  return row.n > 0;
}

export function tryCreateOccurrence(
  db: Database,
  occurrence: Omit<JobOccurrenceRecord, "createdAt" | "status" | "completedAt" | "reason"> & {
    status?: JobOccurrenceStatus;
    createdAt?: string;
  },
): JobOccurrenceRecord | null {
  const createdAt = occurrence.createdAt ?? new Date().toISOString();
  const status = occurrence.status ?? "pending";
  try {
    db.run(
      `INSERT INTO job_occurrences(id, job_id, scheduled_at, status, created_at, completed_at, reason)
       VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
      [occurrence.id, occurrence.jobId, occurrence.scheduledAt, status, createdAt],
    );
    return {
      id: occurrence.id,
      jobId: occurrence.jobId,
      scheduledAt: occurrence.scheduledAt,
      status,
      createdAt,
    };
  } catch {
    return null;
  }
}

export function linkOccurrenceRun(
  db: Database,
  occurrenceId: string,
  runId: string,
  actionId: string,
): void {
  db.run("UPDATE job_occurrences SET run_id = ?, action_id = ? WHERE id = ?", [
    runId,
    actionId,
    occurrenceId,
  ]);
}

export function getOccurrenceActionId(db: Database, occurrenceId: string): string | null {
  const row = db
    .query("SELECT action_id FROM job_occurrences WHERE id = ?")
    .get(occurrenceId) as { action_id: string | null } | null;
  return row?.action_id ?? null;
}

export function setOccurrenceStatus(
  db: Database,
  occurrenceId: string,
  status: JobOccurrenceStatus,
  reason?: string,
): void {
  const completedAt = ["completed", "failed", "skipped"].includes(status)
    ? new Date().toISOString()
    : null;
  db.run(
    `UPDATE job_occurrences SET status = ?, completed_at = ?, reason = ? WHERE id = ?`,
    [status, completedAt, reason ?? null, occurrenceId],
  );
}

export function recoverRunningOccurrences(db: Database): number {
  const result = db.run(
    `UPDATE job_occurrences SET status = 'failed', reason = 'Interrupted on restart',
      completed_at = ? WHERE status = 'running'`,
    [new Date().toISOString()],
  );
  return result.changes;
}

function rowToOccurrence(row: Record<string, string | null>): JobOccurrenceRecord {
  return {
    id: row.id!,
    jobId: row.job_id!,
    scheduledAt: row.scheduled_at!,
    status: row.status as JobOccurrenceStatus,
    createdAt: row.created_at!,
    completedAt: row.completed_at ?? undefined,
    reason: row.reason ?? undefined,
    runId: row.run_id ?? undefined,
    actionId: row.action_id ?? undefined,
  };
}
