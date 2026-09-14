import { catalogEntry, catalogEndpoint } from "./catalog-provider.ts";
import { KeliError } from "../core/errors.ts";
import type { KeliConfig } from "../state/config.ts";
import { fixtureUrlFor, preferredProviderId, type FixtureSlot } from "./env.ts";
import { getIntegration, listIntegrations, resolveProfileId } from "./registry.ts";
import type {
  CustomProvider,
  IntegrationKind,
  ResolvedIntegration,
  ResolveSource,
} from "./types.ts";

export type ResolveOptions = {
  explicitId?: string;
  role?: string;
  config?: KeliConfig | null;
  model?: string;
};

function customAsResolved(custom: CustomProvider, source: ResolveSource): ResolvedIntegration {
  return {
    profile: {
      id: custom.id,
      kind: "model-provider",
      displayName: custom.displayName,
      aliases: [],
      auth: { type: "api-key" },
      settings: [{ key: "baseUrl", label: "Base URL", required: true }],
      apiMode: custom.apiMode,
      baseUrl: custom.baseUrl,
      probe: async () => ({
        id: custom.id,
        kind: "model-provider",
        displayName: custom.displayName,
        configured: true,
        credentialState: custom.credentialRef ? "resolvable" : "missing",
        howToConfigure: `keli auth add ${custom.id}`,
      }),
      reuse: {
        upstream: "named custom endpoint",
        pin: "config",
        license: "n/a",
        prdIds: ["I8"],
      },
    },
    settings: { baseUrl: custom.baseUrl },
    credentialRef: custom.credentialRef ?? null,
    source,
    model: undefined,
  };
}

function fromConfig(
  id: string,
  config: KeliConfig | null | undefined,
  source: ResolveSource,
  model?: string,
): ResolvedIntegration | null {
  const custom = config?.providers?.custom?.find((c) => c.id === id);
  if (custom) return { ...customAsResolved(custom, source), model };

  const profile = getIntegration(id);
  if (!profile) return null;
  const entry = config?.integrations?.[profile.id];
  const fixtureUrl = profile.fixtureKey
    ? fixtureUrlFor(profile.fixtureKey as FixtureSlot)
    : undefined;
  const settings = { ...(entry?.settings ?? {}) };
  if (fixtureUrl && !settings.baseUrl) settings.baseUrl = fixtureUrl;
  if (!settings.baseUrl) {
    const url = catalogEntry(profile.id) ? catalogEndpoint(profile.id, settings) : profile.baseUrl;
    if (url) settings.baseUrl = url;
  }
  return {
    profile,
    settings,
    credentialRef: entry?.credentialRef ?? null,
    source,
    fixtureUrl,
    model,
  };
}

function fromFixture(kind: IntegrationKind, preferredId?: string): ResolvedIntegration | null {
  const candidates = preferredId
    ? [getIntegration(preferredId)].filter(Boolean)
    : listIntegrations(kind);
  for (const profile of candidates) {
    if (!profile) continue;
    const fixtureUrl = profile.fixtureKey
      ? fixtureUrlFor(profile.fixtureKey as FixtureSlot)
      : undefined;
    if (!fixtureUrl) continue;
    return {
      profile,
      settings: { baseUrl: fixtureUrl },
      credentialRef: null,
      source: "fixture-env",
      fixtureUrl,
    };
  }
  return null;
}

