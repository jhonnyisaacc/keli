import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const opencodeProfile: IntegrationProfile = {
  id: "opencode",
  kind: "delegate",
  displayName: "OpenCode CLI",
  aliases: ["open-code"],
  auth: { type: "external-cli" },
  settings: [{ key: "command", label: "CLI binary", default: "opencode" }],
  fixtureKey: "delegate",
  apiMode: "acp",
  reuse: {
    upstream: "ACP + OpenCode CLI",
    pin: "not-wired",
    license: "Apache-2.0",
    prdIds: ["A19", "A20", "A37"],
  },
  async probe(ctx) {
    return statusOf({
      id: "opencode",
      kind: "delegate",
      displayName: "OpenCode CLI",
      configured: Boolean(ctx.fixtureUrl),
      credentialState: "n/a",
      reachable: Boolean(ctx.fixtureUrl),
      reason: ctx.fixtureUrl
        ? "delegate fixture configured"
        : "requires ACP handshake or KELI_FIXTURE_DELEGATE",
      howToConfigure: "keli setup delegate  (external-cli probe) or set KELI_DELEGATE_FIXTURE_URL",
    });
  },
};

registerIntegration(opencodeProfile);
