import type { Database } from "bun:sqlite";
import type { JobRecord, JobStatus } from "./types.ts";

export function listJobs(db: Database, scope?: string): JobRecord[] {
  const rows = scope
    ? db.query("SELECT * FROM jobs WHERE scope = ? ORDER BY created_at").all(scope)
    : db.query("SELECT * FROM jobs ORDER BY created_at").all();
  return (rows as Array<Record<string, string>>).map(rowToJob);
}

export function createJob(
  db: Database,
  job: Omit<JobRecord, "createdAt"> & { createdAt?: string },
): JobRecord {
  const createdAt = job.createdAt ?? new Date().toISOString();
  db.run(
    `INSERT INTO jobs(id, owner_id, scope, name, schedule, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [job.id, job.ownerId, job.scope, job.name, job.schedule, job.status, createdAt],
  );
  return { ...job, createdAt };
}

export function getJob(db: Database, jobId: string): JobRecord | null {
  const row = db.query("SELECT * FROM jobs WHERE id = ?").get(jobId) as
    | Record<string, string>
    | null;
  return row ? rowToJob(row) : null;
}

export function setJobStatus(db: Database, jobId: string, status: JobStatus): void {
  db.run("UPDATE jobs SET status = ? WHERE id = ?", [status, jobId]);
}

function rowToJob(row: Record<string, string>): JobRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    scope: row.scope,
    name: row.name,
    schedule: row.schedule,
    status: row.status as JobStatus,
    createdAt: row.created_at,
  };
}
