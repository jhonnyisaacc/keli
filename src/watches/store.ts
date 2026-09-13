import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { KeliError } from "../core/errors.ts";
import { parseSchedule } from "../jobs/schedule.ts";
import type { WatchDefinition, WatchEvent, WatchEventKind, WatchRecord, WatchStatus } from "./types.ts";

const DEFAULT_MAX_FAILURES = 3;

type Row = {
  id: string;
  owner_id: string;
  scope: string;
  name: string;
  kind: string;
  version: number;
  status: string;
  trigger_json: string;
  budget_json: string;
  evidence_json: string;
  notify_json: string;
  source_ref: string | null;
  last_fingerprint: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
};

function toRecord(row: Row): WatchRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    scope: row.scope,
    name: row.name,
    kind: row.kind as WatchRecord["kind"],
    version: row.version,
    status: row.status as WatchStatus,
    trigger: JSON.parse(row.trigger_json),
    budget: JSON.parse(row.budget_json),
    evidence: JSON.parse(row.evidence_json),
    notify: JSON.parse(row.notify_json),
    sourceRef: row.source_ref ?? undefined,
    lastFingerprint: row.last_fingerprint ?? undefined,
    lastAttemptAt: row.last_attempt_at ?? undefined,
    lastSuccessAt: row.last_success_at ?? undefined,
    lastError: row.last_error ?? undefined,
    attempts: row.attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Deterministic id per scope+name so re-importing the same definition updates, never duplicates. */
export function watchId(scope: string, name: string): string {
  return `watch-${createHash("sha256").update(`${scope}\0${name.toLowerCase()}`).digest("hex").slice(0, 16)}`;
}

export function validateDefinition(def: WatchDefinition): void {
  if (!/^[a-z0-9][a-z0-9 _.-]{0,63}$/i.test(def.name)) {
    throw new KeliError(`Invalid watch name: ${def.name}`, "invalid_request");
  }
  if (def.kind !== "source-collection" && def.kind !== "url") {
    throw new KeliError(`Unsupported watch kind: ${String(def.kind)}`, "invalid_request");
  }
  parseSchedule(def.trigger.schedule);
  if (!def.trigger.target?.trim()) throw new KeliError("Watch trigger needs a target", "invalid_request");
  if (def.kind === "url" && !/^https?:\/\//.test(def.trigger.target)) {
    throw new KeliError("url watches need an http(s) target", "invalid_request");
  }
  if (!def.evidence.question?.trim()) throw new KeliError("Watch evidence needs a question", "invalid_request");
}

export function definitionHash(def: WatchDefinition): string {
  return createHash("sha256")
    .update(JSON.stringify({ k: def.kind, t: def.trigger, b: def.budget ?? {}, e: def.evidence, n: def.notify ?? {} }))
    .digest("hex");
}

/**
 * Create or update a watch from a definition. New watches start as `proposed` unless
 * `status` says otherwise; a changed definition for an existing watch bumps its version and
 * returns it to `proposed` so the owner re-approves what changed.
 */
