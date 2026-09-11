import type { Database } from "bun:sqlite";
import { cancelHelperTree } from "../execution/helpers.ts";
import { KeliError } from "./errors.ts";

export type RunRecord = {
  id: string;
  scope: string;
  status: string;
  cancel_epoch: number;
  budget_bytes_max: number;
  budget_bytes_used: number;
  requests_max?: number;
  requests_used?: number;
  tokens_max?: number | null;
  tokens_used?: number;
  tool_calls_max?: number | null;
  tool_calls_used?: number;
  parent_run_id?: string | null;
  monetary_budget_cents?: number | null;
  monetary_used_cents?: number;
};

const DEFAULT_BUDGET_BYTES = 1_048_576;

export function createRun(
  db: Database,
  scope: string,
  budgetBytesMax = DEFAULT_BUDGET_BYTES,
  options?: { parentRunId?: string; requestsMax?: number },
): string {
  const id = crypto.randomUUID();
  const requestsMax = options?.requestsMax ?? 20;
  db.run(
    `INSERT INTO runs(
       id, scope, status, cancel_epoch, budget_bytes_max, budget_bytes_used,
       requests_max, requests_used, tokens_used, tool_calls_used, monetary_used_cents,
       parent_run_id, created_at
     ) VALUES (?, ?, 'active', 0, ?, 0, ?, 0, 0, 0, 0, ?, ?)`,
    [id, scope, budgetBytesMax, requestsMax, options?.parentRunId ?? null, new Date().toISOString()],
  );
  return id;
}

export function getRun(db: Database, runId: string): RunRecord | null {
  return db.query("SELECT * FROM runs WHERE id = ?").get(runId) as RunRecord | null;
}

export function cancelRun(db: Database, runId: string): number {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  cancelHelperTree(db, runId);
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
