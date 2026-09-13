import type { Database } from "bun:sqlite";
import type { ProviderUsage } from "../core/gate.ts";
import {
  consumeMonetaryBudget,
  consumeRequestBudget,
  consumeTokenBudget,
  costCentsFor,
  reconcileTokenBudget,
  recordRequestUsage,
  type PricingEntry,
} from "../core/budgets.ts";
import { KeliError } from "../core/errors.ts";
import { assertNotCancelled, getRun } from "../core/run-control.ts";
import { withBoundedRetries, type RetryOutcome } from "./retry.ts";

export type BudgetedCallContext = {
  db: Database;
  runId: string;
  providerId: string;
  model?: string;
  actionId?: string;
  pricing?: PricingEntry;
  /** Pre-request token reservation; reconciled against reported usage after each attempt. */
  estimateTokens: number;
  retryBaseMs?: number;
  retriesMax?: number;
  noProgressMax?: number;
};

export type BudgetedCallResult = { error?: string; usage?: ProviderUsage };

/**
 * Wraps one logical model request. Every attempt (initial and retries) is budget-checked
 * before it runs and accounted after it returns, so `request_usage` has one row per attempt
 * and the run counters reflect what was actually spent.
 */
export async function runBudgetedModelCall<T extends BudgetedCallResult>(
  ctx: BudgetedCallContext,
  call: (attempt: number) => Promise<T>,
): Promise<RetryOutcome<T> & { costKnown: boolean; costCents: number }> {
  let costCents = 0;
  let observedEpoch: number | null = null;
  const costKnown = Boolean(ctx.pricing && (ctx.pricing.inputCentsPerMTok != null || ctx.pricing.outputCentsPerMTok != null));

  const outcome = await withBoundedRetries(call, {
    retriesMax: ctx.retriesMax,
    noProgressMax: ctx.noProgressMax,
    baseMs: ctx.retryBaseMs,
    errorOf: (r) => r.error,
    beforeAttempt: () => {
      const run = getRun(ctx.db, ctx.runId);
      if (!run) throw new KeliError(`Unknown run: ${ctx.runId}`, "invalid_request");
      if (run.status === "cancelled") throw new KeliError("Run cancelled", "cancelled");
      if (observedEpoch == null) observedEpoch = run.cancel_epoch;
      assertNotCancelled(ctx.db, ctx.runId, observedEpoch);
      consumeRequestBudget(ctx.db, ctx.runId);
      consumeTokenBudget(ctx.db, ctx.runId, ctx.estimateTokens);
    },
    afterAttempt: (attempt, result) => {
      const reported = (result.usage?.reportedIn ?? 0) + (result.usage?.reportedOut ?? 0);
      const actual = reported > 0 ? reported : ctx.estimateTokens;
      let budgetError: string | undefined;
      try {
        reconcileTokenBudget(ctx.db, ctx.runId, ctx.estimateTokens, actual);
      } catch (e) {
        budgetError = e instanceof KeliError ? e.message : String(e);
      }
      const cents = costCentsFor(ctx.pricing, result.usage);
      if (cents != null) {
        costCents += cents;
        try {
          consumeMonetaryBudget(ctx.db, ctx.runId, cents);
        } catch (e) {
          budgetError = budgetError ?? (e instanceof KeliError ? e.message : String(e));
        }
      }
      recordRequestUsage(ctx.db, {
        actionId: ctx.actionId,
        runId: ctx.runId,
        attempt,
        providerId: ctx.providerId,
        model: ctx.model,
        outcome: result.error ? "error" : "ok",
        estTokens: ctx.estimateTokens,
        reportedIn: result.usage?.reportedIn,
        reportedCached: result.usage?.reportedCached,
        reportedOut: result.usage?.reportedOut,
        costCents: cents,
      });
      if (budgetError && !result.error) {
        // A successful response that overran the cap is still a terminal budget failure.
        (result as BudgetedCallResult).error = `blocked: ${budgetError}`;
      }
    },
  });

  return { ...outcome, costKnown, costCents };
}
