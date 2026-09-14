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

export type ProviderDescriptor = {
  id: string;
  kind: ProviderKind;
  available: boolean;
  /** Where availability comes from: saved config, fixture env, or nowhere. */
  source?: "config" | "fixture-env";
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
export function listProviders(config?: KeliConfig | null): ProviderDescriptor[] {
  const out: ProviderDescriptor[] = listIntegrations("model-provider").map((profile) => {
    if (profile.id === "chatgpt") return { id: profile.id, kind: "openai-compatible" as const, available: Boolean(config?.integrations?.chatgpt?.credentialRef), source: "config" as const, model: config?.providers?.primary?.id === "chatgpt" ? config.providers.primary.model ?? "gpt-5.5" : "gpt-5.5", reason: config?.integrations?.chatgpt?.credentialRef ? "Account linked; use live probe to verify access" : "Run keli auth add chatgpt" };
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
    return {
      id: profile.id,
      kind: KIND_BY_ID[profile.id] ?? "openai-compatible",
      available,
      source: available ? (fromConfig ? "config" : fixtureUrl ? "fixture-env" : "config") : undefined,
      model: resolved ? selectModel(resolved) : undefined,
      reason: available
        ? undefined
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
    if (resolved.profile.id === "chatgpt") throw new Error("ChatGPT requires the async createModelProvider factory");
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
