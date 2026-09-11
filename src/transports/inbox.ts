import type { Database } from "bun:sqlite";

export type InboxRecord = {
  id: string;
  transport: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  scope?: string;
  createdAt: string;
  processedAt?: string;
};

/** Returns null when duplicate update_id is already recorded. */
export function recordInboxMessage(
  db: Database,
  message: {
    transport: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
    scope?: string;
  },
): InboxRecord | null {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    db.run(
      `INSERT INTO transport_inbox(id, transport, dedupe_key, payload_json, scope, processed_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [
        id,
        message.transport,
        message.dedupeKey,
        JSON.stringify(message.payload),
        message.scope ?? null,
        createdAt,
      ],
    );
    return {
      id,
      transport: message.transport,
      dedupeKey: message.dedupeKey,
      payload: message.payload,
      scope: message.scope,
      createdAt,
    };
  } catch {
    return null;
  }
}

export function listUnprocessedInbox(
  db: Database,
  transport?: string,
  limit = 50,
): InboxRecord[] {
  const rows = transport
    ? db
        .query(
          `SELECT * FROM transport_inbox
           WHERE processed_at IS NULL AND transport = ?
           ORDER BY created_at LIMIT ?`,
        )
        .all(transport, limit)
    : db
        .query(
          `SELECT * FROM transport_inbox
           WHERE processed_at IS NULL
           ORDER BY created_at LIMIT ?`,
        )
        .all(limit);
  return (rows as Array<Record<string, string | null>>).map(rowToInbox);
}

export function markInboxProcessed(db: Database, id: string): void {
  db.run("UPDATE transport_inbox SET processed_at = ? WHERE id = ?", [
    new Date().toISOString(),
    id,
  ]);
}

function rowToInbox(row: Record<string, string | null>): InboxRecord {
  return {
    id: row.id!,
    transport: row.transport!,
    dedupeKey: row.dedupe_key!,
    payload: JSON.parse(row.payload_json!) as Record<string, unknown>,
    scope: row.scope ?? undefined,
    createdAt: row.created_at!,
    processedAt: row.processed_at ?? undefined,
  };
}
