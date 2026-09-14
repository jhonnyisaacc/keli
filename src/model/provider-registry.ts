import { catalogEntry, catalogEnvironment, catalogEndpoint } from "../integrations/catalog-provider.ts";
import type { ModelProvider } from "./provider.ts";
import { FixtureModelProvider } from "./provider.ts";
import { HttpModelProvider, unsupportedApiModeReason } from "./http-provider.ts";
import { fixtureUrlFor, preferredProviderId } from "../integrations/env.ts";
import { getIntegration, listIntegrations } from "../integrations/registry.ts";
import { integrationEndpoint, tryResolveIntegration } from "../integrations/resolve.ts";
import { selectModel } from "./provider-factory.ts";
import type { KeliConfig } from "../state/config.ts";
import "../integrations/load.ts";

export type ProviderKind = "fixture" | "openai-compatible" | "claude-code" | "grok-build" | "antigravity";

export type ProviderReadiness = "catalog" | "configured" | "live-checked";

export type ProviderDescriptor = {
  id: string;
  kind: ProviderKind;
  available: boolean;
  /** Where availability comes from: saved config, fixture env, or nowhere. */
  source?: "config" | "fixture-env";
  /** Catalog membership, usable config/auth, or a recorded live probe — never entitlement. */
  readiness?: ProviderReadiness;
  model?: string;
  reason?: string;
};

const KIND_BY_ID: Record<string, ProviderKind> = {
  fixture: "fixture",
  "openai-compatible": "openai-compatible",
  grok: "grok-build",
  "claude-code": "claude-code",
  antigravity: "antigravity",
};

/** Availability considers saved config first, then explicit fixture env. */
function currentProviderModel(config: KeliConfig | null | undefined, id: string): string | undefined {
  if (config?.providers?.primary?.id === id) return config.providers.primary.model;
  const fallback = config?.providers?.fallback?.find((p) => p.id === id);
  if (fallback?.model) return fallback.model;
  return config?.integrations?.[id]?.settings?.model;
}

function liveCheckedAt(
  config: KeliConfig | null | undefined,
  id: string,
  model?: string,
): string | undefined {
  const rec = config?.setup?.liveChecked?.[id];
  if (!rec?.at) return undefined;
  if ((rec.model ?? "") !== (model ?? "")) return undefined;
  return rec.at;
}

function readinessOf(
  config: KeliConfig | null | undefined,
  id: string,
  configured: boolean,
  model?: string,
): { readiness: ProviderReadiness; reason: string } | undefined {
  const at = liveCheckedAt(config, id, model);
  if (at) return { readiness: "live-checked", reason: `Live-checked ${at} for ${model ?? "the selected model"}; not account-wide entitlement` };
  if (configured) return { readiness: "configured", reason: "Configured; live inference not yet verified for this model" };
  return { readiness: "catalog", reason: `Catalog entry only. Run keli setup provider (${id})` };
}

