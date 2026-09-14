import type {
  IntegrationKind,
  IntegrationProfile,
  IntegrationStatus,
  ProbeContext,
} from "./types.ts";
import { fixtureUrlFor, type FixtureSlot } from "./env.ts";

export { listByCategory, listByStatus } from "./manifest.ts";

const profiles = new Map<string, IntegrationProfile>();
const aliases = new Map<string, string>();

export function registerIntegration(profile: IntegrationProfile): void {
  profiles.set(profile.id, profile);
  aliases.set(profile.id.toLowerCase(), profile.id);
  for (const alias of profile.aliases) {
    aliases.set(alias.toLowerCase(), profile.id);
  }
}

export function getIntegration(idOrAlias: string): IntegrationProfile | undefined {
  const canonical = aliases.get(idOrAlias.toLowerCase());
  return canonical ? profiles.get(canonical) : undefined;
}

export function listIntegrations(kind?: IntegrationKind): IntegrationProfile[] {
  const all = [...profiles.values()];
  return kind ? all.filter((p) => p.kind === kind) : all;
}

export function resolveProfileId(idOrAlias: string): string | undefined {
  return aliases.get(idOrAlias.toLowerCase());
}

export async function probeIntegration(
  idOrAlias: string,
  ctx: Omit<ProbeContext, "fixtureUrl"> & { fixtureUrl?: string } = { settings: {} },
): Promise<IntegrationStatus> {
  const profile = getIntegration(idOrAlias);
  if (!profile) {
    return {
      id: idOrAlias,
      kind: "model-provider",
      displayName: idOrAlias,
      configured: false,
      credentialState: "missing",
      reason: `Unknown integration '${idOrAlias}'`,
      howToConfigure: "Run: keli integrations discover " + idOrAlias,
    };
  }
  const fixtureUrl =
    ctx.fixtureUrl ??
    (profile.fixtureKey ? fixtureUrlFor(profile.fixtureKey as FixtureSlot) : undefined);
  return profile.probe({ ...ctx, fixtureUrl });
}

export function clearRegistryForTests(): void {
  profiles.clear();
  aliases.clear();
}
