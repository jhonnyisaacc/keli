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

export function pinJobSkill(db: Database, jobId: string, skillId: string, version: number): void {
  db.run(
    `INSERT INTO job_skill_pins(job_id, skill_id, version) VALUES (?, ?, ?)
     ON CONFLICT(job_id, skill_id) DO UPDATE SET version = excluded.version`,
    [jobId, skillId, version],
  );
}

export function getJobSkillPins(db: Database, jobId: string): Array<{ skillId: string; version: number }> {
  const rows = db
    .query("SELECT skill_id, version FROM job_skill_pins WHERE job_id = ?")
    .all(jobId) as Array<{ skill_id: string; version: number }>;
  return rows.map((r) => ({ skillId: r.skill_id, version: r.version }));
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
