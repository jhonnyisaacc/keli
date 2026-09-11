import type { Database } from "bun:sqlite";
import type { RuleRecord, Provenance } from "../core/types.ts";

export type OwnerRecord = { id: string; created_at: string };
export type ProjectRecord = {
  id: string;
  owner_id: string;
  name: string;
  resource_roots_json: string;
  created_at: string;
};

export function createOwner(db: Database, id: string): OwnerRecord {
  const created_at = new Date().toISOString();
  db.run("INSERT INTO owners(id, created_at) VALUES (?, ?)", [id, created_at]);
  return { id, created_at };
}

export function getOwner(db: Database): OwnerRecord | null {
  return db.query("SELECT * FROM owners LIMIT 1").get() as OwnerRecord | null;
}

export function createProject(
  db: Database,
  id: string,
  ownerId: string,
  name: string,
  resourceRoots: string[],
): ProjectRecord {
  const created_at = new Date().toISOString();
  const row: ProjectRecord = {
    id,
    owner_id: ownerId,
    name,
    resource_roots_json: JSON.stringify(resourceRoots),
    created_at,
  };
  db.run(
    "INSERT INTO projects(id, owner_id, name, resource_roots_json, created_at) VALUES (?, ?, ?, ?, ?)",
    [row.id, row.owner_id, row.name, row.resource_roots_json, row.created_at],
  );
  return row;
}

export function listProjects(db: Database): ProjectRecord[] {
  return db.query("SELECT * FROM projects ORDER BY created_at").all() as ProjectRecord[];
}

export function getProjectByName(db: Database, name: string): ProjectRecord | null {
  return db
    .query("SELECT * FROM projects WHERE lower(name) = lower(?) LIMIT 1")
    .get(name) as ProjectRecord | null;
}

export function getProjectById(db: Database, id: string): ProjectRecord | null {
  return db.query("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRecord | null;
}

export function projectScope(projectId: string): string {
  return `project:${projectId}`;
}

export function getActiveRule(
  db: Database,
  scope: string,
  key: string,
): RuleRecord | null {
  const row = db
    .query(
      "SELECT * FROM rules WHERE scope = ? AND key = ? AND status = 'active' LIMIT 1",
    )
    .get(scope, key) as RuleRecord | null;
  return row ?? null;
}

export function listActiveRules(db: Database): RuleRecord[] {
  return db
    .query("SELECT * FROM rules WHERE status = 'active' ORDER BY scope, key")
    .all() as RuleRecord[];
}

export function getNextRuleRevision(db: Database): number {
  const row = db.query("SELECT COALESCE(MAX(revision), 0) AS n FROM rules").get() as {
    n: number;
  };
  return row.n + 1;
}

export function appendChangeJournal(
  db: Database,
  entry: {
    entityType: string;
    entityId: string;
    revision: number;
    actor: string;
    sourceRef: string;
    payload: object;
  },
): void {
  db.run(
    `INSERT INTO change_journal(id, entity_type, entity_id, revision, actor, source_ref, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      entry.entityType,
      entry.entityId,
      entry.revision,
      entry.actor,
      entry.sourceRef,
      JSON.stringify(entry.payload),
      new Date().toISOString(),
    ],
  );
}

export function listRecentJournal(db: Database, limit = 20) {
  return db
    .query(
      "SELECT * FROM change_journal ORDER BY created_at DESC LIMIT ?",
    )
    .all(limit);
}

export function acquireLease(
  db: Database,
  holder: string,
  ttlMs = 30_000,
): number {
  const previous = db
    .query("SELECT fencing_token FROM instance_lease WHERE holder = ?")
    .get(holder) as { fencing_token: number } | null;
  const token = Math.max(Date.now(), (previous?.fencing_token ?? 0) + 1);
  const expires = new Date(Date.now() + ttlMs).toISOString();
  db.run(
    "INSERT OR REPLACE INTO instance_lease(holder, fencing_token, expires_at) VALUES (?, ?, ?)",
    [holder, token, expires],
  );
  return token;
}

export function getLeaseToken(db: Database, holder: string): number | null {
  const row = db
    .query("SELECT fencing_token, expires_at FROM instance_lease WHERE holder = ?")
    .get(holder) as { fencing_token: number; expires_at: string } | null;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.fencing_token;
}

export function validateFence(db: Database, holder: string, token: number): boolean {
  const current = getLeaseToken(db, holder);
  return current !== null && current === token;
}

export function insertRuleRevision(
  db: Database,
  rule: {
    id: string;
    ownerId: string;
    scope: string;
    type: string;
    key: string;
    value: string;
    revision: number;
    provenance: Provenance;
    supersedesId?: string | null;
  },
): RuleRecord {
  const created_at = new Date().toISOString();
  db.run(
    `INSERT INTO rules(id, owner_id, scope, type, key, value, revision, provenance_json, status, supersedes_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [
      rule.id,
      rule.ownerId,
      rule.scope,
      rule.type,
      rule.key,
      rule.value,
      rule.revision,
      JSON.stringify(rule.provenance),
      rule.supersedesId ?? null,
      created_at,
    ],
  );
  return getActiveRule(db, rule.scope, rule.key)!;
}

export function supersedeActiveRules(db: Database, scope: string, key: string): void {
  db.run(
    "UPDATE rules SET status = 'superseded' WHERE scope = ? AND key = ? AND status = 'active'",
    [scope, key],
  );
}
