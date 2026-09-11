import { describe, expect, test } from "bun:test";
import { probeBrowserBackend, navigateWithBrowser } from "../../src/execution/browser-backends.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";

describe("playwright browser backend", () => {
  test("navigate via playwright when available", async () => {
    const status = await probeBrowserBackend("playwright");
    if (!status.available) {
      console.warn(`skip playwright: ${status.reason}`);
      return;
    }

    const fixture = startIntegrationFixture();
    const result = await navigateWithBrowser(
      `${fixture.endpoint}/page`,
      { allowedHosts: ["127.0.0.1"] },
      { primary: "playwright" },
    );

    expect(result.backend).toBe("playwright");
    expect(result.content.length).toBeGreaterThan(0);
    fixture.stop();
  });
});
