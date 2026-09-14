import { registerIntegration } from "../../registry.ts";
import { httpRoundTrip, notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

function isBrave(url: string): boolean {
  try {
    return new URL(url).host.includes("search.brave.com") || url.includes("/res/v1/web/search");
  } catch {
    return url.includes("search.brave.com") || url.includes("/res/v1/web/search");
  }
}

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
    upstream: "generic search HTTP + Brave Search API (Hermes web_search backend)",
    pin: "protocol",
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
      reason: url ? "search endpoint configured" : "set KELI_FIXTURE_SEARCH or keli setup search",
      howToConfigure: "keli setup search  or keli auth add search",
    });
  },
  async roundTrip(ctx) {
    const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
    if (!url) return notConfigured("Search is not connected. Run keli setup search.");
    if (isBrave(url)) {
      if (!ctx.credential) return notConfigured("Brave needs an API key");
      const endpoint = url.includes("/res/v1/web/search") ? url : `${url.replace(/\/$/, "")}/res/v1/web/search`;
      const probe = new URL(endpoint);
      probe.searchParams.set("q", "keli-probe");
      return httpRoundTrip({
        url: probe.toString(),
        headers: { Accept: "application/json", "X-Subscription-Token": ctx.credential },
        timeoutMs: ctx.timeoutMs,
      });
    }
    return httpRoundTrip({
      url: `${url.replace(/\/$/, "")}/search`,
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(ctx.credential ? { Authorization: `Bearer ${ctx.credential}` } : {}),
      },
      body: { query: "keli-probe" },
      timeoutMs: ctx.timeoutMs,
    });
  },
};

registerIntegration(searchProfile);
