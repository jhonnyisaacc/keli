import type { Database } from "bun:sqlite";
import {
  activateSkill,
  listSkillIndex,
  recordComparableUse,
  type SkillPinRecord,
} from "./store.ts";

export function maybeRecordSkillUse(
  db: Database,
  scope: string,
  prompt: string,
  activationUses = 2,
): SkillPinRecord | null {
  const drafts = db
    .query(
      `SELECT * FROM skill_pins WHERE scope = ? AND activation_status = 'draft' ORDER BY version DESC`,
    )
    .all(scope) as Array<Record<string, string | number | null>>;
  const mentioned = drafts.find((row) => prompt.toLowerCase().includes(String(row.id).toLowerCase()));
  if (!mentioned) return null;
  const uses = recordComparableUse(db, String(mentioned.id), scope, Number(mentioned.version));
  if (uses >= activationUses) {
    activateSkill(db, String(mentioned.id), scope, Number(mentioned.version));
  }
  return {
    id: String(mentioned.id),
    version: Number(mentioned.version),
    scope: String(mentioned.scope),
    source: String(mentioned.source),
    content: String(mentioned.content),
    license: mentioned.license ? String(mentioned.license) : undefined,
    activationStatus: uses >= activationUses ? "active" : "draft",
    comparableUses: uses,
    createdAt: String(mentioned.created_at),
  };
}

export function compactSkillIndex(db: Database, scope: string): ReturnType<typeof listSkillIndex> {
  return listSkillIndex(db, scope);
}
