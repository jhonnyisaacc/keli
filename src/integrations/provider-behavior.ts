/**
 * Provider-specific setup behavior adapted from Hermes model_setup_flows / models.py
 * and OpenCode Zen/Go endpoint tables. Runtime stays on Keli's credential store,
 * catalog, and CapabilityGate. No Hermes or OpenCode process is imported.
 */
import { catalogEntry, catalogEndpoint, catalogModels } from "./catalog-provider.ts";
import { getIntegration } from "./registry.ts";
import { manifestRow } from "./manifest.ts";
import type { AuthType } from "./types.ts";
import {
  normalizeModelId,
  normalizeOpencodeBaseUrl,
  opencodeApiMode,
  opencodeFamily,
  type OpencodeApiMode,
} from "./opencode-models.ts";

export {
  normalizeModelId,
  normalizeOpencodeBaseUrl,
  opencodeApiMode,
  opencodeFamily,
  type OpencodeApiMode,
};

export const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";

const KEYLESS_IDS = new Set(["custom", "lmstudio", "opencode-free"]);

export type AuthFlowType = Exclude<AuthType, "none"> | "keyless";

export function isKeylessProvider(id: string): boolean {
  return KEYLESS_IDS.has(id);
}

export function authFlowType(id: string): AuthFlowType {
  if (isKeylessProvider(id)) return "keyless";
  const profile = getIntegration(id);
  const row = manifestRow(id);
  const strategy = profile?.auth.type ?? row?.authStrategy;
  if (strategy === "none" || strategy === "local-endpoint") return "keyless";
  if (strategy === "oauth-device" || strategy === "oauth-external-cli") return "oauth-device";
  if (strategy === "external-cli" || strategy === "cloud-sdk") return "external-cli";
  if (strategy === "token") return "token";
  return "api-key";
}

export function defaultBaseUrl(id: string, settings: Record<string, string> = {}): string | undefined {
  const fromCatalog = catalogEndpoint(id, settings);
  if (fromCatalog) return fromCatalog;
  const profile = getIntegration(id);
  return settings.baseUrl || profile?.baseUrl || manifestRow(id)?.endpointDefaults;
}

export function defaultModelFor(id: string): string | undefined {
  const profile = getIntegration(id);
  const row = catalogEntry(id);
  const fromCatalog = row?.default_aux_model || row?.fallback_models?.[0];
  const fromProfile = profile?.defaultModels?.[0];
  const fromPi = catalogModels(id)[0];
  return fromCatalog || fromProfile || fromPi;
}

export function suggestedModels(id: string): string[] {
  const models = catalogModels(id);
  const fallback = getIntegration(id)?.defaultModels ?? [];
  return [...new Set([...models, ...fallback])];
}

export function requiresBaseUrlPrompt(id: string): boolean {
  if (id === "custom" || id === "openai-compatible") return true;
  if (id === "lmstudio") return false;
  return !defaultBaseUrl(id);
}

export function advancedSettingKeys(id: string): Set<string> {
  const keys = new Set(["baseUrl", "deployment", "apiMode", "apiVersion", "region", "profile", "project", "location"]);
  if (requiresBaseUrlPrompt(id)) keys.delete("baseUrl");
  return keys;
}

export function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

export async function discoverModels(options: {
  baseUrl: string;
  credential?: string;
  timeoutMs?: number;
}): Promise<string[]> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.credential) headers.Authorization = `Bearer ${options.credential}`;
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as { data?: Array<{ id?: string }>; models?: Array<{ id?: string } | string> };
  const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
  return rows
    .map((row) => (typeof row === "string" ? row : row.id))
    .filter((id): id is string => Boolean(id));
}
