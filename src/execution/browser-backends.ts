import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { KeliError } from "../core/errors.ts";
import type { NetworkPolicy } from "./network-policy.ts";
import { assertAllowedHost } from "./network-policy.ts";
import { fixtureUrlFor } from "../integrations/env.ts";

const PLAYWRIGHT_SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/playwright-navigate.ts",
);

/** Pluggable browser session backends (Hermes-style provider seam). */
export type BrowserBackendKind = "fixture" | "playwright" | "cdp" | "mcp";

export type BrowserBackendStatus = {
  kind: BrowserBackendKind;
  available: boolean;
  reason?: string;
};

export type BrowserNavigateOutput = {
  url: string;
  title: string;
  content: string;
  backend: BrowserBackendKind;
};

export type BrowserBackendConfig = {
  primary?: BrowserBackendKind;
  fallback?: BrowserBackendKind;
  fixtureUrl?: string;
  cdpUrl?: string;
  mcpUrl?: string;
};

const ALL_KINDS: BrowserBackendKind[] = ["fixture", "playwright", "cdp", "mcp"];

export function browserConfigFromEnv(): BrowserBackendConfig {
  return {
    fixtureUrl: fixtureUrlFor("browser"),
    cdpUrl: fixtureUrlFor("browser-cdp"),
    mcpUrl: fixtureUrlFor("browser-mcp"),
  };
}

export async function probeBrowserBackend(
  kind: BrowserBackendKind,
  config: BrowserBackendConfig = {},
): Promise<BrowserBackendStatus> {
  const merged = { ...browserConfigFromEnv(), ...config };
  switch (kind) {
    case "fixture":
      return merged.fixtureUrl
        ? { kind, available: true, reason: "fixture URL configured" }
        : { kind, available: false, reason: "set KELI_BROWSER_FIXTURE_URL" };
    case "playwright":
      return probePlaywright();
    case "cdp":
      return merged.cdpUrl
        ? { kind, available: true, reason: "CDP endpoint configured" }
        : { kind, available: false, reason: "set KELI_BROWSER_CDP_URL" };
    case "mcp":
      return merged.mcpUrl
        ? { kind, available: true, reason: "browser MCP endpoint configured" }
        : { kind, available: false, reason: "set KELI_BROWSER_MCP_URL" };
  }
}

export async function probeBrowserBackends(
  config: BrowserBackendConfig = {},
): Promise<BrowserBackendStatus[]> {
  const merged = { ...browserConfigFromEnv(), ...config };
  return Promise.all(ALL_KINDS.map((kind) => probeBrowserBackend(kind, merged)));
}

async function probePlaywright(): Promise<BrowserBackendStatus> {
  try {
    const proc = Bun.spawn(["bun", PLAYWRIGHT_SCRIPT, "about:blank"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    if (code === 0) {
      return { kind: "playwright", available: true, reason: "playwright navigate script OK" };
    }
    const err = (await new Response(proc.stderr).text()).trim();
    return {
      kind: "playwright",
      available: false,
      reason: err || "install playwright: bun add -d playwright && bunx playwright install chromium",
    };
  } catch (e) {
    return { kind: "playwright", available: false, reason: String(e) };
  }
}

export function selectBrowserBackend(
  statuses: BrowserBackendStatus[],
  config: BrowserBackendConfig = {},
): BrowserBackendKind | null {
  const merged = { ...browserConfigFromEnv(), ...config };
  const byKind = new Map(statuses.map((s) => [s.kind, s]));
  const tryKind = (kind?: BrowserBackendKind) => {
    if (!kind) return null;
    const status = byKind.get(kind);
    return status?.available ? kind : null;
  };

  const primary = tryKind(merged.primary);
  if (primary) return primary;
  const fallback = tryKind(merged.fallback);
  if (fallback) return fallback;

  for (const kind of ALL_KINDS) {
    const selected = tryKind(kind);
    if (selected) return selected;
  }
  return null;
}

export async function navigateWithBrowser(
  url: string,
  policy: NetworkPolicy,
  config: BrowserBackendConfig = {},
): Promise<BrowserNavigateOutput> {
  const merged = { ...browserConfigFromEnv(), ...config };
  const statuses = await probeBrowserBackends(merged);
  const backend = selectBrowserBackend(statuses, merged);
  if (!backend) {
    const hints = statuses.map((s) => `${s.kind}: ${s.reason ?? "unavailable"}`).join("; ");
    throw new KeliError(
      `No browser backend available (${hints}). For static pages use web.fetch; configure browser.primary in config.`,
      "capability_unavailable",
    );
  }

  assertAllowedHost(policy, url);
  switch (backend) {
    case "fixture":
      return { ...await navigateViaFixture(url, merged.fixtureUrl!), backend };
    case "playwright":
      return { ...await navigateViaPlaywright(url), backend };
    case "cdp":
      return { ...await navigateViaCdp(url, merged.cdpUrl!), backend };
    case "mcp":
      return { ...await navigateViaMcp(url, merged.mcpUrl!), backend };
  }
}

async function navigateViaFixture(
  url: string,
  fixtureUrl: string,
): Promise<Omit<BrowserNavigateOutput, "backend">> {
  const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/navigate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new KeliError(`Browser fixture HTTP ${response.status}`, "engine_error");
  }
  return (await response.json()) as Omit<BrowserNavigateOutput, "backend">;
}

async function navigateViaPlaywright(
  url: string,
): Promise<Omit<BrowserNavigateOutput, "backend">> {
  const proc = Bun.spawn(["bun", PLAYWRIGHT_SCRIPT, url], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const code = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  if (code !== 0) {
    throw new KeliError(
      stderr.trim() || `Playwright navigate failed (${code})`,
      "capability_unavailable",
    );
  }
  return JSON.parse(stdout) as Omit<BrowserNavigateOutput, "backend">;
}

async function navigateViaCdp(
  url: string,
  cdpUrl: string,
): Promise<Omit<BrowserNavigateOutput, "backend">> {
  const response = await fetch(`${cdpUrl.replace(/\/$/, "")}/navigate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new KeliError(`Browser CDP bridge HTTP ${response.status}`, "engine_error");
  }
  return (await response.json()) as Omit<BrowserNavigateOutput, "backend">;
}

async function navigateViaMcp(
  url: string,
  mcpUrl: string,
): Promise<Omit<BrowserNavigateOutput, "backend">> {
  const response = await fetch(`${mcpUrl.replace(/\/$/, "")}/navigate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new KeliError(`Browser MCP bridge HTTP ${response.status}`, "engine_error");
  }
  return (await response.json()) as Omit<BrowserNavigateOutput, "backend">;
}
