import type { Database } from "bun:sqlite";

export type SkillPinRecord = {
  id: string;
  version: number;
  scope: string;
  source: string;
  content: string;
  license?: string;
  activationStatus: "draft" | "active" | "superseded";
  comparableUses: number;
  createdAt: string;
};

export function pinSkillVersion(
  db: Database,
  skill: Omit<SkillPinRecord, "createdAt" | "comparableUses" | "activationStatus"> & {
    createdAt?: string;
    activationStatus?: SkillPinRecord["activationStatus"];
    comparableUses?: number;
  },
): SkillPinRecord {
  const createdAt = skill.createdAt ?? new Date().toISOString();
  db.run(
    `INSERT INTO skill_pins(id, version, scope, source, content, license, activation_status, comparable_uses, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      skill.id,
      skill.version,
      skill.scope,
      skill.source,
      skill.content,
      skill.license ?? null,
      skill.activationStatus ?? "draft",
      skill.comparableUses ?? 0,
      createdAt,
    ],
  );
  return {
    ...skill,
    activationStatus: skill.activationStatus ?? "draft",
    comparableUses: skill.comparableUses ?? 0,
    createdAt,
  };
}

export function getActiveSkill(db: Database, id: string, scope: string): SkillPinRecord | null {
  const row = db
    .query(
      `SELECT * FROM skill_pins WHERE id = ? AND scope = ? AND activation_status = 'active'
       ORDER BY version DESC LIMIT 1`,
    )
    .get(id, scope) as Record<string, string | number | null> | null;
  return row ? rowToSkill(row) : null;
}

export function listSkillIndex(db: Database, scope?: string): Array<{ id: string; version: number; summary: string }> {
  const rows = scope
    ? db
        .query(
          `SELECT id, version, substr(content, 1, 80) AS summary FROM skill_pins
           WHERE scope = ? AND activation_status != 'superseded' ORDER BY id, version`,
        )
        .all(scope)
    : db
        .query(
          `SELECT id, version, substr(content, 1, 80) AS summary FROM skill_pins
           WHERE activation_status != 'superseded' ORDER BY id, version`,
        )
        .all();
  return (rows as Array<{ id: string; version: number; summary: string }>).map((r) => ({
    id: r.id,
    version: r.version,
    summary: r.summary,
  }));
}

export function activateSkill(db: Database, id: string, scope: string, version: number): void {
  db.run(
    `UPDATE skill_pins SET activation_status = 'superseded'
     WHERE id = ? AND scope = ? AND activation_status = 'active'`,
    [id, scope],
  );
  db.run(
    `UPDATE skill_pins SET activation_status = 'active'
     WHERE id = ? AND scope = ? AND version = ?`,
    [id, scope, version],
  );
}

export function rollbackSkill(db: Database, id: string, scope: string, toVersion: number): void {
  db.run(
    `UPDATE skill_pins SET activation_status = 'superseded'
     WHERE id = ? AND scope = ? AND activation_status = 'active'`,
    [id, scope],
  );
  db.run(
    `UPDATE skill_pins SET activation_status = 'active'
     WHERE id = ? AND scope = ? AND version = ?`,
    [id, scope, toVersion],
  );
}

export function listActiveSkills(db: Database, scope: string): SkillPinRecord[] {
  const rows = db
    .query(
      `SELECT * FROM skill_pins WHERE scope = ? AND activation_status = 'active' ORDER BY id, version`,
    )
    .all(scope) as Array<Record<string, string | number | null>>;
  return rows.map(rowToSkill);
}

export function recordComparableUse(db: Database, id: string, scope: string, version: number): number {
  db.run(
    `UPDATE skill_pins SET comparable_uses = comparable_uses + 1
     WHERE id = ? AND scope = ? AND version = ?`,
    [id, scope, version],
  );
  const row = db
    .query("SELECT comparable_uses FROM skill_pins WHERE id = ? AND scope = ? AND version = ?")
    .get(id, scope, version) as { comparable_uses: number };
  return row.comparable_uses;
}

function rowToSkill(row: Record<string, string | number | null>): SkillPinRecord {
  return {
    id: String(row.id),
    version: Number(row.version),
    scope: String(row.scope),
    source: String(row.source),
    content: String(row.content),
    license: row.license ? String(row.license) : undefined,
    activationStatus: row.activation_status as SkillPinRecord["activationStatus"],
    comparableUses: Number(row.comparable_uses),
    createdAt: String(row.created_at),
  };
}
