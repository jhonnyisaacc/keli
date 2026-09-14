import type { Database } from "bun:sqlite";
import type { CapabilityRegistry } from "../capabilities/registry.ts";
import type { CapabilityProposal, CapabilityResult } from "../capabilities/types.ts";
import { dispatchCapability } from "../execution/dispatch.ts";
import type { DispatchContext } from "../execution/dispatch-context.ts";
import { defaultNetworkPolicy, fixtureEndpointsFromEnv } from "../execution/dispatch-context.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { storeArtifact } from "../state/artifacts.ts";
import { KeliError } from "./errors.ts";
import { consumeRequestBudget } from "./budgets.ts";
import { createRun, getRun, assertNotCancelled, finishRun } from "./run-control.ts";
import { parentHasRunningHelpers } from "../execution/helpers.ts";
import { readControl, isEffectfulBlocked } from "../ops/control.ts";
import { jobAllowsActionClass } from "../jobs/grants.ts";
import { writeCheckpoint } from "../memory/checkpoints.ts";

export type CapabilityActionRecord = {
  id: string;
  scope: string;
  capability: string;
  status: string;
  reason: string | null;
  candidate: string | null;
};

export type CapabilityRunOptions = {
  /** Trusted controller rechecks occurrence ownership/current approval at dispatch. */
  assertDispatch?: () => void | Promise<void>;
  runId?: string;
  networkHosts?: string[];
  fixtures?: DispatchContext["fixtures"];
  browser?: DispatchContext["browser"];
  budgetBytesMax?: number;
  proposalBytesMax?: number;
  jobId?: string;
  sources?: DispatchContext["sources"];
};

export class CapabilityGate {
  constructor(
    private readonly db: Database,
    private readonly registry: CapabilityRegistry,
    private readonly stateDir: string,
    private readonly ownerId: string,
  ) {}

  prepare(proposal: CapabilityProposal, scope: string, runId?: string): string {
    const id = crypto.randomUUID();
    const digest = JSON.stringify({ capabilityId: proposal.capabilityId, input: proposal.input });
    this.db.run(
      `INSERT INTO actions(id, run_id, scope, capability, proposal_digest, start_revision, gate_revision, candidate, status, reason, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 'prepared', NULL, ?)`,
      [
        id,
        runId ?? null,
        scope,
        proposal.capabilityId,
        digest,
        new Date().toISOString(),
      ],
    );
    return id;
  }

