import type { Database } from "bun:sqlite";

export type NoteRecord = {
  id: string;
  scope: string;
  title: string;
  body: string;
  sourceRef?: string;
  createdAt: string;
};

export function addNote(
  db: Database,
  note: Omit<NoteRecord, "createdAt"> & { createdAt?: string },
): NoteRecord {
  const createdAt = note.createdAt ?? new Date().toISOString();
  db.run(
    `INSERT INTO notes(id, scope, title, body, source_ref, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [note.id, note.scope, note.title, note.body, note.sourceRef ?? null, createdAt],
  );
  db.run(
    `INSERT INTO notes_fts(note_id, scope, title, body) VALUES (?, ?, ?, ?)`,
    [note.id, note.scope, note.title, note.body],
  );
  return { ...note, createdAt };
}

/**
 * Turn free text into a safe FTS5 MATCH expression: each whitespace-separated term is a
 * quoted string (so `-`, `:`, `*`, and operators are literal), terms are implicitly ANDed.
 */
export function ftsMatchExpression(query: string): string {
  const terms = query
    .split(/\s+/)
    .map((term) => term.replace(/"/g, ""))
    .filter((term) => term.length > 0);
  if (terms.length === 0) return '""';
  return terms.map((term) => `"${term}"`).join(" ");
}

export function searchNotes(
  db: Database,
  scope: string,
  query: string,
  limit = 20,
): NoteRecord[] {
  const rows = db
    .query(
      `SELECT n.id, n.scope, n.title, n.body, n.source_ref, n.created_at
       FROM notes_fts f
       JOIN notes n ON n.id = f.note_id
       WHERE notes_fts MATCH ? AND n.scope = ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(ftsMatchExpression(query), scope, limit) as Array<Record<string, string | null>>;
  return rows.map((row) => ({
    id: row.id!,
    scope: row.scope!,
    title: row.title!,
    body: row.body!,
    sourceRef: row.source_ref ?? undefined,
    createdAt: row.created_at!,
  }));
}

export function getNote(db: Database, id: string): NoteRecord | null {
  const row = db.query("SELECT * FROM notes WHERE id = ?").get(id) as Record<string, string | null> | null;
  if (!row) return null;
  return {
    id: row.id!,
    scope: row.scope!,
    title: row.title!,
    body: row.body!,
    sourceRef: row.source_ref ?? undefined,
    createdAt: row.created_at!,
  };
}

export function listNotes(db: Database, scope: string, limit = 50): NoteRecord[] {
  const rows = db
    .query("SELECT * FROM notes WHERE scope = ? ORDER BY created_at DESC LIMIT ?")
    .all(scope, limit) as Array<Record<string, string | null>>;
  return rows.map((row) => ({
    id: row.id!,
    scope: row.scope!,
    title: row.title!,
    body: row.body!,
    sourceRef: row.source_ref ?? undefined,
    createdAt: row.created_at!,
  }));
}
