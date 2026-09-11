import type { Database } from "bun:sqlite";
import type { OutboxStatus } from "../jobs/types.ts";

export type OutboxMessage = {
  id: string;
  scope: string;
  destination: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  createdAt: string;
  deliveredAt?: string;
};

export function enqueueOutbox(
  db: Database,
  message: Omit<OutboxMessage, "createdAt" | "status"> & {
    status?: OutboxStatus;
    createdAt?: string;
  },
): OutboxMessage {
  const createdAt = message.createdAt ?? new Date().toISOString();
  const status = message.status ?? "pending";
  db.run(
    `INSERT INTO outbox_messages(id, scope, destination, payload_json, status, created_at, delivered_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [
      message.id,
      message.scope,
      message.destination,
      JSON.stringify(message.payload),
      status,
      createdAt,
    ],
  );
  return { ...message, status, createdAt };
}

export function markOutboxUnknown(db: Database, id: string, reason: string): void {
  db.run(
    `UPDATE outbox_messages SET status = 'unknown', delivered_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
  const row = db.query("SELECT payload_json FROM outbox_messages WHERE id = ?").get(id) as
    | { payload_json: string }
    | null;
  if (row) {
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    payload.unknownReason = reason;
    db.run("UPDATE outbox_messages SET payload_json = ? WHERE id = ?", [
      JSON.stringify(payload),
      id,
    ]);
  }
}

export function markOutboxFailed(db: Database, id: string, reason: string): void {
  db.run(
    `UPDATE outbox_messages SET status = 'failed', delivered_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
  const row = db.query("SELECT payload_json FROM outbox_messages WHERE id = ?").get(id) as
    | { payload_json: string }
    | null;
  if (row) {
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    payload.failureReason = reason;
    db.run("UPDATE outbox_messages SET payload_json = ? WHERE id = ?", [
      JSON.stringify(payload),
      id,
    ]);
  }
}

export function markOutboxDelivered(
  db: Database,
  id: string,
  receipt?: string,
): void {
  db.run(
    `UPDATE outbox_messages SET status = 'delivered', delivered_at = ? WHERE id = ?`,
    [new Date().toISOString(), id],
  );
  if (receipt) {
    const row = db.query("SELECT payload_json FROM outbox_messages WHERE id = ?").get(id) as
      | { payload_json: string }
      | null;
    if (row) {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      payload.receipt = receipt;
      db.run("UPDATE outbox_messages SET payload_json = ? WHERE id = ?", [
        JSON.stringify(payload),
        id,
      ]);
    }
  }
}

export function listPendingOutbox(db: Database, limit = 50): OutboxMessage[] {
  const rows = db
    .query(
      "SELECT * FROM outbox_messages WHERE status = 'pending' ORDER BY created_at LIMIT ?",
    )
    .all(limit) as Array<Record<string, string>>;
  return rows.map((row) => ({
    id: row.id,
    scope: row.scope,
    destination: row.destination,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    status: row.status as OutboxStatus,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? undefined,
  }));
}
