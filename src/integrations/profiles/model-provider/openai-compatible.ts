import { registerIntegration } from "../../registry.ts";
import { openAiModelsRoundTrip } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const openaiCompatibleProfile: IntegrationProfile = {
  id: "openai-compatible",
  kind: "model-provider",
  displayName: "OpenAI-compatible",
  aliases: ["openai"],
  auth: { type: "api-key" },
  settings: [
    { key: "baseUrl", label: "Base URL", required: true },
    { key: "api-key", label: "API key", secret: true, required: true },
    { key: "model", label: "Default model" },
  ],
  fixtureKey: "provider",
  apiMode: "chat-completions",
  reuse: {
    upstream: "OpenAI Chat Completions",
    pin: "protocol",
    license: "n/a",
    prdIds: ["I8"],
  },
  async probe(ctx) {
    const url = ctx.settings.baseUrl ?? ctx.fixtureUrl;
    const cred = ctx.needsReauth ? "needs-reauth" : ctx.credentialRef ? "resolvable" : url ? "n/a" : "missing";
    return statusOf({
      id: "openai-compatible",
      kind: "model-provider",
      displayName: "OpenAI-compatible",
      configured: Boolean(url),
      credentialState: cred,
      reachable: Boolean(url),
      reason: url ? "endpoint configured" : "set base URL and API key",
      howToConfigure: "keli auth add openai-compatible  or  keli setup provider",
    });
  },
  roundTrip: (ctx) => openAiModelsRoundTrip(ctx),
};

registerIntegration(openaiCompatibleProfile);