export function resolveIntegration(
  kind: IntegrationKind,
  options: ResolveOptions = {},
): ResolvedIntegration {
  const { explicitId, config } = options;

  if (explicitId) {
    const primary = config?.providers?.primary;
    const primaryModel =
      primary && resolveProfileId(explicitId) === resolveProfileId(primary.id) ? primary.model : config?.providers?.fallback?.find((p) => resolveProfileId(p.id) === resolveProfileId(explicitId))?.model;
    const resolved = fromConfig(explicitId, config, "explicit", options.model ?? primaryModel);
    if (resolved) {
      if (resolved.profile.kind !== kind) {
        throw new KeliError(
          `Integration '${resolved.profile.id}' is a ${resolved.profile.kind}, not a ${kind}`,
          "invalid_request",
        );
      }
      assertUsable(resolved, config);
      return resolved;
    }
    throw new KeliError(
      `Integration '${explicitId}' is not available. Run: keli integrations discover ${explicitId}`,
      "capability_unavailable",
    );
  }

  if (kind === "model-provider") {
    const routingId =
      options.role && config?.routing
        ? config.routing[options.role as keyof NonNullable<KeliConfig["routing"]>]
        : undefined;
    const primary = config?.providers?.primary?.id ?? config?.primaryModel;
    const id = routingId ?? primary;
    if (id && id !== "fixture") {
      const resolved = fromConfig(id, config, "config", options.model ?? (resolveProfileId(id) === resolveProfileId(primary ?? "") ? config?.providers?.primary?.model : config?.providers?.fallback?.find((p) => resolveProfileId(p.id) === resolveProfileId(id))?.model));
      if (resolved) {
        assertUsable(resolved, config);
        return resolved;
      }
    }
  }

  if (kind === "memory" && config?.memory?.provider) {
    const resolved = fromConfig(config.memory.provider, config, "config");
    if (resolved) {
      assertUsable(resolved, config);
      return resolved;
    }
  }

  const configured = Object.entries(config?.integrations ?? {}).find(
    ([id, entry]) => entry.enabled && getIntegration(id)?.kind === kind,
  );
  if (configured) {
    const [id] = configured;
    const resolved = fromConfig(id, config, "config");
    if (resolved) {
      assertUsable(resolved, config);
      return resolved;
    }
  }

  const fixture = fromFixture(kind, kind === "model-provider" ? preferredProviderId() : undefined);
  if (fixture) return fixture;

  if (kind === "model-provider") {
    throw new KeliError(
      "No model provider configured. Run: keli setup provider (or keli auth add <provider>; set KELI_FIXTURE_URL for fixtures)",
      "capability_unavailable",
    );
  }
  const fallback = listIntegrations(kind)[0];
  throw new KeliError(
    fallback
      ? `${fallback.displayName} is not configured. ${statusHowTo(fallback.id)}`
      : `No ${kind} integration registered.`,
    "capability_unavailable",
  );
}

/** Enabled state and re-auth quarantine apply on every resolution path, not only explicit ids. */
function assertUsable(resolved: ResolvedIntegration, config: KeliConfig | null | undefined): void {
  const entry = config?.integrations?.[resolved.profile.id];
  if (entry && entry.enabled === false) {
    throw new KeliError(
      `Integration '${resolved.profile.id}' is disabled. Run: keli config set integrations.${resolved.profile.id}.enabled true`,
      "capability_unavailable",
    );
  }
  if (entry?.status?.needsReauth) {
    throw new KeliError(
      `Integration '${resolved.profile.id}' needs re-auth. Run: keli auth add ${resolved.profile.id}`,
      "needs_reauth",
    );
  }
}

export function integrationEndpoint(resolved: ResolvedIntegration): string | undefined {
  return resolved.settings.baseUrl ?? resolved.profile.baseUrl ?? resolved.fixtureUrl;
}

function statusHowTo(id: string): string {
  const profile = getIntegration(id);
  return profile
    ? `Run: keli integrations list; keli auth add ${id}`
    : `Run: keli integrations discover ${id}`;
}

export function resolveModelProvider(options: ResolveOptions = {}): ResolvedIntegration {
  return resolveIntegration("model-provider", options);
}

export function tryResolveIntegration(
  kind: IntegrationKind,
  options: ResolveOptions = {},
): ResolvedIntegration | null {
  try {
    return resolveIntegration(kind, options);
  } catch {
    return null;
  }
}

export function credentialScopedTo(
  resolved: ResolvedIntegration,
  targetUrl: string,
): boolean {
  const base = resolved.settings.baseUrl ?? resolved.profile.baseUrl ?? resolved.fixtureUrl;
  if (!base) return false;
  try {
    const allowed = new URL(base);
    const target = new URL(targetUrl);
    return allowed.origin === target.origin;
  } catch {
    return targetUrl.startsWith(base);
  }
}

export function findCustomProvider(config: KeliConfig | null | undefined, id: string): CustomProvider | undefined {
  return config?.providers?.custom?.find((c) => c.id === id);
}

export { resolveProfileId };
