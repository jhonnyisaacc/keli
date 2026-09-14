import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const mcpFixtureProfile: IntegrationProfile = {
  id: "mcp",
  kind: "mcp-server",
  displayName: "MCP",
  aliases: ["modelcontextprotocol"],
  auth: { type: "none" },
  settings: [
    { key: "transport", label: "stdio or http", default: "http" },
    { key: "url", label: "HTTP URL" },
    { key: "command", label: "stdio command" },
  ],
  fixtureKey: "mcp",
  reuse: {
    upstream: "MCP JSON-RPC 2024-11-05 (HTTP + stdio)",
    pin: "protocol",
    license: "MIT",
    prdIds: ["A42", "A41"],
  },
  async probe(ctx) {
    const url = ctx.fixtureUrl ?? ctx.settings.url;
    return statusOf({
      id: "mcp",
      kind: "mcp-server",
      displayName: "MCP",
      configured: Boolean(url || ctx.settings.command),
      reachable: Boolean(url),
      reason: url || ctx.settings.command ? "MCP server configured" : "Run keli setup mcp",
      howToConfigure: "keli setup mcp  or set KELI_MCP_FIXTURE_URL",
    });
  },
};

registerIntegration(mcpFixtureProfile);
