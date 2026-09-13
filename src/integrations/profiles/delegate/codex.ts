import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const codexProfile: IntegrationProfile = {
  id: "codex",
  kind: "delegate",
  displayName: "Codex CLI",
  aliases: ["openai-codex"],
  auth: { type: "external-cli" },
  settings: [{ key: "command", label: "CLI binary", default: "codex" }],
  fixtureKey: "delegate",
  apiMode: "acp",
  reuse: {
    upstream: "ACP + Codex CLI",
    pin: "not-wired",
    license: "Apache-2.0",
    prdIds: ["A19", "A20", "A37"],
  },
  async probe(ctx) {
    return statusOf({
      id: "codex",
      kind: "delegate",
      displayName: "Codex CLI",
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

registerIntegration(codexProfile);