export function listProviders(config?: KeliConfig | null): ProviderDescriptor[] {
  const out: ProviderDescriptor[] = listIntegrations("model-provider").map((profile) => {
    if (profile.id === "chatgpt") {
      const linked = Boolean(config?.integrations?.chatgpt?.credentialRef);
      const model = currentProviderModel(config, "chatgpt") ?? "gpt-5.5";
      const live = liveCheckedAt(config, "chatgpt", model);
      return {
        id: profile.id,
        kind: "openai-compatible" as const,
        available: linked,
        source: "config" as const,
        readiness: live ? "live-checked" : linked ? "configured" : "catalog",
        model,
        reason: live
          ? `Live-checked ${live} for ${model}; not account-wide entitlement`
          : linked
            ? "Account linked; live inference not yet verified for this model"
            : "Run keli auth add chatgpt",
      };
    }
    if (catalogEntry(profile.id) && !(profile.fixtureKey && fixtureUrlFor(profile.fixtureKey as "grok"))) {
      const resolved = tryResolveIntegration("model-provider", { explicitId: profile.id, config });
      const configured = Boolean(resolved && catalogEndpoint(profile.id, resolved.settings) && selectModel(resolved));
      const authenticated = Boolean(resolved?.credentialRef || catalogEnvironment(profile.id) || ["none", "external-cli"].includes(profile.auth.type));
      const model = resolved ? selectModel(resolved) : currentProviderModel(config, profile.id);
      const ready = readinessOf(config, profile.id, configured && authenticated, model);
      return { id: profile.id, kind: "openai-compatible" as const, available: configured && authenticated, source: "config" as const,
        readiness: ready?.readiness, model, reason: ready?.reason };
    }
    const unsupported = unsupportedApiModeReason(profile.apiMode);
    if (unsupported || profile.availability === "named-later") {
      return {
        id: profile.id,
        kind: KIND_BY_ID[profile.id] ?? "openai-compatible",
        available: false,
        reason: `unavailable until configured and release-pinned${unsupported ? ` (${unsupported})` : ""}`,
      };
    }
    const resolved = tryResolveIntegration("model-provider", { explicitId: profile.id, config });
    const endpoint = resolved ? integrationEndpoint(resolved) : undefined;
    const fromConfig = Boolean(
      config?.integrations?.[profile.id]?.settings?.baseUrl || (profile.baseUrl && config?.integrations?.[profile.id]?.enabled),
    );
    const fixtureUrl = profile.fixtureKey
      ? fixtureUrlFor(profile.fixtureKey as "model" | "provider" | "grok")
      : undefined;
    const available = Boolean(endpoint);
    const model = resolved ? selectModel(resolved) : currentProviderModel(config, profile.id);
    const ready = readinessOf(config, profile.id, available, model);
    return {
      id: profile.id,
      kind: KIND_BY_ID[profile.id] ?? "openai-compatible",
      available,
      source: available ? (fromConfig ? "config" : fixtureUrl ? "fixture-env" : "config") : undefined,
      readiness: ready?.readiness,
      model,
      reason: available
        ? ready?.reason
        : profile.id === "fixture"
          ? "set KELI_FIXTURE_URL"
          : `run: keli auth add ${profile.id}; keli config set integrations.${profile.id}.settings.baseUrl <url>`,
    };
  });
  for (const custom of config?.providers?.custom ?? []) {
    out.push({
      id: custom.id,
      kind: "openai-compatible",
      available: Boolean(custom.baseUrl) && !unsupportedApiModeReason(custom.apiMode),
      source: "config",
      reason: unsupportedApiModeReason(custom.apiMode) ?? undefined,
    });
  }
  return out;
}

/**
 * Synchronous facade kept for the CLI and older call sites. It cannot read credentials;
 * prefer `createModelProvider` for anything that talks to a configured endpoint.
 */
export function resolveProvider(preferredId?: string, config?: KeliConfig | null): ModelProvider {
  const id = preferredId ?? preferredProviderId();
  if (id === "fixture" || (!id && fixtureUrlFor("model"))) {
    const endpoint = fixtureUrlFor("model");
    if (!endpoint) throw new Error("KELI_FIXTURE_URL required");
    return new FixtureModelProvider(endpoint);
  }

  const candidates = id ? [id] : listProviders(config).filter((p) => p.available).map((p) => p.id);
  for (const candidate of candidates) {
    const resolved = tryResolveIntegration("model-provider", { explicitId: candidate, config });
    if (!resolved) continue;
    const endpoint = integrationEndpoint(resolved);
    if (!endpoint) continue;
    if (resolved.profile.id === "fixture") return new FixtureModelProvider(endpoint);
    if (resolved.profile.id === "chatgpt" || catalogEntry(resolved.profile.id)) throw new Error("This provider requires the async createModelProvider factory");
    const unsupported = unsupportedApiModeReason(resolved.profile.apiMode);
    if (unsupported) throw new Error(`${resolved.profile.displayName}: ${unsupported}`);
    return new HttpModelProvider(endpoint, selectModel(resolved) ?? "default", {
      apiMode: resolved.profile.apiMode,
      providerId: resolved.profile.id,
    });
  }

  const desc = listProviders(config).find((p) => p.id === id);
  throw new Error(desc?.reason ?? `Provider '${id ?? "(none)"}' is not available. Run keli providers list.`);
}

export function isRunOverrideDelegate(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === "codex" || lower === "opencode") return true;
  if (lower === "grok") {
    return listProviders().some((p) => p.id === "grok" && p.available);
  }
  return Boolean(getIntegration(lower) && getIntegration(lower)?.kind === "delegate");
}

export function normalizeOverrideDelegate(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "codex") return "Codex";
  if (lower === "opencode") return "OpenCode";
  if (lower === "grok") return "Grok";
  return name;
}
