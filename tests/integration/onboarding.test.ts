import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Database } from "bun:sqlite";
import { runSetup } from "../../src/setup/wizard.ts";
import { readConfig, writeConfig } from "../../src/state/config.ts";
import { searchQuery } from "../../src/adapters/search.ts";
import { mcpListTools } from "../../src/adapters/mcp.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { migrate } from "../../src/state/migrate.ts";
import { listTransportRoutes } from "../../src/transports/routes.ts";
import { pairingPhrase } from "../../src/transports/pairing.ts";

describe("first-use onboarding", () => {
  test("CLI-only setup records live-checked fixture, skips search, and explains missing search access", async () => {
    const prevModel = process.env.KELI_FIXTURE_URL;
    const prevSearch = process.env.KELI_FIXTURE_SEARCH;
    const prevSearchAlias = process.env.KELI_SEARCH_FIXTURE_URL;
    process.env.KELI_FIXTURE_URL = "http://127.0.0.1:1/v1";
    delete process.env.KELI_FIXTURE_SEARCH;
    delete process.env.KELI_SEARCH_FIXTURE_URL;
    const stateDir = await mkdtemp(join(tmpdir(), "keli-onboard-"));
    const result = await runSetup({
      stateDir,
      nonInteractive: true,
      transport: "none",
      primaryModel: "fixture",
      skipCalibration: true,
      skipTransportTest: true,
      minimal: true,
    });
    expect(result.projectName).toBe("personal");
    expect(result.transport).toBe("none");
    expect(result.searchConnected).toBe(false);
    const config = await readConfig(stateDir);
    expect(config?.setup?.liveChecked?.fixture || result.providerConnected).toBeTruthy();
    const missing = await searchQuery({ query: "keli" }, { config });
    expect(missing.ok).toBe(false);
    expect(missing.error?.code).toBe("missing_access");
    expect(missing.error?.message).toContain("keli setup search");
    if (prevModel === undefined) delete process.env.KELI_FIXTURE_URL;
    else process.env.KELI_FIXTURE_URL = prevModel;
    if (prevSearch === undefined) delete process.env.KELI_FIXTURE_SEARCH;
    else process.env.KELI_FIXTURE_SEARCH = prevSearch;
    if (prevSearchAlias === undefined) delete process.env.KELI_SEARCH_FIXTURE_URL;
    else process.env.KELI_SEARCH_FIXTURE_URL = prevSearchAlias;
    await rm(stateDir, { recursive: true, force: true });
  });

  test("search setup connects a generic endpoint", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-search-setup-"));
    const result = await runSetup({
      stateDir,
      nonInteractive: true,
      section: "search",
      searchEndpoint: fixture.endpoint,
      skipCalibration: true,
      skipTransportTest: true,
    });
    expect(result.searchConnected).toBe(true);
    const config = await readConfig(stateDir);
    const found = await searchQuery({ query: "keli" }, { config });
    expect(found.ok).toBe(true);
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });

  test("transport pairing code verifies without repeating research", async () => {
    const fixture = startIntegrationFixture();
    const prev = process.env.KELI_TELEGRAM_FIXTURE_URL;
    process.env.KELI_TELEGRAM_FIXTURE_URL = fixture.endpoint;
    const stateDir = await mkdtemp(join(tmpdir(), "keli-pair-"));
    const pending = await runSetup({
      stateDir,
      nonInteractive: true,
      transport: "telegram",
      telegramChat: "chat-pair",
      skipCalibration: true,
    });
    expect(pending.pairingPending || pending.pairingVerified).toBe(true);
    const first = await readConfig(stateDir);
    const code = first?.setup?.pairing?.code;
    expect(code).toBeTruthy();
    const verified = await runSetup({
      stateDir,
      nonInteractive: true,
      transport: "telegram",
      telegramChat: "chat-pair",
      skipCalibration: true,
      pairingCode: pairingPhrase(code!),
      pairingActorId: "owner-telegram",
    });
    expect(verified.pairingVerified).toBe(true);
    const config = await readConfig(stateDir);
    expect(config?.setup?.pairing?.verifiedAt).toBeTruthy();
    const db = new Database(join(stateDir, "state.sqlite"));
    migrate(db);
    expect(listTransportRoutes(db, "telegram").some((r) => r.externalId.includes("chat-pair"))).toBe(true);
    db.close();
    fixture.stop();
    if (prev === undefined) delete process.env.KELI_TELEGRAM_FIXTURE_URL;
    else process.env.KELI_TELEGRAM_FIXTURE_URL = prev;
    await rm(stateDir, { recursive: true, force: true });
  });

  test("unconfigured MCP returns missing_access", async () => {
    const prev = process.env.KELI_FIXTURE_MCP;
    const prevAlias = process.env.KELI_MCP_FIXTURE_URL;
    delete process.env.KELI_FIXTURE_MCP;
    delete process.env.KELI_MCP_FIXTURE_URL;
    const result = await mcpListTools();
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("missing_access");
    expect(result.error?.message).toContain("keli setup mcp");
    if (prev === undefined) delete process.env.KELI_FIXTURE_MCP;
    else process.env.KELI_FIXTURE_MCP = prev;
    if (prevAlias === undefined) delete process.env.KELI_MCP_FIXTURE_URL;
    else process.env.KELI_MCP_FIXTURE_URL = prevAlias;
  });

  test("search setup preserves MCP servers and the search credential ref", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-preserve-"));
    await runSetup({
      stateDir,
      nonInteractive: true,
      transport: "none",
      primaryModel: "fixture",
      skipCalibration: true,
      skipTransportTest: true,
      minimal: true,
    });
    const before = await readConfig(stateDir);
    expect(before).toBeTruthy();
    before!.mcp = {
      servers: [
        {
          id: "alpha",
          transport: "stdio",
          command: "node",
          args: ["server.js"],
          envRefs: [{ service: "keli/mcp-alpha", id: "token" }],
        },
        { id: "beta", transport: "http", url: "http://127.0.0.1:9/mcp" },
      ],
    };
    before!.integrations = {
      ...before!.integrations,
      mcp: {
        enabled: true,
        settings: { command: "node", transport: "stdio" },
        credentialRef: { service: "keli/mcp", id: "token" },
      },
      search: {
        enabled: true,
        settings: { baseUrl: "https://api.search.brave.com" },
        credentialRef: { service: "keli/search", id: "api-key" },
      },
    };
    await writeConfig(before!, stateDir);
    await runSetup({
      stateDir,
      nonInteractive: true,
      section: "search",
      searchEndpoint: fixture.endpoint,
      skipCalibration: true,
      skipTransportTest: true,
    });
    const after = await readConfig(stateDir);
    expect(after?.mcp?.servers).toHaveLength(2);
    expect(after?.mcp?.servers?.[0]).toMatchObject({ id: "alpha", command: "node", args: ["server.js"] });
    expect(after?.mcp?.servers?.[1]).toMatchObject({ id: "beta", url: "http://127.0.0.1:9/mcp" });
    expect(after?.integrations?.mcp?.credentialRef).toEqual({ service: "keli/mcp", id: "token" });
    expect(after?.integrations?.search?.credentialRef).toEqual({ service: "keli/search", id: "api-key" });
    expect(after?.integrations?.search?.settings.baseUrl).toBe(fixture.endpoint);
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });
});
