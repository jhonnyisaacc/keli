import type { Database } from "bun:sqlite";
import { KeliError } from "./errors.ts";
import { getRun } from "./run-control.ts";

export const DEFAULT_REQUESTS_MAX = 20;
export const DEFAULT_RETRIES_MAX = 2;
export const DEFAULT_NO_PROGRESS_MAX = 3;

export function consumeRequestBudget(db: Database, runId: string): void {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  const max = row.requests_max ?? DEFAULT_REQUESTS_MAX;
  const used = (row.requests_used ?? 0) + 1;
  if (used > max) {
    throw new KeliError(`Run request budget exceeded (${used} > ${max})`, "quota_exceeded");
  }
  db.run("UPDATE runs SET requests_used = ? WHERE id = ?", [used, runId]);
}

export function consumeTokenBudget(db: Database, runId: string, tokens: number): void {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  if (row.tokens_max == null) return;
  const used = (row.tokens_used ?? 0) + tokens;
  if (used > row.tokens_max) {
    throw new KeliError(`Run token budget exceeded (${used} > ${row.tokens_max})`, "quota_exceeded");
  }
  db.run("UPDATE runs SET tokens_used = ? WHERE id = ?", [used, runId]);
}

export function consumeToolCallBudget(db: Database, runId: string): void {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  if (row.tool_calls_max == null) return;
  const used = (row.tool_calls_used ?? 0) + 1;
  if (used > row.tool_calls_max) {
    throw new KeliError(
      `Run tool-call budget exceeded (${used} > ${row.tool_calls_max})`,
      "quota_exceeded",
    );
  }
  db.run("UPDATE runs SET tool_calls_used = ? WHERE id = ?", [used, runId]);
}
