import type { Database } from "bun:sqlite";
import { KeliError } from "./errors.ts";

export type RunRecord = {
  id: string;
  scope: string;
  status: string;
  cancel_epoch: number;
  budget_bytes_max: number;
  budget_bytes_used: number;
};

const DEFAULT_BUDGET_BYTES = 1_048_576;

export function createRun(db: Database, scope: string, budgetBytesMax = DEFAULT_BUDGET_BYTES): string {
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO runs(id, scope, status, cancel_epoch, budget_bytes_max, budget_bytes_used, created_at)
     VALUES (?, ?, 'active', 0, ?, 0, ?)`,
    [id, scope, budgetBytesMax, new Date().toISOString()],
  );
  return id;
}

export function getRun(db: Database, runId: string): RunRecord | null {
  return db.query("SELECT * FROM runs WHERE id = ?").get(runId) as RunRecord | null;
}

export function cancelRun(db: Database, runId: string): number {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  const next = row.cancel_epoch + 1;
  db.run(
    `UPDATE runs SET cancel_epoch = ?, status = 'cancelled' WHERE id = ?`,
    [next, runId],
  );
  return next;
}

export function assertNotCancelled(db: Database, runId: string, observedEpoch: number): void {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  if (row.cancel_epoch > observedEpoch) {
    throw new KeliError("Run cancelled", "cancelled");
  }
}

export function consumeBudget(db: Database, runId: string, bytes: number): void {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  const used = row.budget_bytes_used + bytes;
  if (used > row.budget_bytes_max) {
    throw new KeliError(
      `Run budget exceeded (${used} > ${row.budget_bytes_max} bytes)`,
      "quota_exceeded",
    );
  }
  db.run("UPDATE runs SET budget_bytes_used = ? WHERE id = ?", [used, runId]);
}

export function finishRun(db: Database, runId: string, status: "completed" | "failed" | "cancelled"): void {
  db.run("UPDATE runs SET status = ? WHERE id = ?", [status, runId]);
}
