import type { Database } from "bun:sqlite";
import type { CapabilityRegistry } from "../capabilities/registry.ts";
import type { CapabilityProposal, CapabilityResult } from "../capabilities/types.ts";
import { completeHelperRun, spawnHelperRun } from "../execution/helpers.ts";
import type { DispatchContext } from "../execution/dispatch-context.ts";
import { KeliError } from "../core/errors.ts";
import { finishRun } from "../core/run-control.ts";

export async function helpersSpawn(
  input: { capabilityId: string; input: Record<string, unknown> },
  ctx: DispatchContext,
  registry: CapabilityRegistry,
): Promise<CapabilityResult> {
  if (!ctx.run) {
    return {
      capabilityId: "helpers.spawn",
      ok: false,
      error: { code: "invalid_request", message: "helpers.spawn requires an active run" },
    };
  }
  if (!ctx.stateDir || !ctx.ownerId) {
    return {
      capabilityId: "helpers.spawn",
      ok: false,
      error: {
        code: "invalid_request",
        message: "helpers.spawn requires gate context (stateDir, ownerId)",
      },
    };
  }
  if (input.capabilityId === "helpers.spawn") {
    return {
      capabilityId: "helpers.spawn",
      ok: false,
      error: { code: "invalid_request", message: "Nested helpers.spawn is not allowed" },
    };
  }

  const scopeRow = ctx.run.db
    .query("SELECT scope FROM runs WHERE id = ?")
    .get(ctx.run.runId) as { scope: string } | null;
  if (!scopeRow) {
    return {
      capabilityId: "helpers.spawn",
      ok: false,
      error: { code: "invalid_request", message: "Parent run scope missing" },
    };
  }

  let helperId: string | undefined;
  let childRunId: string | undefined;
  try {
    const helper = spawnHelperRun(ctx.run.db, ctx.run.runId, scopeRow.scope, input.capabilityId);
    helperId = helper.id;
    childRunId = helper.childRunId;
    const { CapabilityGate } = await import("../core/capability-gate.ts");
    const gate = new CapabilityGate(ctx.run.db, registry, ctx.stateDir, ctx.ownerId);
    const childProposal: CapabilityProposal = {
      capabilityId: input.capabilityId,
      input: input.input,
      resources: [],
    };
    const { result: childResult } = await gate.run(
      childProposal,
      ctx.policy,
      scopeRow.scope,
      ctx.cwd,
      {
        runId: helper.childRunId,
        jobId: ctx.jobId,
        fixtures: ctx.fixtures,
        browser: ctx.browser,
        networkHosts: ctx.network.allowedHosts,
      },
    );
    completeHelperRun(ctx.run.db, helper.id, childResult.ok ? "completed" : "failed");
    terminalizeIfActive(ctx.run.db, helper.childRunId, childResult.ok ? "completed" : "failed");
    return {
      capabilityId: "helpers.spawn",
      ok: childResult.ok,
      output: childResult.ok
        ? { helperId: helper.id, childRunId: helper.childRunId, result: childResult.output }
        : undefined,
      error: childResult.error,
    };
  } catch (e) {
    if (helperId) completeHelperRun(ctx.run.db, helperId, "failed");
    if (childRunId) terminalizeIfActive(ctx.run.db, childRunId, "failed");
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: "helpers.spawn",
      ok: false,
      error: {
        code: keli?.code ?? "engine_error",
        message: keli?.message ?? String(e),
      },
    };
  }
}

function terminalizeIfActive(db: Database, runId: string, status: "completed" | "failed"): void {
  const row = db.query("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string } | null;
  if (row?.status === "active") {
    finishRun(db, runId, status);
  }
}
