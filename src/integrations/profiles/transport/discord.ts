import { registerIntegration } from "../../registry.ts";
import { httpRoundTrip, notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const DISCORD_API_BASE = "https://discord.com/api/v10";

export const discordProfile: IntegrationProfile = {
  id: "discord",
  kind: "transport",
  displayName: "Discord",
  aliases: ["discord.js"],
  auth: { type: "token" },
  settings: [
    { key: "channelId", label: "Channel id", required: true },
    { key: "threadId", label: "Thread id" },
    { key: "token", label: "Bot token", secret: true },
    { key: "baseUrl", label: "API base (fixture or REST)", default: DISCORD_API_BASE },
  ],
  fixtureKey: "discord",
  reuse: {
    upstream: "Discord REST API v10 (no gateway dependency)",
    pin: "protocol",
    license: "n/a",
    prdIds: ["A17", "A18"],
  },
  async probe(ctx) {
    const configured = Boolean(ctx.settings.channelId || ctx.fixtureUrl);
    return statusOf({
      id: "discord",
      kind: "transport",
      displayName: "Discord",
      configured,
      credentialState: ctx.needsReauth ? "needs-reauth" : ctx.credentialRef ? "resolvable" : ctx.fixtureUrl ? "n/a" : "missing",
      reachable: Boolean(ctx.fixtureUrl || ctx.credentialRef),
      reason: configured ? "Discord route configured" : "pair a channel in keli setup",
      howToConfigure: "keli setup transport --transport discord --discord-channel <id>; keli auth add discord",
    });
  },
  async roundTrip(ctx) {
    if (ctx.fixtureUrl && !ctx.credential) {
      return httpRoundTrip({ url: `${ctx.fixtureUrl.replace(/\/$/, "")}/page`, timeoutMs: ctx.timeoutMs });
    }
    if (!ctx.credential) return notConfigured("bot token missing (keli auth add discord)");
    const base = ctx.settings.baseUrl ?? DISCORD_API_BASE;
    return httpRoundTrip({
      url: `${base.replace(/\/$/, "")}/users/@me`,
      headers: { Authorization: `Bot ${ctx.credential}` },
      timeoutMs: ctx.timeoutMs,
      accept: (_s, body) => body.includes('"id"'),
    });
  },
};

registerIntegration(discordProfile);
