import { registerIntegration } from "../../registry.ts";
import { fixtureCompletionRoundTrip } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const fixtureProviderProfile: IntegrationProfile = {
  id: "fixture",
  kind: "model-provider",
  displayName: "Fixture provider",
  aliases: ["keli-fixture"],
  auth: { type: "none" },
  settings: [{ key: "baseUrl", label: "Fixture URL" }],
  fixtureKey: "model",
  apiMode: "chat-completions",
  defaultModels: ["keli-fixture"],
  reuse: {
    upstream: "Keli fixture server",
    pin: "in-tree",
    license: "Apache-2.0",
    prdIds: ["A01"],
  },
  async probe(ctx) {
    const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
    return statusOf({
      id: "fixture",
      kind: "model-provider",
      displayName: "Fixture provider",
      configured: Boolean(url),
      reachable: Boolean(url),
      reason: url ? "fixture URL configured" : "set KELI_FIXTURE_MODEL or KELI_FIXTURE_URL",
      howToConfigure: "Set KELI_FIXTURE_URL (CI) or keli config set integrations.fixture.settings.baseUrl",
    });
  },
  roundTrip: fixtureCompletionRoundTrip,
};

registerIntegration(fixtureProviderProfile);
