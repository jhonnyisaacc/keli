import type { CapabilityResult } from "../capabilities/types.ts";
import { KeliError } from "../core/errors.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { JsonRpcStdioClient } from "../execution/jsonrpc-stdio.ts";
import type { KeliConfig } from "../state/config.ts";

export type McpTarget = {
  fixtureUrl?: string;
  httpUrl?: string;
  command?: string;
  args?: string[];
  cwd?: string;
};

export function mcpTargetFrom(config?: KeliConfig | null, fixtureUrl?: string): McpTarget {
  const fixture = fixtureUrl ?? fixtureUrlFor("mcp");
  const server = config?.mcp?.servers?.[0];
  return {
    fixtureUrl: fixture,
    httpUrl: server?.transport === "http" ? server.url : undefined,
    command: server?.transport === "stdio" ? server.command : undefined,
    args: server?.args,
  };
}

export async function mcpListTools(fixtureUrl?: string, config?: KeliConfig | null): Promise<CapabilityResult> {
  return mcpCall("mcp.tools/list", { op: "list" }, mcpTargetFrom(config, fixtureUrl));
}

export async function mcpCallTool(
  input: { name: string; arguments?: Record<string, unknown> },
  fixtureUrl?: string,
  config?: KeliConfig | null,
): Promise<CapabilityResult> {
  return mcpCall(
    "mcp.tools/call",
    { op: "call", name: input.name, arguments: input.arguments ?? {} },
    mcpTargetFrom(config, fixtureUrl),
  );
}

async function mcpCall(
  capabilityId: string,
  body: Record<string, unknown>,
  target: McpTarget,
): Promise<CapabilityResult> {
  try {
    if (target.fixtureUrl) {
      return await fixturePost(capabilityId, target.fixtureUrl, body);
    }
    if (target.httpUrl) {
      return await jsonRpcHttp(capabilityId, target.httpUrl, body);
    }
    if (target.command) {
      return await jsonRpcStdio(capabilityId, target, body);
    }
    return unavailable(capabilityId);
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId,
      ok: false,
      error: { code: keli?.code ?? "unknown", message: keli?.message ?? String(e) },
    };
  }
}

async function fixturePost(
  capabilityId: string,
  fixtureUrl: string,
  body: Record<string, unknown>,
): Promise<CapabilityResult> {
  const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new KeliError(`MCP fixture HTTP ${response.status}`, "engine_error");
  const output = await response.json();
  return { capabilityId, ok: true, output };
}

/**
 * ADOPT MCP JSON-RPC 2024-11-05 over HTTP POST (bounded; Keli owns auth and process lifetime).
 * initialize → notifications/initialized → tools/list or tools/call.
 */
async function jsonRpcHttp(
  capabilityId: string,
  url: string,
  body: Record<string, unknown>,
): Promise<CapabilityResult> {
  const rpc = async (method: string, params: unknown, id: number) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new KeliError(`MCP HTTP ${response.status}`, "engine_error", response.status >= 500);
    return (await response.json()) as { result?: unknown; error?: { message: string } };
  };
  await rpc(
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "keli", version: "0.1.0" },
    },
    1,
  );
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => undefined);

  if (body.op === "list") {
    const listed = await rpc("tools/list", {}, 2);
    if (listed.error) throw new KeliError(listed.error.message, "engine_error");
    return { capabilityId, ok: true, output: listed.result };
  }
  const called = await rpc("tools/call", { name: body.name, arguments: body.arguments ?? {} }, 3);
  if (called.error) throw new KeliError(called.error.message, "engine_error");
  return { capabilityId, ok: true, output: called.result };
}

async function jsonRpcStdio(
  capabilityId: string,
  target: McpTarget,
  body: Record<string, unknown>,
): Promise<CapabilityResult> {
  const client = JsonRpcStdioClient.spawn(target.command!, target.args ?? [], { cwd: target.cwd });
  try {
    const init = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "keli", version: "0.1.0" },
    });
    if (init.error) throw new KeliError(init.error.message, "engine_error");
    client.notify("notifications/initialized");
    if (body.op === "list") {
      const listed = await client.request("tools/list", {});
      if (listed.error) throw new KeliError(listed.error.message, "engine_error");
      return { capabilityId, ok: true, output: listed.result };
    }
    const called = await client.request("tools/call", { name: body.name, arguments: body.arguments ?? {} });
    if (called.error) throw new KeliError(called.error.message, "engine_error");
    return { capabilityId, ok: true, output: called.result };
  } finally {
    await client.close();
  }
}

function unavailable(capabilityId: string): CapabilityResult {
  return {
    capabilityId,
    ok: false,
    error: {
      code: "missing_access",
      message: "MCP is not connected. Run keli setup mcp to add a stdio or HTTP server, or omit mcp.tools/* from this responsibility.",
    },
  };
}
