import { fixtureUrlFor } from "../integrations/env.ts";
import { getIntegration } from "../integrations/registry.ts";
import { listByCategory, resolveReadiness, type ManifestRow } from "../integrations/manifest.ts";
import { FIRST_USE_PROVIDERS } from "../integrations/first-use.ts";
import type { KeliConfig } from "../state/config.ts";

export type SetupCategoryId =
  | "models"
  | "search"
  | "memory"
  | "browser"
  | "documents"
  | "speech"
  | "messaging"
  | "delegates"
  | "service";

export type SetupCategory = {
  id: SetupCategoryId;
  label: string;
  manifestCategory?: ManifestRow["category"];
};

export const SETUP_CATEGORIES: SetupCategory[] = [
  { id: "models", label: "Chat/Models", manifestCategory: "model-provider" },
  { id: "search", label: "Search", manifestCategory: "search" },
  { id: "memory", label: "Memory", manifestCategory: "memory" },
  { id: "browser", label: "Browser", manifestCategory: "browser-backend" },
  { id: "documents", label: "Documents/OCR", manifestCategory: "documents" },
  { id: "speech", label: "Speech", manifestCategory: "speech" },
  { id: "messaging", label: "Messaging", manifestCategory: "transport" },
  { id: "delegates", label: "External tools/delegates", manifestCategory: "delegate" },
  { id: "service", label: "Background service" },
];

export const OPTIONAL_CATEGORIES: SetupCategory[] = SETUP_CATEGORIES.filter((c) => c.id !== "models");

export type SetupBadge = "ready" | "needs credentials" | "fixture only" | "blocked";

export function setupBadge(row: ManifestRow, config?: KeliConfig | null, allowFixture = false): SetupBadge {
  const readiness = resolveReadiness(row, config);
  if (readiness === "excluded" || readiness === "blocked" || row.status === "blocked") return "blocked";
  if (row.protocol === "fixture-only" || row.id === "fixture") return allowFixture ? "fixture only" : "blocked";
  if (readiness === "live-verified" || readiness === "configured") return "ready";
  if (row.authStrategy === "none" && readiness === "fixture-verified") return "ready";
  if (row.authStrategy !== "none" && !config?.integrations?.[row.id]?.credentialRef && !fixtureUrlFor(row.id)) {
    return "needs credentials";
  }
  if (readiness === "fixture-verified" && !config?.integrations?.[row.id]) return allowFixture ? "fixture only" : "needs credentials";
  return getIntegration(row.id) ? "needs credentials" : "blocked";
}

export function providersForCategory(
  category: SetupCategory,
  config?: KeliConfig | null,
  allowFixture = false,
): ManifestRow[] {
  if (!category.manifestCategory) return [];
  const rows = listByCategory(category.manifestCategory).filter((row) => row.status !== "excluded");
  const visible = (list: ManifestRow[]) =>
    list.filter((row) => allowFixture || (row.protocol !== "fixture-only" && row.id !== "fixture"));
  if (category.id === "models") {
    return recommendedModelProviders(allowFixture);
  }
  if (category.id === "documents") {
    return visible([...listByCategory("documents"), ...listByCategory("ocr")].filter((row) => row.status !== "excluded"));
  }
  if (category.id === "delegates") {
    return visible([...listByCategory("delegate"), ...listByCategory("mcp-server")].filter((row) => row.status !== "excluded"));
  }
  return visible(rows);
}

function modelRows(allowFixture: boolean): ManifestRow[] {
  return listByCategory("model-provider").filter((row) => {
    if (row.status === "excluded" || row.status === "blocked") return false;
    return allowFixture || (row.protocol !== "fixture-only" && row.id !== "fixture");
  });
}

/** First-use shortlist only. The rest is behind `moreModelProviders`. */
export function recommendedModelProviders(allowFixture = false): ManifestRow[] {
  const rows = modelRows(allowFixture);
  return FIRST_USE_PROVIDERS.map((id) => rows.find((row) => row.id === id)).filter(Boolean) as ManifestRow[];
}

export function moreModelProviders(allowFixture = false): ManifestRow[] {
  return modelRows(allowFixture).filter(
    (row) => !FIRST_USE_PROVIDERS.includes(row.id as (typeof FIRST_USE_PROVIDERS)[number]),
  );
}

export function formatProviderChoice(index: number, row: ManifestRow, config?: KeliConfig | null, allowFixture = false): string {
  return `${index}. ${row.displayName} [${setupBadge(row, config, allowFixture)}]`;
}
