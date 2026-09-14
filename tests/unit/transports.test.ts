import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mcpCallTool, mcpListTools, validateMcpToolCall } from "../../src/adapters/mcp.ts";
import { delegateRun } from "../../src/adapters/delegate.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import {
  consumePairing,
  issuePairingCode,
  pairingAccepts,
  pairingExpiresAt,
  pairingPhrase,
  type PairingChallenge,
} from "../../src/transports/pairing.ts";
import { installServiceFiles, readInstalledService } from "../../src/ops/service.ts";
import { listByCategory } from "../../src/integrations/manifest.ts";
import "../../src/integrations/load.ts";

describe("transports, MCP, delegates, and service lifecycle", () => {
  test("mcp.tools/call inspects tools/list and rejects unknown names and missing args", async () => {
    const fixture = startIntegrationFixture();
    const listed = await mcpListTools(fixture.endpoint);
    expect(listed.ok).toBe(true);
    const unknown = await mcpCallTool({ name: "not-a-tool", arguments: { text: "hi" } }, fixture.endpoint);
    expect(unknown.ok).toBe(false);
    expect(unknown.error?.code).toBe("invalid_request");
    const missing = await mcpCallTool({ name: "echo", arguments: {} }, fixture.endpoint);
    expect(missing.ok).toBe(false);
    expect(missing.error?.code).toBe("invalid_request");
    const ok = await mcpCallTool({ name: "echo", arguments: { text: "hi" } }, fixture.endpoint);
    expect(ok.ok).toBe(true);
    fixture.stop();
  });

  test("validateMcpToolCall is schema-local and does not require a live server", () => {
    const tools = [
      { name: "echo", inputSchema: { type: "object", required: ["text"], properties: { text: { type: "string" } } } },
    ];
    expect(validateMcpToolCall(tools, "echo", { text: "ok" })).toBeNull();
    expect(validateMcpToolCall(tools, "other", {})?.error?.code).toBe("invalid_request");
    expect(validateMcpToolCall(tools, "echo", {})?.error?.message).toContain("text");
  });

  test("delegate completion without artifacts stays unverified", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        if (new URL(req.url).pathname.endsWith("/delegate")) {
          return Response.json({ sessionId: "s1", status: "completed", artifacts: [], usageBytes: 0 });
        }
        return new Response("no", { status: 404 });
      },
    });
    const result = await delegateRun(
      { actionId: "a1", delegate: "OpenCode", goal: "noop", workspace: "/tmp", cancelEpoch: 0 },
      `http://127.0.0.1:${server.port}`,
    );
    expect(result.ok).toBe(true);
    expect((result.output as { verification: string }).verification).toBe("unverified");
    server.stop(true);
  });

  test("pairing is route-bound and one-use", () => {
    const code = issuePairingCode();
    const challenge: PairingChallenge = {
      transport: "discord",
      externalId: "chan-1:thread-9",
      code,
      expiresAt: pairingExpiresAt(),
    };
    expect(pairingAccepts(challenge, pairingPhrase(code), { transport: "telegram", externalId: "chan-1:thread-9" })).toBe(false);
    expect(pairingAccepts(challenge, pairingPhrase(code), { transport: "discord", externalId: "other" })).toBe(false);
    expect(pairingAccepts(challenge, pairingPhrase(code), { transport: "discord", externalId: "thread:thread-9" })).toBe(true);
    const used = consumePairing(challenge, "actor-1");
    expect(used.verifiedAt).toBeTruthy();
    expect(pairingAccepts(used, pairingPhrase(code), { transport: "discord", externalId: "thread:thread-9" })).toBe(false);
    expect(consumePairing(used, "actor-2").pairedActorId).toBe("actor-1");
  });

  test("service install writes a lifecycle unit that runs the existing scheduler loop", async () => {
    expect(listByCategory().some((row) => row.category === "service")).toBe(false);
    const dest = await mkdir(join(tmpdir(), `keli-svc-${crypto.randomUUID()}`), { recursive: true });
    const installed = await installServiceFiles({ execPath: "/tmp/keli", destDir: dest, platform: "linux" });
    const body = await readInstalledService(dest, "linux");
    expect(installed.path).toContain("keli.service");
    expect(body).toContain("service run --loop 30");
    expect(body).not.toContain("provider");
  });
});
