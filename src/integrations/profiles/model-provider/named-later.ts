import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

function unavailable(id: string, displayName: string, aliases: string[], apiMode: IntegrationProfile["apiMode"]): IntegrationProfile {
  return {
    id,
    kind: "model-provider",
    displayName,
    aliases,
    auth: { type: "api-key" },
    settings: [{ key: "api-key", label: "API key", secret: true }],
    apiMode,
    availability: "named-later",
    reuse: {
      upstream: displayName,
      pin: "unavailable-until-configured",
      license: "n/a",
      prdIds: ["I8"],
    },
    async probe() {
      return statusOf({
        id,
        kind: "model-provider",
        displayName,
        configured: false,
        credentialState: "missing",
        reason: "unavailable until configured and release-pinned",
        howToConfigure: `keli integrations discover ${id}`,
      });
    },
  };
}

export const claudeCodeProfile = unavailable("claude-code", "Claude Code", [], "anthropic-messages");
export const antigravityProfile = unavailable("antigravity", "Antigravity", [], "chat-completions");

registerIntegration(claudeCodeProfile);
registerIntegration(antigravityProfile);
