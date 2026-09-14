import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { statePaths, resolveStateDir } from "./paths.ts";

import type { BrowserBackendKind } from "../execution/browser-backends.ts";
import type { CodingDelegate } from "../core/types.ts";
import type { ProviderRouting } from "../model/routing.ts";
import type { CredentialRef } from "../credentials/source.ts";
import type {
  CustomProvider,
  IntegrationConfigEntry,
  McpServerConfig,
  ProviderSelection,
} from "../integrations/types.ts";

export type StructuredToolConfig = {
  id?: string;
  bin?: string;
  binEnv?: string;
  args?: string[];
  workflows?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  stateDir?: string;
  stateEnvVar?: string;
  revision?: string;
  version?: string;
  summary?: string;
};

export type KeliConfig = {
  version: number;
  ownerId: string;
  defaultProjectId: string;
  primaryModel?: string;
  fallbackModel?: string;
  /** Pluggable browser session backends; HTTP/web.fetch remain the static-page complement. */
  browser?: {
    primary?: BrowserBackendKind;
    fallback?: BrowserBackendKind;
  };
  /** Coding delegate primary/fallback (rule still authoritative for default). */
  delegates?: {
    primary?: CodingDelegate;
    fallback?: CodingDelegate;
  };
  /** Transport bindings chosen during setup. */
  transports?: {
    discord?: { ownerUserId?: string; channelId?: string; threadId?: string };
    telegram?: { chatId?: string; topicId?: string };
  };
  setup?: {
    completedAt?: string;
    transport?: "discord" | "telegram" | "none";
    calibrationSkipped?: boolean;
    mode?: "full" | "minimal";
  };
  /** Provider role routing (0.1-G). */
  routing?: ProviderRouting;
  /** Durable global execution control (0.1-E). */
  control?: {
    autonomyPaused?: boolean;
    stopAllExecution?: boolean;
    pausedAt?: string;
    restoredAt?: string;
    routesRevalidated?: boolean;
  };
  integrations?: Record<string, IntegrationConfigEntry>;
  providers?: {
    primary?: ProviderSelection;
    fallback?: ProviderSelection[];
    custom?: CustomProvider[];
  };
  memory?: { provider?: string };
  mcp?: { servers?: McpServerConfig[] };
  pricing?: Record<string, { inputCentsPerMTok?: number; outputCentsPerMTok?: number }>;
  skills?: { activationUses?: number };
  /** Per-run budget caps applied to every model/tool attempt. Unset means default requests cap only. */
  budgets?: {
    requestsMax?: number;
    tokensMax?: number;
    toolCallsMax?: number;
    monetaryBudgetCents?: number;
    bytesMax?: number;
    retryBaseMs?: number;
  };
  /** Read-only source collections (markdown with frontmatter) indexed for research. */
  sources?: {
    collections?: Array<{ id: string; path: string; kind?: "notes" | "transcripts"; author?: string }>;
  };
  /** Outbound hosts research tools may fetch. Unset means loopback only. */
  network?: { allowedHosts?: string[] };
  /**
   * Structured external CLI tools. Executables and argv templates are configured here or
   * via named environment variables; the model never supplies a shell command.
   */
  tools?: {
    rocket?: StructuredToolConfig;
    external?: StructuredToolConfig[];
  };
  /** Heartbeat authoring file compiled into watch proposals by `keli watches import`. */
  watches?: { heartbeatFile?: string };
  /** Daily software updates. Default off; auto activates only at an idle boundary. */
  update?: {
    mode?: "off" | "notify" | "auto";
    manifestUrl?: string;
    lastCheckAt?: string;
    last?: { at: string; outcome: "up-to-date" | "available" | "installed" | "failed" | "deferred"; version?: string; detail?: string };
  };
};

const DEFAULT_CONFIG: KeliConfig = {
  version: 2,
  ownerId: "",
  defaultProjectId: "",
};

export function normalizeConfig(config: KeliConfig): KeliConfig {
  const next: KeliConfig = { ...config, version: Math.max(config.version ?? 1, 2) };
  if (!next.providers) next.providers = {};
  if (!next.integrations) next.integrations = {};
  if (next.primaryModel && !next.providers.primary) {
    next.providers.primary = { id: next.primaryModel };
  }
  if (next.fallbackModel && !next.providers.fallback?.length) {
    next.providers.fallback = [{ id: next.fallbackModel }];
  }
  if (next.transports?.discord?.channelId && !next.integrations.discord) {
    next.integrations.discord = {
      enabled: true,
      settings: {
        channelId: next.transports.discord.channelId,
        ...(next.transports.discord.threadId ? { threadId: next.transports.discord.threadId } : {}),
      },
    };
  }
  if (next.transports?.telegram?.chatId && !next.integrations.telegram) {
    next.integrations.telegram = {
      enabled: true,
      settings: {
        chatId: next.transports.telegram.chatId,
        ...(next.transports.telegram.topicId ? { topicId: next.transports.telegram.topicId } : {}),
      },
    };
  }
  return next;
}

export async function readConfig(stateDir?: string): Promise<KeliConfig | null> {
  const paths = statePaths(resolveStateDir(stateDir));
  const file = Bun.file(paths.config);
  if (!(await file.exists())) return null;
  const raw = (await file.json()) as KeliConfig;
  return normalizeConfig(raw);
}

export async function writeConfig(config: KeliConfig, stateDir?: string): Promise<void> {
  const paths = statePaths(resolveStateDir(stateDir));
  await mkdir(dirname(paths.config), { recursive: true });
  const normalized = normalizeConfig(config);
  const tmp = `${paths.config}.tmp`;
  await Bun.write(tmp, JSON.stringify(normalized, null, 2) + "\n");
  await Bun.write(paths.config, await Bun.file(tmp).arrayBuffer());
  const { unlink } = await import("node:fs/promises");
  await unlink(tmp).catch(() => {});
}

export function defaultConfig(): KeliConfig {
  return { ...DEFAULT_CONFIG };
}

export async function upsertIntegration(
  id: string,
  entry: IntegrationConfigEntry,
  stateDir?: string,
): Promise<KeliConfig> {
  const current = (await readConfig(stateDir)) ?? defaultConfig();
  current.integrations = { ...current.integrations, [id]: entry };
  await writeConfig(current, stateDir);
  return current;
}

export function getConfigValue(config: KeliConfig, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cursor: unknown = config;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

export function setConfigValue(config: KeliConfig, path: string, value: unknown): KeliConfig {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) throw new Error("Config path required");
  const clone = structuredClone(config) as Record<string, unknown>;
  let cursor: Record<string, unknown> = clone;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (next == null || typeof next !== "object") {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
  return normalizeConfig(clone as unknown as KeliConfig);
}

export function isSecretConfigPath(path: string): boolean {
  const last = path.split(".").pop() ?? "";
  return (
    last === "credentialRef" ||
    /api[-_]?key|token|secret|password/i.test(last)
  );
}

export type { CredentialRef };
