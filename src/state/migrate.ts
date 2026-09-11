import type { Database } from "bun:sqlite";

export const CURRENT_SCHEMA_VERSION = 1;

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
};

/** Synthetic v2 migration for upgrade harness tests only. */
export const MIGRATION_V2_TEST = `
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

export function applyTestMigrationV2(db: Database): void {
  db.exec(MIGRATION_V2_TEST);
  db.run(
    "INSERT OR REPLACE INTO schema_meta(version, applied_at) VALUES (?, ?)",
    [2, new Date().toISOString()],
  );
}
