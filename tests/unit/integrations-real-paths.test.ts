import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mcpListTools, mcpCallTool } from "../../src/adapters/mcp.ts";
import { searchQuery } from "../../src/adapters/search.ts";
import { runCodexAppServerTurn } from "../../src/adapters/codex-app-server.ts";
import { addCredential } from "../../src/integrations/auth.ts";
import { chatgptConversationIncompatibility } from "../../src/integrations/chatgpt-boundary.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import "../../src/integrations/load.ts";

describe("configured search and MCP (not fixture-env)", () => {
  test("search uses config baseUrl without KELI_FIXTURE_SEARCH", async () => {
    const fixture = startIntegrationFixture();
    const prev = process.env.KELI_FIXTURE_SEARCH;
    delete process.env.KELI_FIXTURE_SEARCH;
    delete process.env.KELI_SEARCH_FIXTURE_URL;
    const result = await searchQuery(
      { query: "keli" },
      {
        config: {
          version: 2,
          ownerId: "o",
          defaultProjectId: "p",
          integrations: { search: { enabled: true, settings: { baseUrl: fixture.endpoint } } },
        },
      },
    );
    expect(result.ok).toBe(true);
    expect((result.output as { results: unknown[] }).results.length).toBeGreaterThan(0);
    fixture.stop();
    if (prev) process.env.KELI_FIXTURE_SEARCH = prev;
  });

  test("MCP JSON-RPC HTTP initialize + tools/list", async () => {
    const fixture = startIntegrationFixture();
    const prev = process.env.KELI_FIXTURE_MCP;
    delete process.env.KELI_FIXTURE_MCP;
    delete process.env.KELI_MCP_FIXTURE_URL;
    const listed = await mcpListTools(undefined, {
      version: 2,
      ownerId: "o",
      defaultProjectId: "p",
      mcp: { servers: [{ id: "fx", transport: "http", url: `${fixture.endpoint}/mcp-rpc` }] },
    });
    expect(listed.ok).toBe(true);
    const called = await mcpCallTool({ name: "echo", arguments: { text: "hi" } }, undefined, {
      version: 2,
      ownerId: "o",
      defaultProjectId: "p",
      mcp: { servers: [{ id: "fx", transport: "http", url: `${fixture.endpoint}/mcp-rpc` }] },
    });
    expect(called.ok).toBe(true);
    fixture.stop();
    if (prev) process.env.KELI_FIXTURE_MCP = prev;
  });

  test("MCP stdio JSON-RPC", async () => {
    const prev = process.env.KELI_FIXTURE_MCP;
    delete process.env.KELI_FIXTURE_MCP;
    delete process.env.KELI_MCP_FIXTURE_URL;
    const script = join(import.meta.dir, "../fixtures/mcp-stdio.ts");
    const listed = await mcpListTools(undefined, {
      version: 2,
      ownerId: "o",
      defaultProjectId: "p",
      mcp: { servers: [{ id: "fx", transport: "stdio", command: process.execPath, args: [script] }] },
    });
    expect(listed.ok).toBe(true);
    if (prev) process.env.KELI_FIXTURE_MCP = prev;
  });
});

describe("ChatGPT / Codex App Server boundary", () => {
  test("chatgpt oauth-device reports incompatibility instead of storing a key", async () => {
    await expect(addCredential("chatgpt", { type: "oauth-device", value: "sk-secret" })).rejects.toThrow(
      /Codex App Server/,
    );
    expect(chatgptConversationIncompatibility()).toContain("proposal-only");
  });

  test("codex app-server fixture completes a gated delegate turn", async () => {
    const script = join(import.meta.dir, "../fixtures/codex-app-server-stdio.ts");
    const result = await runCodexAppServerTurn(
      {
        actionId: "act-1",
        delegate: "Codex",
        goal: "summarize",
        workspace: import.meta.dir,
        cancelEpoch: 0,
      },
      undefined,
      { ...process.env, KELI_CODEX_APP_SERVER_BIN: script },
    );
    expect(result.ok).toBe(true);
    expect((result.output as { unverified?: boolean }).unverified).toBe(true);
  });
});
