import type { CapabilityResult } from "../capabilities/types.ts";

export const MISSING_ACCESS = "missing_access";

export const SEARCH_MISSING_ACCESS =
  "Search is not connected. Run keli setup search to add Brave or a generic JSON endpoint, then retry. Conversation still works without web search.";

export const MCP_MISSING_ACCESS =
  "MCP is not connected. Run keli setup mcp to add a stdio or HTTP server, or omit mcp.tools/* from this responsibility.";

export const ROCKET_MISSING_ACCESS =
  "tools.rocket is not available. Set ROCKET_BIN or tools.rocket.bin to a real executable, or omit tools.rocket from this responsibility.";

export function missingAccessResult(capabilityId: string, message: string): CapabilityResult {
  return {
    capabilityId,
    ok: false,
    error: { code: MISSING_ACCESS, message, retryable: false },
  };
}
