import type { CapabilityResult } from "../capabilities/types.ts";

export type JobsObserveInput = {
  jobId: string;
  occurrenceId: string;
  jobName: string;
  missedSlots?: number;
  /** Test hook: simulate a changed observation that warrants notification. */
  simulateChanged?: boolean;
};

export async function jobsObserve(input: JobsObserveInput): Promise<CapabilityResult> {
  const changed = Boolean(input.simulateChanged);
  return {
    capabilityId: "jobs.observe",
    ok: true,
    output: {
      jobId: input.jobId,
      occurrenceId: input.occurrenceId,
      jobName: input.jobName,
      changed,
      quiet: !changed,
      missedSlots: input.missedSlots ?? 1,
    },
  };
}
