import { describe, expect, test } from "bun:test";
import {
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

  test("fixture probe reflects env URL", async () => {
    const prev = process.env.KELI_BROWSER_FIXTURE_URL;
    process.env.KELI_BROWSER_FIXTURE_URL = "http://127.0.0.1:9";
    const status = await probeBrowserBackend("fixture");
    expect(status.available).toBe(true);
    if (prev === undefined) delete process.env.KELI_BROWSER_FIXTURE_URL;
    else process.env.KELI_BROWSER_FIXTURE_URL = prev;
  });
});
