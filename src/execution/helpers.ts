import type { Database } from "bun:sqlite";
import { KeliError } from "../core/errors.ts";
import { createRun, cancelRun, getRun } from "../core/run-control.ts";

export const MAX_HELPER_FANOUT = 4;

export type HelperRunRecord = {
  id: string;
  parentRunId: string;
  childRunId: string;
  capabilityId: string;
  status: string;
  createdAt: string;
};

export function countActiveHelpers(db: Database, parentRunId: string): number {
  const row = db
    .query(
      `SELECT COUNT(*) AS n FROM helper_runs
       WHERE parent_run_id = ? AND status IN ('pending', 'running')`,
    )
    .get(parentRunId) as { n: number };
  return row.n;
}

export function countHelperRuns(db: Database, parentRunId: string): number {
  const row = db
    .query("SELECT COUNT(*) AS n FROM helper_runs WHERE parent_run_id = ?")
    .get(parentRunId) as { n: number };
  return row.n;
}

export function spawnHelperRun(
  db: Database,
  parentRunId: string,
  scope: string,
  capabilityId: string,
): HelperRunRecord {
  const parent = getRun(db, parentRunId);
  if (!parent) throw new KeliError(`Unknown parent run: ${parentRunId}`, "invalid_request");
  if (parent.status === "cancelled") {
    throw new KeliError("Parent run cancelled", "cancelled");
  }

  const total = countHelperRuns(db, parentRunId);
  if (total >= MAX_HELPER_FANOUT) {
    throw new KeliError(`Helper fan-out limit (${MAX_HELPER_FANOUT}) exceeded`, "quota_exceeded");
  }

  const childRunId = createRun(db, scope, parent.budget_bytes_max, {
    parentRunId,
    requestsMax: parent.requests_max ?? 20,
  });
  db.run("UPDATE runs SET cancel_epoch = ? WHERE id = ?", [parent.cancel_epoch, childRunId]);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO helper_runs(id, parent_run_id, child_run_id, capability_id, status, created_at)
     VALUES (?, ?, ?, ?, 'running', ?)`,
    [id, parentRunId, childRunId, capabilityId, createdAt],
  );

  return {
    id,
    parentRunId,
    childRunId,
    capabilityId,
    status: "running",
    createdAt,
  };
}

export function completeHelperRun(db: Database, helperId: string, status: "completed" | "failed"): void {
  db.run("UPDATE helper_runs SET status = ? WHERE id = ?", [status, helperId]);
}

export function cancelHelperTree(db: Database, parentRunId: string): number {
  const helpers = db
    .query("SELECT child_run_id FROM helper_runs WHERE parent_run_id = ? AND status = 'running'")
    .all(parentRunId) as Array<{ child_run_id: string }>;
  let cancelled = 0;
  for (const helper of helpers) {
    cancelRun(db, helper.child_run_id);
    cancelled += 1;
  }
  db.run(
    `UPDATE helper_runs SET status = 'cancelled' WHERE parent_run_id = ? AND status = 'running'`,
    [parentRunId],
  );
  return cancelled;
}

export function parentHasRunningHelpers(db: Database, parentRunId: string): boolean {
  return countActiveHelpers(db, parentRunId) > 0;
}
