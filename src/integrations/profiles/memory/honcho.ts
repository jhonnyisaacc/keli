import { fixtureEnabled } from "../../env.ts";
import { registerIntegration } from "../../registry.ts";
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
    const enabled = fixtureEnabled("honcho") || Boolean(ctx.credentialRef);
    const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
    return statusOf({
      id: "honcho",
      kind: "memory",
      displayName: "Honcho",
      configured: Boolean(enabled && url),
      credentialState: ctx.credentialRef ? "resolvable" : "n/a",
      reachable: Boolean(url),
      reason: enabled && url ? "Honcho configured" : "optional; set memory.provider=honcho",
      howToConfigure: "keli config set memory.provider honcho && keli auth add honcho",
    });
  },
};

registerIntegration(honchoProfile);
