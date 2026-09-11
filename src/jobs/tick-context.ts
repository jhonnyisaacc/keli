import type { Database } from "bun:sqlite";
import { CapabilityGate } from "../core/capability-gate.ts";
import { defaultRegistry } from "../capabilities/registry.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { dispatchJobOccurrence, type JobDispatchDeps } from "./dispatch.ts";
import type { JobRecord } from "./types.ts";

export type JobTickContext = {
  dispatch: (
    db: Database,
    job: JobRecord,
    occurrenceId: string,
    missedSlots: number,
  ) => Promise<void>;
};

export function createJobTickContext(input: {
  db: Database;
  ownerId: string;
  stateDir: string;
  policy: ResourcePolicy;
  notifyChannel?: string;
  simulateChanged?: boolean;
}): JobTickContext {
  const gate = new CapabilityGate(
    input.db,
    defaultRegistry,
    input.stateDir,
    input.ownerId,
  );
  const deps: JobDispatchDeps = {
    gate,
    policy: input.policy,
    stateDir: input.stateDir,
    notifyChannel: input.notifyChannel,
    simulateChanged: input.simulateChanged,
  };
  return {
    dispatch: async (db, job, occurrenceId, missedSlots) => {
      await dispatchJobOccurrence(db, deps, job, occurrenceId, missedSlots);
    },
  };
}
