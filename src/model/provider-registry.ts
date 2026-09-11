import type { ModelProvider } from "./provider.ts";
import { FixtureModelProvider } from "./provider.ts";
import { HttpModelProvider } from "./http-provider.ts";

export type ProviderKind = "fixture" | "openai-compatible" | "claude-code" | "grok-build" | "antigravity";

export type ProviderDescriptor = {
  id: string;
  kind: ProviderKind;
  available: boolean;
  reason?: string;
};

const NAMED_LATER: ProviderKind[] = ["claude-code", "grok-build", "antigravity"];

export function listProviders(): ProviderDescriptor[] {
  const fixtureUrl = process.env.KELI_FIXTURE_URL;
  const providerUrl = process.env.KELI_PROVIDER_URL;
  const grokUrl = process.env.KELI_GROK_FIXTURE_URL;

  const base: ProviderDescriptor[] = [
    {
      id: "fixture",
      kind: "fixture",
      available: Boolean(fixtureUrl),
      reason: fixtureUrl ? undefined : "set KELI_FIXTURE_URL",
    },
    {
      id: "openai-compatible",
      kind: "openai-compatible",
      available: Boolean(providerUrl),
      reason: providerUrl ? undefined : "set KELI_PROVIDER_URL",
    },
    {
      id: "grok",
      kind: "grok-build",
      available: Boolean(grokUrl || providerUrl),
      reason: grokUrl || providerUrl ? undefined : "set KELI_GROK_FIXTURE_URL or KELI_PROVIDER_URL",
    },
  ];

  for (const kind of NAMED_LATER) {
    if (kind === "grok-build") continue;
    base.push({
      id: kind,
      kind,
      available: false,
      reason: "unavailable until configured and release-pinned",
    });
  }

  return base;
}

export function resolveProvider(preferredId?: string): ModelProvider {
  const providers = listProviders();
  const requested = preferredId ?? process.env.KELI_PROVIDER_ID;
  const id =
    requested ??
    providers.find((p) => p.available)?.id ??
    "fixture";
  const desc = providers.find((p) => p.id === id);
  if (!desc?.available) {
    throw new Error(
      desc?.reason ?? `Provider '${id}' is not available. Run keli providers list.`,
    );
  }

  if (id === "fixture" || desc.kind === "fixture") {
    const endpoint = process.env.KELI_FIXTURE_URL;
    if (!endpoint) throw new Error("KELI_FIXTURE_URL required");
    return new FixtureModelProvider(endpoint);
  }

  if (id === "grok") {
    const endpoint = process.env.KELI_GROK_FIXTURE_URL ?? process.env.KELI_PROVIDER_URL;
    if (!endpoint) throw new Error("Grok provider not configured");
    return new HttpModelProvider(endpoint, "grok-fixture");
  }

  const endpoint = process.env.KELI_PROVIDER_URL;
  if (!endpoint) throw new Error("KELI_PROVIDER_URL required");
  return new HttpModelProvider(endpoint, id);
}

export function isRunOverrideDelegate(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === "codex" || lower === "opencode") return true;
  if (lower === "grok") {
    return listProviders().some((p) => p.id === "grok" && p.available);
  }
  return false;
}

export function normalizeOverrideDelegate(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "codex") return "Codex";
  if (lower === "opencode") return "OpenCode";
  if (lower === "grok") return "Grok";
  return name;
}
