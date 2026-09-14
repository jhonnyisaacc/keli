import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import { chatGptAccessToken } from "../../chatgpt-auth.ts";
import { ChatGptModelProvider, CHATGPT_DEFAULT_MODEL } from "../../../model/chatgpt-provider.ts";
import type { IntegrationProfile } from "../../types.ts";

export const chatgptProfile: IntegrationProfile = {
  id: "chatgpt", kind: "model-provider", displayName: "ChatGPT account",
  aliases: ["chatgpt-account", "chatgpt-oauth", "openai-codex"],
  auth: { type: "oauth-device" },
  settings: [{ key: "model", label: "Model", default: CHATGPT_DEFAULT_MODEL }],
  defaultModels: [CHATGPT_DEFAULT_MODEL], availability: "bundled",
  baseUrl: "https://chatgpt.com/backend-api/codex",
  reuse: { upstream: "@mariozechner/pi-ai", pin: "0.73.1", license: "MIT", prdIds: ["I8", "A25", "A35"] },
  async probe(ctx) {
    return statusOf({ id: "chatgpt", kind: "model-provider", displayName: "ChatGPT account",
      configured: Boolean(ctx.credentialRef), credentialState: ctx.needsReauth ? "needs-reauth" : ctx.credentialRef ? "resolvable" : "missing",
      reason: "Account connection; run a live probe to verify model access",
      howToConfigure: "keli auth add chatgpt (new login), or keli auth add chatgpt --type external-cli (existing Codex login)" });
  },
  async roundTrip(ctx) {
    const start = performance.now();
    const provider = new ChatGptModelProvider(ctx.settings.model ?? CHATGPT_DEFAULT_MODEL, () => chatGptAccessToken(ctx.credentialRef));
    const result = await provider.complete([{ role: "user", content: 'Reply with exactly: {"connected":true}' }], { responseFormat: "json_object", maxTokens: 128, timeoutMs: ctx.timeoutMs ?? 30_000 });
    let ok = false;
    try { ok = !result.error && JSON.parse(result.content!).connected === true; } catch { /* invalid response */ }
    return { ok, detail: ok ? "ChatGPT account completed a real inference request" : result.error ?? "Unexpected response", failure: ok ? undefined : "auth", latencyMs: Math.round(performance.now() - start) };
  },
};
registerIntegration(chatgptProfile);
