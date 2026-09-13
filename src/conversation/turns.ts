import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";

export type TurnRole = "user" | "assistant" | "tool" | "system";
export type TurnKind =
  | "message"
  | "tool_call"
  | "tool_result"
  | "answer"
  | "missing_evidence"
  | "clarify"
  | "correction"
  | "blocked"
  | "error";

export type ConversationTurn = {
  id: string;
  conversationId: string;
  scope: string;
  role: TurnRole;
  kind: TurnKind;
  content: string;
  refs?: Record<string, unknown>;
  runId?: string;
  sourceRef?: string;
  createdAt: string;
};

export const MAX_INLINE_TURN_CHARS = 8 * 1024;

/** Deterministic id so a replayed inbox message never creates a second user turn. */
export function turnIdFor(conversationId: string, sourceRef: string, suffix: string): string {
  return createHash("sha256").update(`${conversationId}|${sourceRef}|${suffix}`).digest("hex").slice(0, 32);
}

/** Returns the existing turn when the id is already present (idempotent replay). */
export function appendTurn(
  db: Database,
  turn: Omit<ConversationTurn, "createdAt" | "id"> & { id?: string; createdAt?: string },
): { turn: ConversationTurn; duplicate: boolean } {
  const id = turn.id ?? crypto.randomUUID();
  const existing = db.query("SELECT * FROM conversation_turns WHERE id = ?").get(id) as Record<string, string | null> | null;
  if (existing) return { turn: rowToTurn(existing), duplicate: true };
  const createdAt = turn.createdAt ?? new Date().toISOString();
  const content = turn.content.length > MAX_INLINE_TURN_CHARS ? `${turn.content.slice(0, MAX_INLINE_TURN_CHARS)}…[truncated]` : turn.content;
  db.run(
    `INSERT INTO conversation_turns(id, conversation_id, scope, role, kind, content, refs_json, run_id, source_ref, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      turn.conversationId,
      turn.scope,
      turn.role,
      turn.kind,
      content,
      turn.refs ? JSON.stringify(turn.refs) : null,
      turn.runId ?? null,
      turn.sourceRef ?? null,
      createdAt,
    ],
  );
  return { turn: { ...turn, id, content, createdAt }, duplicate: false };
}

export function listTurns(db: Database, conversationId: string, limit = 40): ConversationTurn[] {
  const rows = db
    .query(
      `SELECT * FROM (
         SELECT * FROM conversation_turns WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?
       ) ORDER BY created_at ASC`,
    )
    .all(conversationId, limit) as Array<Record<string, string | null>>;
  return rows.map(rowToTurn);
}

export function findTurnBySource(db: Database, conversationId: string, sourceRef: string, kind: TurnKind): ConversationTurn | null {
  const row = db
    .query("SELECT * FROM conversation_turns WHERE conversation_id = ? AND source_ref = ? AND kind = ? LIMIT 1")
    .get(conversationId, sourceRef, kind) as Record<string, string | null> | null;
  return row ? rowToTurn(row) : null;
}

function rowToTurn(row: Record<string, string | null>): ConversationTurn {
  return {
    id: row.id!,
    conversationId: row.conversation_id!,
    scope: row.scope!,
    role: row.role as TurnRole,
    kind: row.kind as TurnKind,
    content: row.content ?? "",
    refs: row.refs_json ? (JSON.parse(row.refs_json) as Record<string, unknown>) : undefined,
    runId: row.run_id ?? undefined,
    sourceRef: row.source_ref ?? undefined,
    createdAt: row.created_at!,
  };
}
