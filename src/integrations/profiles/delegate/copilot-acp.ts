import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const copilotAcpProfile: IntegrationProfile = {
  id: "copilot-acp-delegate",
  kind: "delegate",
  displayName: "GitHub Copilot ACP",
  aliases: ["copilot-acp", "github-copilot-acp"],
  auth: { type: "external-cli" },
  settings: [{ key: "command", label: "ACP command" }],
  fixtureKey: "delegate",
  apiMode: "acp",
  reuse: {
    upstream: "GitHub Copilot ACP agent (delegate only, not Copilot Chat Completions)",
    pin: "not-wired",
    license: "n/a",
    prdIds: ["A19", "A20", "A37"],
  },
  async probe(ctx) {
    return statusOf({
      id: "copilot-acp-delegate",
      kind: "delegate",
      displayName: "GitHub Copilot ACP",
      configured: Boolean(ctx.fixtureUrl),
      credentialState: "n/a",
      reachable: Boolean(ctx.fixtureUrl),
      reason: ctx.fixtureUrl
        ? "delegate fixture configured"
        : "blocked until an ACP login exists; distinct from Copilot inference",
      howToConfigure: "Owner Copilot ACP login is a later milestone. Use keli setup delegate for Codex/OpenCode fixtures.",
    });
  },
};

registerIntegration(copilotAcpProfile);
