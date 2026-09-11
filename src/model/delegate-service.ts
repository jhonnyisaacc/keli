import type { Database } from "bun:sqlite";
import type { ProposalRequest } from "../core/gate.ts";
import type { CodingDelegate } from "../core/types.ts";
import { delegateRun, type DelegateHandoff } from "../adapters/delegate.ts";
import { acquireLease, validateFence } from "../state/repos.ts";
import { KeliError } from "../core/errors.ts";

export type DelegateServiceConfig = {
  primary: CodingDelegate;
  fallback?: CodingDelegate;
  fixtureUrl?: string;
};

export type DelegateExecution = {
  delegate: CodingDelegate;
  usedFallback: boolean;
  output?: unknown;
  error?: string;
};

export class DelegateService {
  constructor(
    private readonly db: Database,
    private readonly config: DelegateServiceConfig,
  ) {}

  async execute(
    prepared: ProposalRequest,
    workspace: string,
    runOverride?: CodingDelegate,
  ): Promise<DelegateExecution> {
    const primary = runOverride ?? this.config.primary;
    const fixtureUrl = this.config.fixtureUrl;
    if (!fixtureUrl) {
      throw new KeliError(
        "Delegate conformance requires KELI_DELEGATE_FIXTURE_URL or configured bridge",
        "capability_unavailable",
      );
    }

    const primaryHolder = `delegate:${primary}`;
    const primaryToken = acquireLease(this.db, primaryHolder);
    const primaryResult = await this.runOne(prepared, primary, workspace, 0, fixtureUrl);
    if (primaryResult.ok) {
      if (!validateFence(this.db, primaryHolder, primaryToken)) {
        return {
          delegate: primary,
          usedFallback: false,
          error: "Stale writer rejected by fencing token",
          output: primaryResult.output,
        };
      }
      return {
        delegate: primary,
        usedFallback: false,
        output: primaryResult.output,
      };
    }

    if (!this.config.fallback || runOverride) {
      return {
        delegate: primary,
        usedFallback: false,
        error: primaryResult.error?.message ?? "Delegate failed",
        output: primaryResult.output,
      };
    }

    acquireLease(this.db, primaryHolder);
    const fallback = this.config.fallback;
    const fallbackHolder = `delegate:${fallback}`;
    const fallbackToken = acquireLease(this.db, fallbackHolder);
    const fallbackResult = await this.runOne(prepared, fallback, workspace, 0, fixtureUrl);
    if (fallbackResult.ok) {
      if (!validateFence(this.db, fallbackHolder, fallbackToken)) {
        return {
          delegate: fallback,
          usedFallback: true,
          error: "Stale writer rejected by fencing token",
          output: fallbackResult.output,
        };
      }
      return {
        delegate: fallback,
        usedFallback: true,
        output: fallbackResult.output,
      };
    }

    return {
      delegate: fallback,
      usedFallback: true,
      error: fallbackResult.error?.message ?? "Fallback delegate failed",
      output: fallbackResult.output,
    };
  }

  private async runOne(
    prepared: ProposalRequest,
    delegate: CodingDelegate,
    workspace: string,
    cancelEpoch: number,
    fixtureUrl: string,
  ) {
    const handoff: DelegateHandoff = {
      actionId: prepared.id,
      delegate,
      goal: prepared.request,
      workspace,
      cancelEpoch,
    };
    return delegateRun(handoff, fixtureUrl);
  }
}
