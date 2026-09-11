import type { CapabilityResult } from "../capabilities/types.ts";
import type { CodingDelegate } from "../core/types.ts";
import { KeliError } from "../core/errors.ts";
import { isCodingDelegate } from "../core/types.ts";

export type DelegateHandoff = {
  actionId: string;
  delegate: CodingDelegate;
  goal: string;
  workspace: string;
  cancelEpoch: number;
};

export type DelegateFixtureResult = {
  sessionId: string;
  status: "completed" | "cancelled" | "failed";
  artifacts: { path: string; bytes: number }[];
  usageBytes: number;
  error?: string;
};

export async function delegateRun(
  input: DelegateHandoff,
  fixtureUrl?: string,
  signal?: AbortSignal,
): Promise<CapabilityResult> {
  if (!isCodingDelegate(input.delegate)) {
    return {
      capabilityId: "delegate.run",
      ok: false,
      error: { code: "invalid_request", message: `Invalid delegate: ${input.delegate}` },
    };
  }
  if (!fixtureUrl) {
    return {
      capabilityId: "delegate.run",
      ok: false,
      error: {
        code: "capability_unavailable",
        message: `${input.delegate} requires KELI_DELEGATE_FIXTURE_URL or configured delegate bridge`,
      },
    };
  }

  try {
    const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/delegate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (!response.ok) {
      throw new KeliError(`Delegate fixture HTTP ${response.status}`, "engine_error");
    }
    const payload = (await response.json()) as DelegateFixtureResult;
    if (payload.status === "cancelled") {
      return {
        capabilityId: "delegate.run",
        ok: false,
        error: { code: "cancelled", message: "Delegate run cancelled" },
        output: payload,
      };
    }
    if (payload.status === "failed") {
      return {
        capabilityId: "delegate.run",
        ok: false,
        error: { code: "engine_error", message: payload.error ?? "Delegate failed" },
        output: payload,
      };
    }
    return {
      capabilityId: "delegate.run",
      ok: true,
      output: payload,
    };
  } catch (e) {
    if (signal?.aborted) {
      return {
        capabilityId: "delegate.run",
        ok: false,
        error: { code: "cancelled", message: "Delegate run aborted" },
      };
    }
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: "delegate.run",
      ok: false,
      error: {
        code: keli?.code ?? "unknown",
        message: keli?.message ?? String(e),
      },
    };
  }
}