  async run(
    proposal: CapabilityProposal,
    policy: ResourcePolicy,
    scope: string,
    cwd?: string,
    options?: CapabilityRunOptions,
  ): Promise<{ actionId: string; runId: string; result: CapabilityResult }> {
    const control = await readControl(this.stateDir);
    await options?.assertDispatch?.();
    const descriptor = this.registry.get(proposal.capabilityId);
    if (descriptor && descriptor.actionClass !== "read" && isEffectfulBlocked(control)) {
      const actionId = this.prepare(proposal, scope, options?.runId);
      const result = await this.finish(actionId, {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: {
          code: "autonomy_paused",
          message: "Global pause blocks effectful capabilities",
        },
      });
      return { actionId, runId: options?.runId ?? "", result };
    }

    if (
      descriptor &&
      !jobAllowsActionClass(this.db, options?.jobId, descriptor.actionClass)
    ) {
      const actionId = this.prepare(proposal, scope, options?.runId);
      const result = await this.finish(actionId, {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: {
          code: "grant_required",
          message: `Job grant required for ${descriptor.actionClass} capability ${proposal.capabilityId}`,
        },
      });
      return { actionId, runId: options?.runId ?? "", result };
    }

    const proposalBytes = Buffer.byteLength(JSON.stringify(proposal));
    if (options?.proposalBytesMax && proposalBytes > options.proposalBytesMax) {
      const actionId = this.prepare(proposal, scope, options?.runId);
      const result = await this.finish(actionId, {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: {
          code: "quota_exceeded",
          message: `Proposal exceeds pre-dispatch byte guard (${proposalBytes} > ${options.proposalBytesMax})`,
        },
      });
      return { actionId, runId: options?.runId ?? "", result };
    }

    const runId = options?.runId ?? createRun(this.db, scope, options?.budgetBytesMax);
    const run = getRun(this.db, runId);
    if (!run) throw new KeliError(`Unknown run: ${runId}`, "invalid_request");
    if (run.status === "cancelled") {
      const actionId = this.prepare(proposal, scope, runId);
      const result = await this.finish(actionId, {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: { code: "cancelled", message: "Run already cancelled" },
      });
      return { actionId, runId, result };
    }
    const cancelEpoch = run.cancel_epoch;

    try {
      consumeRequestBudget(this.db, runId);
    } catch (e) {
      const keli = e instanceof KeliError ? e : null;
      const actionId = this.prepare(proposal, scope, runId);
      const result = await this.finish(actionId, {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: {
          code: keli?.code ?? "quota_exceeded",
          message: keli?.message ?? String(e),
        },
      });
      finishRun(this.db, runId, "failed");
      return { actionId, runId, result };
    }

    const actionId = this.prepare(proposal, scope, runId);
    const ctx: DispatchContext = {
      policy,
      network: defaultNetworkPolicy(options?.networkHosts),
      fixtures: options?.fixtures ?? fixtureEndpointsFromEnv(),
      browser: options?.browser,
      cwd,
      run: { db: this.db, runId, cancelEpoch },
      jobId: options?.jobId,
      stateDir: this.stateDir,
      ownerId: this.ownerId,
      sources: options?.sources,
    };

    let raw: CapabilityResult;
    try {
      raw = await dispatchCapability(this.registry, proposal, ctx);
    } catch (e) {
      const keli = e instanceof KeliError ? e : null;
      raw = {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: {
          code: keli?.code ?? "engine_error",
          message: keli?.message ?? String(e),
          retryable: keli?.retryable ?? false,
        },
      };
    }

    try {
      assertNotCancelled(this.db, runId, cancelEpoch);
    } catch (e) {
      const keli = e instanceof KeliError ? e : null;
      raw = {
        capabilityId: proposal.capabilityId,
        ok: false,
        error: {
          code: keli?.code ?? "cancelled",
          message: keli?.message ?? String(e),
        },
      };
      finishRun(this.db, runId, "cancelled");
    }

    const result = await this.finish(actionId, raw);
    try {
      writeCheckpoint(this.db, {
        scope,
        runId,
        goal: proposal.capabilityId,
        state: {
          done: result.ok ? [proposal.capabilityId] : [],
          pending: result.ok ? [] : [proposal.capabilityId],
          evidence: (result.artifacts ?? []).map((a) => a.hash).filter((h): h is string => Boolean(h)),
        },
      });
    } catch {
      // checkpoints require schema v10 run_id; ignore if migration not applied
    }
    if (result.ok) {
      if (!parentHasRunningHelpers(this.db, runId)) {
        finishRun(this.db, runId, "completed");
      }
    } else if (result.error?.code !== "cancelled") {
      finishRun(this.db, runId, "failed");
    }
    return { actionId, runId, result };
  }

  async finish(actionId: string, result: CapabilityResult): Promise<CapabilityResult> {
    const action = this.getPrepared(actionId);
    if (!action) {
      throw new KeliError("Unknown or terminal capability action", "invalid_request");
    }

    const status = result.ok ? "executed" : "blocked";
    const reason = result.ok
      ? "capability executed"
      : result.error?.message ?? "capability failed";

    this.db.transaction(() => {
      this.db.run(
        `UPDATE actions SET candidate = ?, status = ?, reason = ?, gate_revision = 0 WHERE id = ?`,
        [JSON.stringify(result), status, reason, actionId],
      );
    }).immediate();

    if (result.ok && result.output !== undefined) {
      const artifact = await storeArtifact(this.db, this.stateDir, {
        actionId,
        ownerId: this.ownerId,
        scope: action.scope,
        type: `capability:${result.capabilityId}`,
        content: JSON.stringify(result.output),
      });
      result.artifacts = [{ path: artifact.path, hash: artifact.hash }];
    }

    return result;
  }

  private getPrepared(actionId: string): CapabilityActionRecord | null {
    const row = this.db
      .query("SELECT id, scope, capability, status, reason, candidate FROM actions WHERE id = ?")
      .get(actionId) as CapabilityActionRecord | null;
    if (!row || row.status !== "prepared") return null;
    return row;
  }

  terminalStatus(actionId: string): string | null {
    const row = this.db
      .query("SELECT status FROM actions WHERE id = ?")
      .get(actionId) as { status: string } | null;
    return row?.status ?? null;
  }
}
