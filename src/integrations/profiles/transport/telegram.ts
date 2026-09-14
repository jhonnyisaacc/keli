import { registerIntegration } from "../../registry.ts";
import { httpRoundTrip, notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

export const telegramProfile: IntegrationProfile = {
  id: "telegram",
  kind: "transport",
  displayName: "Telegram",
  aliases: ["grammy"],
  auth: { type: "token" },
  settings: [
    { key: "chatId", label: "Chat id", required: true },
    { key: "topicId", label: "Topic id" },
    { key: "token", label: "Bot token", secret: true },
  ],
  fixtureKey: "telegram",
  reuse: {
    upstream: "Telegram Bot API (getUpdates/sendMessage/getMe)",
    pin: "protocol",
    license: "n/a",
    prdIds: ["A18", "A19"],
  },
  async probe(ctx) {
    const configured = Boolean(ctx.settings.chatId || ctx.fixtureUrl);
    return statusOf({
      id: "telegram",
      kind: "transport",
      displayName: "Telegram",
      configured,
      credentialState: ctx.needsReauth ? "needs-reauth" : ctx.credentialRef ? "resolvable" : ctx.fixtureUrl ? "n/a" : "missing",
      reachable: Boolean(ctx.fixtureUrl),
      reason: configured ? "Telegram route configured" : "pair a chat in keli setup",
      howToConfigure: "keli setup transport --transport telegram --telegram-chat <id>",
    });
  },
  async roundTrip(ctx) {
    if (ctx.fixtureUrl && !ctx.credential) {
      return httpRoundTrip({ url: `${ctx.fixtureUrl.replace(/\/$/, "")}/page`, timeoutMs: ctx.timeoutMs });
    }
    if (!ctx.credential) return notConfigured("bot token missing (keli auth add telegram)");
    return httpRoundTrip({
      url: `https://api.telegram.org/bot${ctx.credential}/getMe`,
      timeoutMs: ctx.timeoutMs,
      accept: (_s, body) => body.includes('"ok":true'),
    });
  },
};

registerIntegration(telegramProfile);
