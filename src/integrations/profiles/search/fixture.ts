import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const searchProfile: IntegrationProfile = {
  id: "search",
  kind: "search",
  displayName: "Search",
  aliases: ["web-search"],
  auth: { type: "api-key" },
  settings: [
    { key: "baseUrl", label: "Search endpoint" },
    { key: "api-key", label: "API key", secret: true },
  ],
  fixtureKey: "search",
  reuse: {
    upstream: "configured search API",
    pin: "not-wired",
    license: "n/a",
    prdIds: ["I9"],
  },
  async probe(ctx) {
    const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
    return statusOf({
      id: "search",
      kind: "search",
      displayName: "Search",
      configured: Boolean(url),
      credentialState: ctx.credentialRef ? "resolvable" : url ? "n/a" : "missing",
      reachable: Boolean(url),
      reason: url ? "search endpoint configured" : "set KELI_FIXTURE_SEARCH or auth add search",
      howToConfigure: "keli auth add search  or set KELI_SEARCH_FIXTURE_URL",
    });
  },
};

registerIntegration(searchProfile);
