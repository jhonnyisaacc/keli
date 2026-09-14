import { registerIntegration } from "../../registry.ts";
import { openAiModelsRoundTrip } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const grokProfile: IntegrationProfile = {
  id: "grok",
  kind: "model-provider",
  displayName: "Grok (xAI)",
  aliases: ["xai", "grok-build"],
  auth: { type: "api-key" },
  settings: [
    { key: "baseUrl", label: "Base URL" },
    { key: "api-key", label: "API key", secret: true },
  ],
  fixtureKey: "grok",
  apiMode: "chat-completions",
  defaultModels: ["grok-4"],
  reuse: {
    upstream: "NousResearch/hermes-agent xAI profile",
    pin: "05d705dd695d1084388529124dc2ffe5ce919e89",
    license: "MIT (pattern)",
    prdIds: ["A05"],
  },
  async probe(ctx) {
    const url = ctx.settings.baseUrl ?? ctx.fixtureUrl;
    return statusOf({
      id: "grok",
      kind: "model-provider",
      displayName: "Grok (xAI)",
      configured: Boolean(url || ctx.credentialRef),
      credentialState: ctx.needsReauth ? "needs-reauth" : ctx.credentialRef ? "resolvable" : url ? "n/a" : "missing",
      reachable: Boolean(url),
      reason: url
        ? "Grok endpoint configured"
        : "set KELI_FIXTURE_GROK / KELI_PROVIDER_URL or keli auth add grok",
      howToConfigure: "keli auth add grok  (run override only; cannot be a durable rule)",
    });
  },
  roundTrip: (ctx) => openAiModelsRoundTrip(ctx, ctx.settings.baseUrl ?? ctx.fixtureUrl ?? "https://api.x.ai/v1"),
};

registerIntegration(grokProfile);
