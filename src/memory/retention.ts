import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ensureArtifactDir, storeArtifact } from "../state/artifacts.ts";
import { advancePreservationCursor } from "../preservation/cursor.ts";
import { appendChangeJournal } from "../state/repos.ts";

export const DEFAULT_RAW_RETENTION_DAYS = 90;
export const DEFAULT_SCRATCH_RETENTION_DAYS = 7;

export type CompactResult = {
  archived: number;
  /** Rows already archived by a previous pass and skipped this time. */
  alreadyArchived: number;
  verified: number;
  cursorJournalId?: string;
  cursorAdvanced: boolean;
  failures: string[];
};

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function verifyArtifact(stateDir: string, relPath: string, expectedHash: string): Promise<boolean> {
  const dir = await ensureArtifactDir(stateDir);
  const file = Bun.file(join(dir, relPath));
  if (!(await file.exists())) return false;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex") === expectedHash;
}

/**
 * Archive-before-advance compaction (Nanobot #5379 lesson). Every eligible row is written to an
 * artifact, read back, and hash-verified before it is marked `archived_at`; the preservation
 * cursor moves only when the whole covered range verified. Rows already marked are skipped, so
 * running compaction twice archives nothing new and never re-advances past lost evidence.
 */
export async function compactMemory(
  db: Database,
  stateDir: string,
  ownerId: string,
  options?: { rawDays?: number; scratchDays?: number },
): Promise<CompactResult> {
  const now = new Date().toISOString();
  const rawUntil = isoDaysFromNow(-(options?.rawDays ?? DEFAULT_RAW_RETENTION_DAYS));
  const notes = db
    .query(
      `SELECT * FROM notes WHERE created_at < ? AND archived_at IS NULL AND (retained_until IS NULL OR retained_until < ?)`,
    )
    .all(rawUntil, now) as Array<Record<string, string | null>>;
  const conversations = db
    .query(
      `SELECT * FROM conversations WHERE created_at < ? AND archived_at IS NULL AND (retained_until IS NULL OR retained_until < ?)`,
    )
    .all(rawUntil, now) as Array<Record<string, string | null>>;
  const alreadyArchived = (
    db
      .query(
        `SELECT (SELECT COUNT(*) FROM notes WHERE created_at < ? AND archived_at IS NOT NULL) +
                (SELECT COUNT(*) FROM conversations WHERE created_at < ? AND archived_at IS NOT NULL) AS n`,
      )
      .get(rawUntil, rawUntil) as { n: number }
  ).n;

  let archived = 0;
  let verified = 0;
  const failures: string[] = [];
  const archivedIds: Array<{ table: string; id: string; artifact: string }> = [];

  for (const row of [...notes, ...conversations]) {
    const table = row.title !== undefined ? "notes" : "conversations";
    const turns =
      table === "conversations"
        ? db.query("SELECT * FROM conversation_turns WHERE conversation_id = ? ORDER BY created_at").all(row.id)
        : [];
    const artifact = await storeArtifact(db, stateDir, {
      ownerId,
      scope: row.scope ?? "global",
      type: table === "notes" ? "memory:note" : "memory:conversation",
      content: JSON.stringify(table === "notes" ? row : { ...row, turns }),
    });
    archived += 1;
    const ok = await verifyArtifact(stateDir, artifact.path, artifact.hash);
    if (!ok) {
      failures.push(`${table}:${row.id}`);
      continue;
    }
    verified += 1;
    db.run(`UPDATE ${table} SET archived_at = ? WHERE id = ?`, [now, row.id]);
    archivedIds.push({ table, id: row.id!, artifact: artifact.hash });
  }

  let cursorJournalId: string | undefined;
  let cursorAdvanced = false;
  if (failures.length === 0) {
    if (archivedIds.length) {
      // The compaction pass is itself journaled, so the cursor always has verified evidence to
      // point at even when no rule/journal activity happened since the last pass.
      appendChangeJournal(db, {
        entityType: "compaction",
        entityId: `compaction:${now}`,
        revision: 0,
        actor: "system",
        sourceRef: "compactMemory",
        payload: { archived: archivedIds, rawUntil },
      });
    }
    const journal = db
      .query("SELECT id FROM change_journal ORDER BY created_at DESC LIMIT 1")
      .get() as { id: string } | null;
    if (journal) {
      advancePreservationCursor(db, journal.id);
      cursorJournalId = journal.id;
      cursorAdvanced = true;
    }
  }

  return { archived, alreadyArchived, verified, cursorJournalId, cursorAdvanced, failures };
}

export function setNoteRetention(db: Database, noteId: string, retainedUntil: string): void {
  db.run("UPDATE notes SET retained_until = ? WHERE id = ?", [retainedUntil, noteId]);
}
