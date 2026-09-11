import type { Database } from "bun:sqlite";

export const CURRENT_SCHEMA_VERSION = 7;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      resource_roots_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES owners(id)
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      revision INTEGER NOT NULL,
      provenance_json TEXT NOT NULL,
      status TEXT NOT NULL,
      supersedes_id TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, revision)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS active_rule ON rules(scope, key) WHERE status = 'active';

    CREATE TABLE IF NOT EXISTS change_journal (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      actor TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      scope TEXT NOT NULL,
      capability TEXT NOT NULL,
      proposal_digest TEXT,
      start_revision INTEGER,
      gate_revision INTEGER,
      candidate TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS effects (
      action_id TEXT PRIMARY KEY,
      delegate TEXT NOT NULL,
      revision INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instance_lease (
      holder TEXT PRIMARY KEY,
      fencing_token INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    );
  `,
  2: `
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      action_id TEXT,
      owner_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      type TEXT NOT NULL,
      hash TEXT NOT NULL,
      path TEXT NOT NULL,
      retention TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS artifacts_scope_idx ON artifacts(scope);
    CREATE INDEX IF NOT EXISTS artifacts_hash_idx ON artifacts(hash);
  `,
  3: `
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      cancel_epoch INTEGER NOT NULL DEFAULT 0,
      budget_bytes_max INTEGER NOT NULL DEFAULT 1048576,
      budget_bytes_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS runs_scope_idx ON runs(scope);
  `,
  4: `
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_occurrences (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS job_occurrence_dedupe
      ON job_occurrences(job_id, scheduled_at);

    CREATE TABLE IF NOT EXISTS outbox_messages (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      destination TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );

    CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox_messages(status);
  `,
  5: `
    CREATE TABLE IF NOT EXISTS transport_inbox (
      id TEXT PRIMARY KEY,
      transport TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      scope TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS transport_inbox_dedupe
      ON transport_inbox(transport, dedupe_key);

    CREATE TABLE IF NOT EXISTS transport_routes (
      id TEXT PRIMARY KEY,
      transport TEXT NOT NULL,
      external_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS transport_route_binding
      ON transport_routes(transport, external_id);

    ALTER TABLE job_occurrences ADD COLUMN completed_at TEXT;
    ALTER TABLE job_occurrences ADD COLUMN reason TEXT;
  `,
  6: `
    ALTER TABLE job_occurrences ADD COLUMN run_id TEXT;
    ALTER TABLE job_occurrences ADD COLUMN action_id TEXT;
  `,
  7: `
    CREATE TABLE IF NOT EXISTS job_grants (
      job_id TEXT PRIMARY KEY,
      mutate_granted INTEGER NOT NULL DEFAULT 0,
      deploy_granted INTEGER NOT NULL DEFAULT 0,
      granted_at TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS preservation_cursor (
      id TEXT PRIMARY KEY DEFAULT 'default',
      last_journal_id TEXT,
      last_archived_at TEXT
    );

    INSERT OR IGNORE INTO preservation_cursor(id) VALUES ('default');
  `,
};

/** Synthetic v3 migration for upgrade harness tests only. */
export const MIGRATION_V3_TEST = `
  ALTER TABLE projects ADD COLUMN description TEXT DEFAULT '';
`;

export function getSchemaVersion(db: Database): number {
  try {
    const row = db
      .query("SELECT MAX(version) AS version FROM schema_meta")
      .get() as { version: number | null };
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

export function migrate(db: Database, target = CURRENT_SCHEMA_VERSION): number {
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
  let version = getSchemaVersion(db);
  while (version < target) {
    const next = version + 1;
    const sql = MIGRATIONS[next];
    if (!sql) throw new Error(`No migration for schema version ${next}`);
    db.transaction(() => {
      db.exec(sql);
      db.run(
        "INSERT OR REPLACE INTO schema_meta(version, applied_at) VALUES (?, ?)",
        [next, new Date().toISOString()],
      );
    }).immediate();
    version = next;
  }
  return version;
}

export function applyTestMigrationV3(db: Database): void {
  db.exec(MIGRATION_V3_TEST);
  db.run(
    "INSERT OR REPLACE INTO schema_meta(version, applied_at) VALUES (?, ?)",
    [3, new Date().toISOString()],
  );
}
