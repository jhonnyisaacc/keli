import type { Database } from "bun:sqlite";

export type TaskCheckpoint = {
  id: string;
  scope: string;
  runId?: string;
  goal: string;
  state: {
    done: string[];
    pending: string[];
    evidence: string[];
  };
  createdAt: string;
};

export function writeCheckpoint(
  db: Database,
  input: {
    scope: string;
    runId?: string;
    goal: string;
    state: TaskCheckpoint["state"];
  },
): TaskCheckpoint {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO task_checkpoints(id, scope, goal, state_json, created_at, run_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.scope, input.goal, JSON.stringify(input.state), createdAt, input.runId ?? null],
  );
  return { id, scope: input.scope, runId: input.runId, goal: input.goal, state: input.state, createdAt };
}

export function getLatestCheckpoint(db: Database, scope: string): TaskCheckpoint | null {
  const row = db
    .query("SELECT * FROM task_checkpoints WHERE scope = ? ORDER BY created_at DESC LIMIT 1")
    .get(scope) as Record<string, string | null> | null;
  if (!row) return null;
  return {
    id: row.id!,
    scope: row.scope!,
    runId: row.run_id ?? undefined,
    goal: row.goal!,
    state: JSON.parse(row.state_json ?? "{}") as TaskCheckpoint["state"],
    createdAt: row.created_at!,
  };
}
