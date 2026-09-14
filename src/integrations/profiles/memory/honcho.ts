import { fixtureEnabled } from "../../env.ts";
import { registerIntegration } from "../../registry.ts";
import { httpRoundTrip, notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const honchoProfile: IntegrationProfile = {
  id: "honcho",
  kind: "memory",
  displayName: "Honcho",
  aliases: ["dialectic"],
  auth: { type: "api-key" },
  settings: [
    { key: "baseUrl", label: "Honcho URL" },
    { key: "api-key", label: "API key", secret: true },
  ],
  fixtureKey: "honcho",
  reuse: {
    upstream: "Honcho",
    pin: "not-wired",
    license: "SDK at pin time",
    prdIds: ["A29", "I1"],
  },
  async probe(ctx) {
    const fixtureOn = fixtureEnabled("honcho") && Boolean(ctx.fixtureUrl ?? ctx.settings.baseUrl);
    return statusOf({
      id: "honcho",
      kind: "memory",
      displayName: "Honcho",
      configured: fixtureOn,
      credentialState: ctx.credentialRef ? "resolvable" : "n/a",
      reachable: fixtureOn,
      reason: fixtureOn
        ? "Honcho fixture enabled; advisory only, not a second memory authority"
        : "blocked/fixture-only until a documented HTTP contract is verified; local notes remain authoritative",
      howToConfigure: "Keep local notes. Fixture: KELI_HONCHO_ENABLED=1 and KELI_FIXTURE_HONCHO. Live Honcho is an owner milestone.",
    });
  },
  async roundTrip(ctx) {
    const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
    if (!fixtureEnabled("honcho") || !url) {
      return notConfigured(
        "Honcho credentials are not live retrieval. Local notes remain the memory authority until a stable HTTP contract is verified.",
      );
    }
    return httpRoundTrip({
      url: `${url.replace(/\/$/, "")}/honcho/query`,
      method: "POST",
      body: { scope: "probe", query: "keli-probe" },
      timeoutMs: ctx.timeoutMs,
      accept: (_status, body) => {
        try {
          const payload = JSON.parse(body) as { ok?: boolean };
          return payload.ok === true;
        } catch {
          return false;
        }
      },
    });
  },
};

registerIntegration(honchoProfile);
