import type { Database } from "bun:sqlite";
import { createJobTickContext } from "../../src/jobs/tick-context.ts";

export function jobTickContext(
  db: Database,
  options?: {
    ownerId?: string;
    stateDir?: string;
    notifyChannel?: string;
    simulateChanged?: boolean;
  },
) {
  return createJobTickContext({
    db,
    ownerId: options?.ownerId ?? "owner-1",
    stateDir: options?.stateDir ?? "/tmp/keli-job-test",
    policy: { readableRoots: ["/tmp"], writableRoots: ["/tmp"] },
    notifyChannel: options?.notifyChannel,
    simulateChanged: options?.simulateChanged,
  });
}
