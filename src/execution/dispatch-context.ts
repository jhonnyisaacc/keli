import type { Database } from "bun:sqlite";
import type { BrowserBackendConfig } from "./browser-backends.ts";
import type { ResourcePolicy } from "./policy.ts";
import type { NetworkPolicy } from "./network-policy.ts";
import type { SourceReader } from "../sources/reader.ts";
import { fixtureUrlFor } from "../integrations/env.ts";

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
  jobId?: string;
  stateDir?: string;
  ownerId?: string;
  /** Narrow read-only source index view; adapters never receive the canonical database. */
  sources?: SourceReader;
};

export const DEFAULT_ALLOWED_HOSTS = ["127.0.0.1", "localhost"];

export function defaultNetworkPolicy(allowedHosts?: string[]): NetworkPolicy {
  return { allowedHosts: allowedHosts ?? DEFAULT_ALLOWED_HOSTS };
}

export function fixtureEndpointsFromEnv(): FixtureEndpoints {
  return {
    search: fixtureUrlFor("search"),
    browser: fixtureUrlFor("browser"),
    mcp: fixtureUrlFor("mcp"),
    delegate: fixtureUrlFor("delegate"),
  };
}
