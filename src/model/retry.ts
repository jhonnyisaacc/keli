import { KeliError } from "../core/errors.ts";
import { DEFAULT_NO_PROGRESS_MAX, DEFAULT_RETRIES_MAX } from "../core/budgets.ts";

export type ProviderErrorClass =
  | "auth"
  | "quota"
  | "invalid_request"
  | "unsupported"
  | "timeout"
  | "transport"
  | "blocked"
  | "unknown";

export type ClassifiedProviderError = {
  class: ProviderErrorClass;
  retryable: boolean;
  message: string;
};

/** Typed classification of provider error strings (`code: message`). Never guesses retryable for auth/invalid. */
export function classifyProviderError(error: string): ClassifiedProviderError {
  const match = /^([a-z_]+):\s*(.*)$/s.exec(error.trim());
  const code = match?.[1] ?? "";
  const message = match?.[2] ?? error;
  switch (code) {
    case "auth":
      return { class: "auth", retryable: false, message };
    case "quota":
      return { class: "quota", retryable: true, message };
    case "invalid_request":
      return { class: "invalid_request", retryable: false, message };
    case "unsupported":
      return { class: "unsupported", retryable: false, message };
    case "timeout":
      return { class: "timeout", retryable: true, message };
    case "transport":
      return { class: "transport", retryable: true, message };
    case "blocked":
      return { class: "blocked", retryable: false, message };
    default:
      if (/timeout|timed out|ECONNRESET|ECONNREFUSED|network|fetch failed/i.test(error)) {
        return { class: "transport", retryable: true, message: error };
      }
      return { class: "unknown", retryable: false, message: error };
  }
}

export function backoffDelayMs(attempt: number, baseMs: number, maxMs = 2000): number {
  if (baseMs <= 0) return 0;
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}

export type RetryStop = "ok" | "non_retryable" | "no_progress" | "retries_exhausted" | "aborted";

export type RetryOutcome<T> = {
  result: T;
  attempts: number;
  stop: RetryStop;
  abortError?: KeliError;
};

export type RetryOptions<T> = {
  retriesMax?: number;
  noProgressMax?: number;
  baseMs?: number;
  errorOf: (result: T) => string | undefined;
  /** Runs before each attempt (budget reservation, cancellation). Throwing a KeliError aborts. */
  beforeAttempt?: (attempt: number) => void | Promise<void>;
  /** Runs after each attempt with its result; accounting happens here for every attempt. */
  afterAttempt?: (attempt: number, result: T) => void | Promise<void>;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Bounded retries with typed eligibility, backoff, and a reachable no-progress stop: the same
 * error observed `noProgressMax` times in a row (initial attempt included) ends the loop even
 * when retries remain. Every attempt is reported to `afterAttempt`.
 */
export async function withBoundedRetries<T>(
  attempt: (n: number) => Promise<T>,
  options: RetryOptions<T>,
): Promise<RetryOutcome<T>> {
  const retriesMax = options.retriesMax ?? DEFAULT_RETRIES_MAX;
  const noProgressMax = options.noProgressMax ?? DEFAULT_NO_PROGRESS_MAX;
  const sleep = options.sleep ?? defaultSleep;
  let attempts = 0;
  let sameErrorCount = 0;
  let previousError: string | undefined;
  let last: T | undefined;

  while (true) {
    attempts += 1;
    try {
      await options.beforeAttempt?.(attempts);
    } catch (e) {
      const keli = e instanceof KeliError ? e : new KeliError(String(e), "unknown");
      if (last === undefined) throw keli;
      return { result: last, attempts: attempts - 1, stop: "aborted", abortError: keli };
    }
    last = await attempt(attempts);
    await options.afterAttempt?.(attempts, last);

    const error = options.errorOf(last);
    if (!error) return { result: last, attempts, stop: "ok" };

    sameErrorCount = error === previousError ? sameErrorCount + 1 : 1;
    previousError = error;
    if (sameErrorCount >= noProgressMax) return { result: last, attempts, stop: "no_progress" };
    if (!classifyProviderError(error).retryable) return { result: last, attempts, stop: "non_retryable" };
    if (attempts > retriesMax) return { result: last, attempts, stop: "retries_exhausted" };

    const delay = backoffDelayMs(attempts, options.baseMs ?? 50);
    if (delay > 0) await sleep(delay);
  }
}
