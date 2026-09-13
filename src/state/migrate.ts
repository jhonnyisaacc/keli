import type { Database } from "bun:sqlite";

export const CURRENT_SCHEMA_VERSION = 11;

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
  8: `
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      source_ref TEXT,
      created_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      scope UNINDEXED,
      title,
      body
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      transport TEXT,
      external_id TEXT,
      summary TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_checkpoints (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      goal TEXT NOT NULL,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_pins (
      id TEXT NOT NULL,
      version INTEGER NOT NULL,
      scope TEXT NOT NULL,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      license TEXT,
      activation_status TEXT NOT NULL DEFAULT 'draft',
      comparable_uses INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, version)
    );

    CREATE INDEX IF NOT EXISTS notes_scope_idx ON notes(scope);
    CREATE INDEX IF NOT EXISTS skill_pins_scope_idx ON skill_pins(scope);
  `,
  9: `
    ALTER TABLE runs ADD COLUMN requests_max INTEGER NOT NULL DEFAULT 20;
    ALTER TABLE runs ADD COLUMN requests_used INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE runs ADD COLUMN tokens_max INTEGER;
    ALTER TABLE runs ADD COLUMN tokens_used INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE runs ADD COLUMN tool_calls_max INTEGER;
    ALTER TABLE runs ADD COLUMN tool_calls_used INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE runs ADD COLUMN parent_run_id TEXT;
    ALTER TABLE runs ADD COLUMN monetary_budget_cents INTEGER;
    ALTER TABLE runs ADD COLUMN monetary_used_cents INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS helper_runs (
      id TEXT PRIMARY KEY,
      parent_run_id TEXT NOT NULL,
      child_run_id TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_run_id) REFERENCES runs(id),
      FOREIGN KEY (child_run_id) REFERENCES runs(id)
    );

    CREATE INDEX IF NOT EXISTS helper_runs_parent_idx ON helper_runs(parent_run_id);
  `,
  10: `
    ALTER TABLE notes ADD COLUMN retained_until TEXT;
    ALTER TABLE conversations ADD COLUMN retained_until TEXT;
    ALTER TABLE conversations ADD COLUMN route_id TEXT;
    ALTER TABLE task_checkpoints ADD COLUMN run_id TEXT;

    CREATE TABLE IF NOT EXISTS job_skill_pins (
      job_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      PRIMARY KEY (job_id, skill_id),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS request_usage (
      id TEXT PRIMARY KEY,
      action_id TEXT,
      provider_id TEXT NOT NULL,
      est_tokens INTEGER,
      reported_in INTEGER,
      reported_cached INTEGER,
      reported_out INTEGER,
      cost_cents INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS request_usage_action_idx ON request_usage(action_id);
  `,
  11: `
    ALTER TABLE request_usage ADD COLUMN run_id TEXT;
    ALTER TABLE request_usage ADD COLUMN attempt INTEGER;
    ALTER TABLE request_usage ADD COLUMN model TEXT;
    ALTER TABLE request_usage ADD COLUMN outcome TEXT;
    CREATE INDEX IF NOT EXISTS request_usage_run_idx ON request_usage(run_id);

    ALTER TABLE notes ADD COLUMN archived_at TEXT;
    ALTER TABLE conversations ADD COLUMN archived_at TEXT;

    CREATE TABLE IF NOT EXISTS conversation_turns (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      refs_json TEXT,
      run_id TEXT,
      source_ref TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS conversation_turns_conv_idx ON conversation_turns(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS watches (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      trigger_json TEXT NOT NULL,
      budget_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      notify_json TEXT NOT NULL,
      source_ref TEXT,
      last_fingerprint TEXT,
      last_attempt_at TEXT,
      last_success_at TEXT,
      last_error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS watches_scope_idx ON watches(scope, status);

    CREATE TABLE IF NOT EXISTS watch_events (
      id TEXT PRIMARY KEY,
      watch_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      detail_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (watch_id) REFERENCES watches(id)
    );
    CREATE INDEX IF NOT EXISTS watch_events_watch_idx ON watch_events(watch_id, created_at);

    CREATE TABLE IF NOT EXISTS source_documents (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      path TEXT NOT NULL,
      title TEXT,
      author TEXT,
      url TEXT,
      published_at TEXT,
      fetched_at TEXT,
      indexed_at TEXT NOT NULL,
      hash TEXT NOT NULL,
      meta_json TEXT,
      body TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS source_documents_path ON source_documents(collection, path);

    CREATE VIRTUAL TABLE IF NOT EXISTS source_documents_fts USING fts5(
      doc_id UNINDEXED,
      collection UNINDEXED,
      title,
      body
    );
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
