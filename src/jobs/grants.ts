import type { Database } from "bun:sqlite";

export type JobGrant = {
  jobId: string;
  mutateGranted: boolean;
  deployGranted: boolean;
  grantedAt?: string;
};

export function getJobGrant(db: Database, jobId: string): JobGrant {
  const row = db.query("SELECT * FROM job_grants WHERE job_id = ?").get(jobId) as
    | Record<string, string | number>
    | null;
  if (!row) {
    return { jobId, mutateGranted: false, deployGranted: false };
  }
  return {
    jobId,
    mutateGranted: Boolean(row.mutate_granted),
    deployGranted: Boolean(row.deploy_granted),
    grantedAt: row.granted_at as string | undefined,
  };
}

export function grantJobCapabilities(
  db: Database,
  jobId: string,
  grants: { mutate?: boolean; deploy?: boolean },
): JobGrant {
  const existing = getJobGrant(db, jobId);
  const mutateGranted = grants.mutate ?? existing.mutateGranted;
  const deployGranted = grants.deploy ?? existing.deployGranted;
  db.run(
    `INSERT OR REPLACE INTO job_grants(job_id, mutate_granted, deploy_granted, granted_at)
     VALUES (?, ?, ?, ?)`,
    [jobId, mutateGranted ? 1 : 0, deployGranted ? 1 : 0, new Date().toISOString()],
  );
  return getJobGrant(db, jobId);
}

export function jobAllowsActionClass(
  db: Database,
  jobId: string | undefined,
  actionClass: "read" | "mutate" | "effect",
): boolean {
  if (!jobId) return true;
  if (actionClass === "read") return true;
  const grant = getJobGrant(db, jobId);
  if (actionClass === "mutate") return grant.mutateGranted;
  return grant.deployGranted;
}
