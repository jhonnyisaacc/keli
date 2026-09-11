import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { migrate, CURRENT_SCHEMA_VERSION } from "./migrate.ts";
import { reconcileJobs } from "../jobs/scheduler.ts";
import { reconcileOutbox } from "../transports/reconcile.ts";
import { processTransportInbox } from "../transports/inbox-processor.ts";
import { resolveStateDir, statePaths } from "./paths.ts";

export type KeliDatabase = Database;

export async function openDatabase(stateDir?: string): Promise<KeliDatabase> {
  const paths = statePaths(resolveStateDir(stateDir));
  await mkdir(dirname(paths.sqlite), { recursive: true });
  const db = new Database(paths.sqlite, { create: true });
  migrate(db, CURRENT_SCHEMA_VERSION);
  recoverInterruptedActions(db);
  reconcileJobs(db);
  await reconcileOutbox(db);
  processTransportInbox(db);
  return db;
}

export function recoverInterruptedActions(db: Database): void {
  db.run(
    `UPDATE actions SET status = 'interrupted', reason = 'Process restarted before terminal record'
     WHERE status = 'prepared'`,
  );
}

export function closeDatabase(db: Database): void {
  db.close();
}