export function upsertWatch(
  db: Database,
  input: { ownerId: string; scope: string; definition: WatchDefinition; sourceRef?: string; status?: WatchStatus },
): { watch: WatchRecord; created: boolean; changed: boolean } {
  validateDefinition(input.definition);
  const def = input.definition;
  const id = watchId(input.scope, def.name);
  const now = new Date().toISOString();
  const budget = { maxConsecutiveFailures: DEFAULT_MAX_FAILURES, ...(def.budget ?? {}) };
  const notify = { policy: "material-change" as const, ...(def.notify ?? {}) };
  const existing = getWatch(db, id);
  const hash = definitionHash(def);

  if (!existing) {
    db.run(
      `INSERT INTO watches(id, owner_id, scope, name, kind, version, status, trigger_json, budget_json, evidence_json, notify_json,
                           source_ref, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        input.ownerId,
        input.scope,
        def.name,
        def.kind,
        input.status ?? "proposed",
        JSON.stringify(def.trigger),
        JSON.stringify(budget),
        JSON.stringify({ ...def.evidence, hash }),
        JSON.stringify(notify),
        input.sourceRef ?? null,
        now,
        now,
      ],
    );
    appendWatchEvent(db, id, input.status === "active" ? "approved" : "proposed", { sourceRef: input.sourceRef, version: 1 });
    return { watch: getWatch(db, id)!, created: true, changed: true };
  }

  const existingHash = (existing.evidence as { hash?: string }).hash;
  if (existingHash === hash) return { watch: existing, created: false, changed: false };

  const version = existing.version + 1;
  const status: WatchStatus = input.status ?? (existing.status === "retired" ? "retired" : "proposed");
  db.run(
    `UPDATE watches SET kind = ?, version = ?, status = ?, trigger_json = ?, budget_json = ?, evidence_json = ?, notify_json = ?,
                        source_ref = COALESCE(?, source_ref), last_fingerprint = NULL, updated_at = ?
     WHERE id = ?`,
    [
      def.kind,
      version,
      status,
      JSON.stringify(def.trigger),
      JSON.stringify(budget),
      JSON.stringify({ ...def.evidence, hash }),
      JSON.stringify(notify),
      input.sourceRef ?? null,
      now,
      id,
    ],
  );
  appendWatchEvent(db, id, "updated", { version, previousVersion: existing.version, status });
  return { watch: getWatch(db, id)!, created: false, changed: true };
}

export function getWatch(db: Database, id: string): WatchRecord | null {
  const row = db.query("SELECT * FROM watches WHERE id = ?").get(id) as Row | null;
  return row ? toRecord(row) : null;
}

export function listWatches(db: Database, filter: { scope?: string; status?: WatchStatus } = {}): WatchRecord[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filter.scope) {
    clauses.push("scope = ?");
    params.push(filter.scope);
  }
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.query(`SELECT * FROM watches ${where} ORDER BY created_at`).all(...params) as Row[];
  return rows.map(toRecord);
}

export function setWatchStatus(db: Database, id: string, status: WatchStatus, detail?: Record<string, unknown>): WatchRecord {
  const existing = getWatch(db, id);
  if (!existing) throw new KeliError(`Unknown watch ${id}`, "invalid_request");
  db.run("UPDATE watches SET status = ?, updated_at = ? WHERE id = ?", [status, new Date().toISOString(), id]);
  const kind: WatchEventKind = status === "active" ? "approved" : status === "paused" ? "paused" : status === "retired" ? "retired" : "updated";
  appendWatchEvent(db, id, kind, { from: existing.status, to: status, ...(detail ?? {}) });
  return getWatch(db, id)!;
}

export function recordWatchAttempt(db: Database, id: string, at: string): void {
  db.run("UPDATE watches SET last_attempt_at = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?", [at, at, id]);
}

export function recordWatchSuccess(db: Database, id: string, at: string, fingerprint: string): void {
  db.run(
    "UPDATE watches SET last_success_at = ?, last_fingerprint = ?, last_error = NULL, attempts = 0, updated_at = ? WHERE id = ?",
    [at, fingerprint, at, id],
  );
}

export function recordWatchFailure(db: Database, id: string, at: string, error: string): void {
  db.run("UPDATE watches SET last_error = ?, updated_at = ? WHERE id = ?", [error.slice(0, 500), at, id]);
}

export function appendWatchEvent(db: Database, watchId: string, kind: WatchEventKind, detail?: Record<string, unknown>): WatchEvent {
  const event: WatchEvent = { id: crypto.randomUUID(), watchId, kind, detail, createdAt: new Date().toISOString() };
  db.run("INSERT INTO watch_events(id, watch_id, kind, detail_json, created_at) VALUES (?, ?, ?, ?, ?)", [
    event.id,
    watchId,
    kind,
    detail ? JSON.stringify(detail) : null,
    event.createdAt,
  ]);
  return event;
}

export function listWatchEvents(db: Database, watchId: string, limit = 50): WatchEvent[] {
  const rows = db
    .query("SELECT * FROM watch_events WHERE watch_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(watchId, limit) as Array<{ id: string; watch_id: string; kind: string; detail_json: string | null; created_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    watchId: r.watch_id,
    kind: r.kind as WatchEventKind,
    detail: r.detail_json ? JSON.parse(r.detail_json) : undefined,
    createdAt: r.created_at,
  }));
}
