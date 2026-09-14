/**
 * Transport poll reconnect. ADAPT Nanobot telegram/runtime.py liveness
 * (pin f49965445152361b779b465e8a5111549ac934c4, MIT): a healthy getUpdates
 * long-poll completes about every 10s; stalls are detected locally; rebuild
 * backoff starts at 5s and caps at 300s. Hermes PTB CLOSE-WAIT machinery is
 * not imported.
 */

export const POLL_STALE_MS = 120_000;
export const BACKOFF_INITIAL_MS = 5_000;
export const BACKOFF_MAX_MS = 300_000;

export function nextBackoffMs(previousMs: number): number {
  if (previousMs <= 0) return BACKOFF_INITIAL_MS;
  return Math.min(previousMs * 2, BACKOFF_MAX_MS);
}

export async function sleepBackoff(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    };
    if (signal?.aborted) {
      clearTimeout(timer);
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type ReconnectState = {
  failures: number;
  backoffMs: number;
  lastProgressAt: number;
};

export function freshReconnectState(now = Date.now()): ReconnectState {
  return { failures: 0, backoffMs: 0, lastProgressAt: now };
}

export function notePollProgress(state: ReconnectState, now = Date.now()): ReconnectState {
  return { failures: 0, backoffMs: 0, lastProgressAt: now };
}

export function notePollFailure(state: ReconnectState): ReconnectState {
  const backoffMs = nextBackoffMs(state.backoffMs);
  return { failures: state.failures + 1, backoffMs, lastProgressAt: state.lastProgressAt };
}

export function pollIsStale(state: ReconnectState, now = Date.now(), staleMs = POLL_STALE_MS): boolean {
  return now - state.lastProgressAt >= staleMs;
}
