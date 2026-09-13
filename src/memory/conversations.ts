import type { Database } from "bun:sqlite";

export type ConversationRecord = {
  id: string;
  scope: string;
  transport?: string;
  externalId?: string;
  routeId?: string;
  summary?: string;
  createdAt: string;
  retainedUntil?: string;
};

export function upsertConversation(
  db: Database,
  input: {
    scope: string;
    transport?: string;
    externalId?: string;
    routeId?: string;
    summary?: string;
  },
): ConversationRecord {
  const existing = input.transport && input.externalId
    ? (db
        .query("SELECT * FROM conversations WHERE transport = ? AND external_id = ?")
        .get(input.transport, input.externalId) as Record<string, string | null> | null)
    : null;
  if (existing) {
    if (input.summary) {
      db.run("UPDATE conversations SET summary = ?, route_id = COALESCE(?, route_id) WHERE id = ?", [
        input.summary,
        input.routeId ?? null,
        existing.id,
      ]);
    }
    return rowToConversation({ ...existing, summary: input.summary ?? existing.summary });
  }
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO conversations(id, scope, transport, external_id, summary, created_at, route_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.scope,
      input.transport ?? null,
      input.externalId ?? null,
      input.summary ?? null,
      createdAt,
      input.routeId ?? null,
    ],
  );
  return {
    id,
    scope: input.scope,
    transport: input.transport,
    externalId: input.externalId,
    routeId: input.routeId,
    summary: input.summary,
    createdAt,
  };
}

export function listConversations(db: Database, limit = 50): ConversationRecord[] {
  const rows = db
    .query("SELECT * FROM conversations ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Array<Record<string, string | null>>;
  return rows.map(rowToConversation);
}

function rowToConversation(row: Record<string, string | null>): ConversationRecord {
  return {
    id: row.id!,
    scope: row.scope!,
    transport: row.transport ?? undefined,
    externalId: row.external_id ?? undefined,
    routeId: row.route_id ?? undefined,
    summary: row.summary ?? undefined,
    createdAt: row.created_at!,
    retainedUntil: row.retained_until ?? undefined,
  };
}
