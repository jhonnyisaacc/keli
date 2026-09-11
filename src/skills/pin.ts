export type SkillPin = {
  id: string;
  version: string;
  source: string;
  license?: string;
};

const PINS = new Map<string, SkillPin>();

export function pinSkill(pin: SkillPin): SkillPin {
  PINS.set(pin.id, pin);
  return pin;
}

export function getPinnedSkill(id: string): SkillPin | undefined {
  return PINS.get(id);
}

export function listPinnedSkills(): SkillPin[] {
  return [...PINS.values()];
}

export function reusePinnedSkill(id: string): SkillPin {
  const pin = PINS.get(id);
  if (!pin) throw new Error(`Pinned skill not found: ${id}`);
  return pin;
}
