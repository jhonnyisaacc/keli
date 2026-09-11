import type { Database } from "bun:sqlite";

export type PreservationCursor = {
  id: string;
  lastJournalId: string | null;
  lastArchivedAt: string | null;
};

export function readPreservationCursor(db: Database): PreservationCursor {
  const row = db.query("SELECT * FROM preservation_cursor WHERE id = 'default'").get() as
    | Record<string, string | null>
    | null;
  return {
    id: "default",
    lastJournalId: row?.last_journal_id ?? null,
    lastArchivedAt: row?.last_archived_at ?? null,
  };
}

export function advancePreservationCursor(
  db: Database,
  journalId: string,
): PreservationCursor {
  const at = new Date().toISOString();
  db.run(
    `UPDATE preservation_cursor SET last_journal_id = ?, last_archived_at = ? WHERE id = 'default'`,
    [journalId, at],
  );
  return readPreservationCursor(db);
}

export function assertNoPreservationGap(db: Database, journalId: string): void {
  const cursor = readPreservationCursor(db);
  if (!cursor.lastJournalId) return;
  const rows = db
    .query(
      `SELECT id FROM change_journal
       WHERE created_at > (SELECT created_at FROM change_journal WHERE id = ? LIMIT 1)
         AND created_at <= (SELECT created_at FROM change_journal WHERE id = ? LIMIT 1)
       ORDER BY created_at`,
    )
    .all(cursor.lastJournalId, journalId) as Array<{ id: string }>;
  const gap = rows.find((r) => r.id !== journalId && r.id !== cursor.lastJournalId);
  if (gap) {
    throw new Error(`Preservation gap detected before journal ${journalId}`);
  }
}
