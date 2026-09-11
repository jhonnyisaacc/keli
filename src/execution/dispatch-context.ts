import type { Database } from "bun:sqlite";
import type { BrowserBackendConfig } from "./browser-backends.ts";
import type { ResourcePolicy } from "./policy.ts";
import type { NetworkPolicy } from "./network-policy.ts";

export type FixtureEndpoints = {
  search?: string;
  browser?: string;
  mcp?: string;
  delegate?: string;
};

export type RunDispatchContext = {
  db: Database;
  runId: string;
  cancelEpoch: number;
};

export type DispatchContext = {
  policy: ResourcePolicy;
  network: NetworkPolicy;
  fixtures?: FixtureEndpoints;
  browser?: BrowserBackendConfig;
  cwd?: string;
  run?: RunDispatchContext;
};

export const DEFAULT_ALLOWED_HOSTS = ["127.0.0.1", "localhost"];

export function defaultNetworkPolicy(allowedHosts?: string[]): NetworkPolicy {
  return { allowedHosts: allowedHosts ?? DEFAULT_ALLOWED_HOSTS };
}

export function fixtureEndpointsFromEnv(): FixtureEndpoints {
  return {
    search: process.env.KELI_SEARCH_FIXTURE_URL,
    browser: process.env.KELI_BROWSER_FIXTURE_URL,
    mcp: process.env.KELI_MCP_FIXTURE_URL,
    delegate: process.env.KELI_DELEGATE_FIXTURE_URL,
  };
}
