import type { Database } from "bun:sqlite";
import type { CapabilityGate } from "../core/capability-gate.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { sendDiscordMessage } from "../transports/discord.ts";
import {
  linkOccurrenceRun,
  setOccurrenceStatus,
  getOccurrenceActionId,
} from "./occurrences.ts";
import type { JobRecord } from "./types.ts";

export type JobDispatchDeps = {
  gate: CapabilityGate;
  policy: ResourcePolicy;
  stateDir: string;
  notifyChannel?: string;
  simulateChanged?: boolean;
};

export type JobDispatchResult = {
  occurrenceId: string;
  runId: string;
  actionId: string;
  changed: boolean;
  quiet: boolean;
  deliveryFailed?: boolean;
};

function completionReason(missedSlots: number, changed: boolean, deliveryFailed?: boolean): string {
  const parts: string[] = [];
  if (missedSlots > 1) parts.push(`coalesced ${missedSlots} missed ticks`);
  parts.push(changed ? "observation changed" : "unchanged observation (zero model calls)");
  if (deliveryFailed) parts.push("delivery failed; execution recorded");
  return parts.join("; ");
}

export async function dispatchJobOccurrence(
  db: Database,
  deps: JobDispatchDeps,
  job: JobRecord,
  occurrenceId: string,
  missedSlots: number,
): Promise<JobDispatchResult> {
  setOccurrenceStatus(db, occurrenceId, "running");

  const existingAction = getOccurrenceActionId(db, occurrenceId);
  if (existingAction) {
    setOccurrenceStatus(
      db,
      occurrenceId,
      "completed",
      "already acknowledged; not repeated (A21)",
    );
    return {
      occurrenceId,
      runId: "",
      actionId: existingAction,
      changed: false,
      quiet: true,
    };
  }

  const { actionId, runId, result } = await deps.gate.run(
    {
      capabilityId: "jobs.observe",
      input: {
        jobId: job.id,
        occurrenceId,
        jobName: job.name,
        missedSlots,
        simulateChanged: deps.simulateChanged ?? false,
      },
      resources: [],
    },
    deps.policy,
    job.scope,
    undefined,
    { budgetBytesMax: 4096 },
  );

  linkOccurrenceRun(db, occurrenceId, runId, actionId);

  const output = result.output as { changed?: boolean; quiet?: boolean } | undefined;
  const changed = Boolean(output?.changed);
  const quiet = output?.quiet ?? !changed;

  let deliveryFailed = false;
  if (changed && deps.notifyChannel) {
    try {
      await sendDiscordMessage(db, {
        channelId: deps.notifyChannel,
        message: `Job ${job.name}: observation changed`,
        scope: job.scope,
      });
    } catch {
      deliveryFailed = true;
    }
  }

  const terminalStatus = result.ok ? "completed" : "failed";
  setOccurrenceStatus(
    db,
    occurrenceId,
    terminalStatus,
    result.ok
      ? completionReason(missedSlots, changed, deliveryFailed)
      : result.error?.message ?? "observation failed",
  );

  return {
    occurrenceId,
    runId,
    actionId,
    changed,
    quiet,
    deliveryFailed: deliveryFailed || undefined,
  };
}
