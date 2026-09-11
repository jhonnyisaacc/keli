import type { Database } from "bun:sqlite";

export type TransportRoute = {
  id: string;
  transport: string;
  externalId: string;
  scope: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export function bindTransportRoute(
  db: Database,
  input: {
    transport: string;
    externalId: string;
    scope: string;
    metadata?: Record<string, unknown>;
    id?: string;
    createdAt?: string;
  },
): TransportRoute {
  const id = input.id ?? crypto.randomUUID();
  const createdAt = input.createdAt ?? new Date().toISOString();
  db.run(
    `INSERT OR REPLACE INTO transport_routes(id, transport, external_id, scope, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.transport,
      input.externalId,
      input.scope,
      input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt,
    ],
  );
  return {
    id,
    transport: input.transport,
    externalId: input.externalId,
    scope: input.scope,
    metadata: input.metadata,
    createdAt,
  };
}

export function resolveTransportRoute(
  db: Database,
  transport: string,
  externalId: string,
): TransportRoute | null {
  const row = db
    .query(
      "SELECT * FROM transport_routes WHERE transport = ? AND external_id = ? LIMIT 1",
    )
    .get(transport, externalId) as Record<string, string | null> | null;
  if (!row) return null;
  return rowToRoute(row);
}

export function listTransportRoutes(db: Database, transport?: string): TransportRoute[] {
  const rows = transport
    ? db
        .query("SELECT * FROM transport_routes WHERE transport = ? ORDER BY created_at")
        .all(transport)
    : db.query("SELECT * FROM transport_routes ORDER BY created_at").all();
  return (rows as Array<Record<string, string | null>>).map(rowToRoute);
}

function rowToRoute(row: Record<string, string | null>): TransportRoute {
  return {
    id: row.id!,
    transport: row.transport!,
    externalId: row.external_id!,
    scope: row.scope!,
    metadata: row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : undefined,
    createdAt: row.created_at!,
  };
}
