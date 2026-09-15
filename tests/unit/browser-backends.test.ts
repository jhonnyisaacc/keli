import { describe, expect, test } from "bun:test";
import {
  browserConfigFromKeli,
  probeBrowserBackend,
  selectBrowserBackend,
  type BrowserBackendStatus,
} from "../../src/execution/browser-backends.ts";

describe("browser backends", () => {
  test("selects configured primary when available", () => {
    const statuses: BrowserBackendStatus[] = [
      { kind: "fixture", available: true },
      { kind: "playwright", available: true },
      { kind: "cdp", available: false, reason: "unset" },
      { kind: "mcp", available: false, reason: "unset" },
    ];
    expect(selectBrowserBackend(statuses, { primary: "playwright" })).toBe("playwright");
  });

  test("falls back when primary unavailable", () => {
    const statuses: BrowserBackendStatus[] = [
      { kind: "fixture", available: true },
      { kind: "playwright", available: false, reason: "missing" },
      { kind: "cdp", available: false },
      { kind: "mcp", available: false },
    ];
    expect(
      selectBrowserBackend(statuses, { primary: "playwright", fallback: "fixture" }),
    ).toBe("fixture");
  });

  test("browserConfigFromKeli maps saved setup onto runtime backends", () => {
    const prev = {
      fixture: process.env.KELI_BROWSER_FIXTURE_URL,
      cdp: process.env.KELI_BROWSER_CDP_URL,
      mcp: process.env.KELI_BROWSER_MCP_URL,
      fixtureAlias: process.env.KELI_FIXTURE_BROWSER,
      cdpAlias: process.env.KELI_FIXTURE_BROWSER_CDP,
      mcpAlias: process.env.KELI_FIXTURE_BROWSER_MCP,
    };
    delete process.env.KELI_BROWSER_FIXTURE_URL;
    delete process.env.KELI_BROWSER_CDP_URL;
    delete process.env.KELI_BROWSER_MCP_URL;
    delete process.env.KELI_FIXTURE_BROWSER;
    delete process.env.KELI_FIXTURE_BROWSER_CDP;
    delete process.env.KELI_FIXTURE_BROWSER_MCP;
    try {
      const mapped = browserConfigFromKeli({
        browser: { primary: "cdp", fallback: "playwright" },
        integrations: {
          "browser-cdp": { settings: { url: "http://127.0.0.1:9333" } },
          "browser-mcp": { settings: { baseUrl: "http://127.0.0.1:9334" } },
        },
      });
      expect(mapped.primary).toBe("cdp");
      expect(mapped.fallback).toBe("playwright");
      expect(mapped.cdpUrl).toBe("http://127.0.0.1:9333");
      expect(mapped.mcpUrl).toBe("http://127.0.0.1:9334");
      expect(mapped.fixtureUrl).toBeUndefined();
    } finally {
      if (prev.fixture === undefined) delete process.env.KELI_BROWSER_FIXTURE_URL;
      else process.env.KELI_BROWSER_FIXTURE_URL = prev.fixture;
      if (prev.cdp === undefined) delete process.env.KELI_BROWSER_CDP_URL;
      else process.env.KELI_BROWSER_CDP_URL = prev.cdp;
      if (prev.mcp === undefined) delete process.env.KELI_BROWSER_MCP_URL;
      else process.env.KELI_BROWSER_MCP_URL = prev.mcp;
      if (prev.fixtureAlias === undefined) delete process.env.KELI_FIXTURE_BROWSER;
      else process.env.KELI_FIXTURE_BROWSER = prev.fixtureAlias;
      if (prev.cdpAlias === undefined) delete process.env.KELI_FIXTURE_BROWSER_CDP;
      else process.env.KELI_FIXTURE_BROWSER_CDP = prev.cdpAlias;
      if (prev.mcpAlias === undefined) delete process.env.KELI_FIXTURE_BROWSER_MCP;
      else process.env.KELI_FIXTURE_BROWSER_MCP = prev.mcpAlias;
    }
  });

  test("fixture probe reflects env URL", async () => {
    const prev = process.env.KELI_BROWSER_FIXTURE_URL;
    process.env.KELI_BROWSER_FIXTURE_URL = "http://127.0.0.1:9";
    const status = await probeBrowserBackend("fixture");
    expect(status.available).toBe(true);
    if (prev === undefined) delete process.env.KELI_BROWSER_FIXTURE_URL;
    else process.env.KELI_BROWSER_FIXTURE_URL = prev;
  });
});
