import type { Database } from "bun:sqlite";
import { KeliError } from "./errors.ts";
import { getRun } from "./run-control.ts";

export const DEFAULT_REQUESTS_MAX = 20;
export const DEFAULT_RETRIES_MAX = 2;
export const DEFAULT_NO_PROGRESS_MAX = 3;

export type PricingEntry = { inputCentsPerMTok?: number; outputCentsPerMTok?: number };

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
  const used = (row.tokens_used ?? 0) + tokens;
  if (row.tokens_max != null && used > row.tokens_max) {
    throw new KeliError(`Run token budget exceeded (${used} > ${row.tokens_max})`, "quota_exceeded");
  }
  db.run("UPDATE runs SET tokens_used = ? WHERE id = ?", [used, runId]);
}

/**
 * Replace a pre-request reservation with the provider's reported usage. Over-use beyond the
 * reservation still has to fit the cap; under-use is refunded so estimates never starve a run.
 */
export function reconcileTokenBudget(db: Database, runId: string, reserved: number, actual: number): void {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  const used = Math.max(0, (row.tokens_used ?? 0) - reserved + actual);
  db.run("UPDATE runs SET tokens_used = ? WHERE id = ?", [used, runId]);
  if (row.tokens_max != null && used > row.tokens_max) {
    throw new KeliError(`Run token budget exceeded (${used} > ${row.tokens_max})`, "quota_exceeded");
  }
}

export function consumeMonetaryBudget(db: Database, runId: string, cents: number): void {
  const row = getRun(db, runId);
  if (!row) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
  if (row.monetary_budget_cents == null) return;
  const used = (row.monetary_used_cents ?? 0) + cents;
  if (used > row.monetary_budget_cents) {
    throw new KeliError(
      `Run monetary budget exceeded (${used} > ${row.monetary_budget_cents} cents)`,
      "quota_exceeded",
    );
  }
  db.run("UPDATE runs SET monetary_used_cents = ? WHERE id = ?", [used, runId]);
}

/** Rough pre-request estimate (4 bytes per token). Reported usage replaces it when present. */
export function estimateTokens(text: string, reservedOutput = 512): number {
  return Math.ceil(Buffer.byteLength(text) / 4) + reservedOutput;
}

/** Returns null when pricing is unknown so callers disclose unknown cost instead of guessing. */
export function costCentsFor(
  pricing: PricingEntry | undefined,
  usage: { reportedIn?: number; reportedOut?: number } | undefined,
): number | null {
  if (!pricing || !usage) return null;
  if (pricing.inputCentsPerMTok == null && pricing.outputCentsPerMTok == null) return null;
  const input = ((usage.reportedIn ?? 0) / 1_000_000) * (pricing.inputCentsPerMTok ?? 0);
  const output = ((usage.reportedOut ?? 0) / 1_000_000) * (pricing.outputCentsPerMTok ?? 0);
  return Math.round((input + output) * 100) / 100;
}

export type RequestUsageInput = {
  actionId?: string;
  runId?: string;
  attempt?: number;
  providerId: string;
  model?: string;
  outcome?: "ok" | "error";
  estTokens?: number;
  reportedIn?: number;
  reportedCached?: number;
  reportedOut?: number;
  costCents?: number | null;
};

export function recordRequestUsage(db: Database, input: RequestUsageInput): void {
  db.run(
    `INSERT INTO request_usage(id, action_id, run_id, attempt, provider_id, model, outcome, est_tokens, reported_in, reported_cached, reported_out, cost_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.actionId ?? null,
      input.runId ?? null,
      input.attempt ?? null,
      input.providerId,
      input.model ?? null,
      input.outcome ?? null,
      input.estTokens ?? null,
      input.reportedIn ?? null,
      input.reportedCached ?? null,
      input.reportedOut ?? null,
      input.costCents ?? null,
      new Date().toISOString(),
    ],
  );
}

export function listRequestUsage(db: Database, runId: string) {
  return db
    .query("SELECT * FROM request_usage WHERE run_id = ? ORDER BY created_at, attempt")
    .all(runId) as Array<Record<string, string | number | null>>;
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
