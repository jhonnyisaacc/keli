import type { KeliConfig } from "../state/config.ts";
import data from "./provider-manifest.json";

export const HERMES_PIN = data.attribution.hermes.pin;
export const NANOBOT_PIN = data.attribution.nanobot.pin;

export type ProtocolFamily =
  | "native-sdk"
  | "openai-compatible-http"
  | "openai-responses"
  | "anthropic-messages"
  | "other-http"
  | "oauth-external-cli"
  | "cloud-sdk"
  | "local-process"
  | "fixture-only"
  | "unsupported";

export type InventoryStatus = "catalogued" | "fixture-verified" | "blocked" | "excluded";
export type ReadinessStatus = InventoryStatus | "configured" | "live-verified";
export type ProviderCategory = (typeof data.providers)[number]["category"];

export type ManifestRow = (typeof data.providers)[number];
export type ManifestReadiness = ManifestRow & { readiness: ReadinessStatus };

export type CatalogEntry = {
  name: string;
  display_name?: string;
  aliases?: string[];
  base_url?: string;
  env_vars?: string[];
  auth_type?: string;
  api_mode?: string;
  default_aux_model?: string | null;
  fallback_models?: string[];
};

export const providerManifest = data;

export function inferenceCatalogEntries(): CatalogEntry[] {
  return data.hermesInference as CatalogEntry[];
}

export function listByCategory(category?: string): ManifestRow[] {
  const rows = data.providers as ManifestRow[];
  return category ? rows.filter((row) => row.category === category) : rows;
}

export function manifestRow(id: string): ManifestRow | undefined {
  return (data.providers as ManifestRow[]).find((row) => row.id === id);
}

function selectedModel(config: KeliConfig | null | undefined, id: string): string | undefined {
  if (config?.providers?.primary?.id === id) return config.providers.primary.model;
  const fallback = config?.providers?.fallback?.find((p) => p.id === id);
  if (fallback?.model) return fallback.model;
  return config?.integrations?.[id]?.settings?.model;
}

function isConfigured(config: KeliConfig | null | undefined, id: string): boolean {
  const entry = config?.integrations?.[id];
  if (!entry) return false;
  return Boolean(entry.enabled || entry.credentialRef || entry.settings?.baseUrl || entry.settings?.url || entry.settings?.command);
}

export function resolveReadiness(row: ManifestRow, config?: KeliConfig | null): ReadinessStatus {
  if (row.status === "excluded") return "excluded";
  const model = selectedModel(config, row.id);
  const live = config?.setup?.liveChecked?.[row.id];
  if (live?.at && (live.model ?? "") === (model ?? "")) return "live-verified";
  if (isConfigured(config, row.id)) return "configured";
  return row.status;
}

export function listByStatus(config?: KeliConfig | null, status?: ReadinessStatus): ManifestReadiness[] {
  const merged = listByCategory().map((row) => ({ ...row, readiness: resolveReadiness(row, config) }));
  return status ? merged.filter((row) => row.readiness === status) : merged;
}
