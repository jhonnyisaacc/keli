import { registerIntegration } from "../../registry.ts";
import { notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import { chatgptConversationIncompatibility } from "../../chatgpt-boundary.ts";
import type { IntegrationProfile } from "../../types.ts";

/**
 * Named so setup can discover ChatGPT. Not a conversation provider — see
 * docs/evidence/CODEX_APP_SERVER.md. Availability is explicit incompatibility,
 * not a silent API-key substitute.
 */
export const chatgptProfile: IntegrationProfile = {
  id: "chatgpt",
  kind: "model-provider",
  displayName: "ChatGPT account (Codex App Server)",
  aliases: ["chatgpt-account", "chatgpt-oauth"],
  auth: { type: "oauth-device" },
  settings: [{ key: "command", label: "codex binary", default: "codex" }],
  apiMode: "acp",
  availability: "named-later",
  reuse: {
    upstream: "openai/codex app-server",
    pin: "docs/evidence/CODEX_APP_SERVER.md",
    license: "Apache-2.0",
    prdIds: ["A25", "A35"],
  },
  async probe() {
    return statusOf({
      id: "chatgpt",
      kind: "model-provider",
      displayName: "ChatGPT account (Codex App Server)",
      configured: false,
      credentialState: "missing",
      reachable: false,
      reason: chatgptConversationIncompatibility(),
      howToConfigure: "keli auth add openai-compatible  (conversation). Optional coding delegate: keli auth add codex --type oauth-device",
    });
  },
  async roundTrip() {
    return {
      ...notConfigured("chatgpt is not a Keli conversation provider"),
      failure: "unsupported",
      detail: chatgptConversationIncompatibility(),
    };
  },
};

registerIntegration(chatgptProfile);
