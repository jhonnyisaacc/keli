import type { CapabilityResult } from "../capabilities/types.ts";
import { KeliError } from "../core/errors.ts";

export async function mcpListTools(fixtureUrl?: string): Promise<CapabilityResult> {
  if (!fixtureUrl) {
    return unavailable("mcp.tools/list");
  }
  return mcpPost("mcp.tools/list", fixtureUrl, { op: "list" });
}

export async function mcpCallTool(
  input: { name: string; arguments?: Record<string, unknown> },
  fixtureUrl?: string,
): Promise<CapabilityResult> {
  if (!fixtureUrl) {
    return unavailable("mcp.tools/call");
  }
  return mcpPost("mcp.tools/call", fixtureUrl, {
    op: "call",
    name: input.name,
    arguments: input.arguments ?? {},
  });
}

async function mcpPost(
  capabilityId: string,
  fixtureUrl: string,
  body: Record<string, unknown>,
): Promise<CapabilityResult> {
  try {
    const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new KeliError(`MCP fixture HTTP ${response.status}`, "engine_error");
    }
    const output = await response.json();
    return { capabilityId, ok: true, output };
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId,
      ok: false,
      error: {
        code: keli?.code ?? "unknown",
        message: keli?.message ?? String(e),
      },
    };
  }
}

function unavailable(capabilityId: string): CapabilityResult {
  return {
    capabilityId,
    ok: false,
    error: {
      code: "capability_unavailable",
      message: "MCP requires KELI_MCP_FIXTURE_URL or configured MCP server",
    },
  };
}
