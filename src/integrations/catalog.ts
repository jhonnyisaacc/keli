import type { IntegrationKind, ReuseNote } from "./types.ts";

export type CatalogEntry = {
  id: string;
  kind: IntegrationKind;
  aliases: string[];
  displayName: string;
  summary: string;
  packages: string[];
  reuse: ReuseNote;
  bundled: boolean;
};

/** Static, pinned discovery catalog. Discovery never installs. */
export const DISCOVERY_CATALOG: CatalogEntry[] = [
  {
    id: "openai-compatible",
    kind: "model-provider",
    aliases: ["openai", "openrouter", "ollama", "vllm", "custom"],
    displayName: "OpenAI-compatible chat completions",
    summary: "Any /v1/chat/completions endpoint via named custom provider or openai-compatible profile",
    packages: [],
    reuse: {
      upstream: "OpenAI Chat Completions API",
      pin: "protocol",
      license: "n/a",
      prdIds: ["I8", "A05"],
    },
    bundled: true,
  },
  {
    id: "grok",
    kind: "model-provider",
    aliases: ["xai", "grok-build"],
    displayName: "xAI Grok (OpenAI-compatible)",
    summary: "OpenAI-compatible Grok endpoint; run override only, never a durable rule",
    packages: [],
    reuse: {
      upstream: "NousResearch/hermes-agent providers/xai",
      pin: "05d705dd695d1084388529124dc2ffe5ce919e89",
      license: "MIT (pattern)",
      prdIds: ["A05"],
    },
    bundled: true,
  },
  {
    id: "anthropic",
    kind: "model-provider",
    aliases: ["claude", "claude-code"],
    displayName: "Anthropic Messages",
    summary: "Native Messages API via maintained SDK when a credential exists",
    packages: ["@anthropic-ai/sdk"],
    reuse: {
      upstream: "Anthropic Messages API",
      pin: "not-wired",
      license: "SDK license at pin time",
      prdIds: ["I8"],
    },
    bundled: false,
  },
  {
    id: "discord",
    kind: "transport",
    aliases: ["discord.js"],
    displayName: "Discord",
    summary: "Inbox/outbox transport; official discord.js behind the existing contract",
    packages: ["discord.js"],
    reuse: {
      upstream: "discord.js",
      pin: "not-wired",
      license: "Apache-2.0",
      prdIds: ["A17", "A18"],
    },
    bundled: true,
  },
  {
    id: "telegram",
    kind: "transport",
    aliases: ["grammy", "grammY"],
    displayName: "Telegram",
    summary: "Inbox/outbox transport; grammY candidate when credentials exist",
    packages: ["grammy"],
    reuse: {
      upstream: "grammY",
      pin: "not-wired",
      license: "MIT",
      prdIds: ["A18", "A19"],
    },
    bundled: true,
  },
  {
    id: "honcho",
    kind: "memory",
    aliases: ["dialectic"],
    displayName: "Honcho",
    summary: "Optional network memory; rules/jobs never read it (A29)",
    packages: ["@honcho-ai/honcho-node"],
    reuse: {
      upstream: "Honcho",
      pin: "not-wired",
      license: "SDK license at pin time",
      prdIds: ["A29", "I1"],
    },
    bundled: true,
  },
  {
    id: "codex",
    kind: "delegate",
    aliases: ["openai-codex"],
    displayName: "Codex CLI (ACP)",
    summary: "Coding delegate via maintained ACP client",
    packages: ["@agentclientprotocol/sdk"],
    reuse: {
      upstream: "ACP",
      pin: "not-wired",
      license: "Apache-2.0",
      prdIds: ["A19", "A20", "A37"],
    },
    bundled: true,
  },
  {
    id: "opencode",
    kind: "delegate",
    aliases: ["open-code"],
    displayName: "OpenCode CLI (ACP)",
    summary: "Coding delegate via maintained ACP client",
    packages: ["@agentclientprotocol/sdk"],
    reuse: {
      upstream: "ACP",
      pin: "not-wired",
      license: "Apache-2.0",
      prdIds: ["A19", "A20", "A37"],
    },
    bundled: true,
  },
  {
    id: "mcp",
    kind: "mcp-server",
    aliases: ["modelcontextprotocol"],
    displayName: "MCP server",
    summary: "Official TypeScript SDK; user-declared servers in config.mcp.servers",
    packages: ["@modelcontextprotocol/sdk"],
    reuse: {
      upstream: "modelcontextprotocol/typescript-sdk",
      pin: "not-wired",
      license: "MIT",
      prdIds: ["A42", "A41"],
    },
    bundled: true,
  },
  {
    id: "playwright",
    kind: "browser-backend",
    aliases: ["browser"],
    displayName: "Playwright browser session",
    summary: "First browser conformance target; credential-ref login, no cookie import",
    packages: ["playwright"],
    reuse: {
      upstream: "Playwright",
      pin: "devDependency",
      license: "Apache-2.0",
      prdIds: ["I9"],
    },
    bundled: true,
  },
  {
    id: "search",
    kind: "search",
    aliases: ["web-search", "tavily", "brave"],
    displayName: "Search backend",
    summary: "Configured search API/client; fixture until a key is present",
    packages: [],
    reuse: {
      upstream: "provider search API",
      pin: "not-wired",
      license: "n/a",
      prdIds: ["I9"],
    },
    bundled: true,
  },
];

export type DiscoverResult = {
  query: string;
  matches: CatalogEntry[];
  installed: boolean;
  message: string;
};

export function discoverIntegrations(query: string): DiscoverResult {
  const q = query.trim().toLowerCase();
  const matches = DISCOVERY_CATALOG.filter((entry) => {
    if (entry.id === q || entry.displayName.toLowerCase().includes(q)) return true;
    return entry.aliases.some((a) => a.toLowerCase().includes(q));
  });
  const bundled = matches.some((m) => m.bundled);
  return {
    query,
    matches,
    installed: false,
    message: matches.length
      ? bundled
        ? `Discovery found ${matches.length} candidate(s). Bundled profiles are registered; nothing was installed.`
        : `Not integrated; discovery found ${matches.length} candidate(s); nothing installed.`
      : `Unknown integration '${query}'; discovery found 0 candidates; nothing installed.`,
  };
}
