import { describe, expect, test } from "bun:test";
import {
  BACKOFF_INITIAL_MS,
  BACKOFF_MAX_MS,
  freshReconnectState,
  nextBackoffMs,
  notePollFailure,
  notePollProgress,
  pollIsStale,
  POLL_STALE_MS,
} from "../../src/transports/reconnect.ts";

describe("transport reconnect (Nanobot-adapted)", () => {
  test("backoff doubles from 5s to 300s cap", () => {
    expect(nextBackoffMs(0)).toBe(BACKOFF_INITIAL_MS);
    expect(nextBackoffMs(5_000)).toBe(10_000);
    expect(nextBackoffMs(200_000)).toBe(BACKOFF_MAX_MS);
  });

  test("progress resets failures; stale after 120s", () => {
    let state = freshReconnectState(0);
    state = notePollFailure(state);
    expect(state.failures).toBe(1);
    expect(state.backoffMs).toBe(BACKOFF_INITIAL_MS);
    state = notePollProgress(state, 1_000);
    expect(state.failures).toBe(0);
    expect(pollIsStale(state, 1_000 + POLL_STALE_MS)).toBe(true);
    expect(pollIsStale(state, 1_000 + POLL_STALE_MS - 1)).toBe(false);
  });
});
