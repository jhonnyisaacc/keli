import { probeBrowserBackend, type BrowserBackendKind } from "../../../execution/browser-backends.ts";
import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

const KINDS: Array<{ id: BrowserBackendKind; displayName: string; fixtureKey?: IntegrationProfile["fixtureKey"] }> = [
  { id: "fixture", displayName: "Browser fixture", fixtureKey: "browser" },
  { id: "playwright", displayName: "Playwright" },
  { id: "cdp", displayName: "CDP", fixtureKey: "browser-cdp" },
  { id: "mcp", displayName: "Browser MCP", fixtureKey: "browser-mcp" },
];

for (const kind of KINDS) {
  const profile: IntegrationProfile = {
    id: `browser-${kind.id}`,
    kind: "browser-backend",
    displayName: kind.displayName,
    aliases: kind.id === "fixture" ? ["browser"] : [kind.id],
    auth: { type: "none" },
    settings: [{ key: "url", label: "Endpoint" }],
    fixtureKey: kind.fixtureKey,
    reuse: {
      upstream: "Hermes-style browser seam",
      pin: "in-tree browser-backends.ts",
      license: "Apache-2.0",
      prdIds: ["I9"],
    },
    async probe() {
      const result = await probeBrowserBackend(kind.id);
      return statusOf({
        id: `browser-${kind.id}`,
        kind: "browser-backend",
        displayName: kind.displayName,
        configured: result.available,
        reachable: result.available,
        reason: result.reason,
        howToConfigure:
          kind.id === "playwright"
            ? "bun add -d playwright && bunx playwright install chromium"
            : `configure browser.${kind.id} or matching KELI_FIXTURE_* URL`,
      });
    },
  };
  registerIntegration(profile);
}
