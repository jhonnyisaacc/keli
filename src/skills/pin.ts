import type { Database } from "bun:sqlite";
import {
  activateSkill,
  getActiveSkill,
  listSkillIndex,
  pinSkillVersion,
  rollbackSkill,
} from "./store.ts";

export type SkillPin = {
  id: string;
  version: string;
  source: string;
  license?: string;
};

let skillDb: Database | undefined;

export function setSkillPinDatabase(db: Database | undefined): void {
  skillDb = db;
}

export function pinSkill(pin: SkillPin, scope = "global"): SkillPin {
  if (skillDb) {
    const version = Number.parseInt(pin.version.split(".")[0] ?? "1", 10);
    pinSkillVersion(skillDb, {
      id: pin.id,
      version,
      scope,
      source: pin.source,
      content: `skill:${pin.id}@${pin.version}`,
      license: pin.license,
      activationStatus: "active",
    });
    activateSkill(skillDb, pin.id, scope, version);
    return pin;
  }
  PINS.set(pin.id, pin);
  return pin;
}

export function getPinnedSkill(id: string, scope = "global"): SkillPin | undefined {
  if (skillDb) {
    const active = getActiveSkill(skillDb, id, scope);
    if (!active) return undefined;
    return {
      id: active.id,
      version: String(active.version),
      source: active.source,
      license: active.license,
    };
  }
  return PINS.get(id);
}

export function listPinnedSkills(scope = "global"): SkillPin[] {
  if (skillDb) {
    return listSkillIndex(skillDb, scope).map((row) => ({
      id: row.id,
      version: String(row.version),
      source: "durable",
    }));
  }
  return [...PINS.values()];
}

export function reusePinnedSkill(id: string, scope = "global"): SkillPin {
  const pin = getPinnedSkill(id, scope);
  if (!pin) throw new Error(`Pinned skill not found: ${id}`);
  return pin;
}

export function activatePinnedSkill(id: string, scope: string, version: number): void {
  if (!skillDb) throw new Error("Durable skill store not configured");
  activateSkill(skillDb, id, scope, version);
}

export function rollbackPinnedSkill(id: string, scope: string, toVersion: number): void {
  if (!skillDb) throw new Error("Durable skill store not configured");
  rollbackSkill(skillDb, id, scope, toVersion);
}

const PINS = new Map<string, SkillPin>();
