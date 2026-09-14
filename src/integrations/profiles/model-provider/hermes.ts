import { registerIntegration } from "../../registry.ts";
import { statusOf } from "../../status.ts";
import { hermesCatalog, HERMES_PIN, catalogModels, catalogEnvironment, catalogEndpoint, createCatalogProvider } from "../../catalog-provider.ts";
import type { IntegrationProfile } from "../../types.ts";

for (const row of hermesCatalog) {
  // These existing names retain their Keli meaning. ACP is an agent, not an inference API.
  if (["openai-codex", "grok", "copilot-acp", "moa"].includes(row.name)) continue;
  const id = row.name;
  const cloud = ["bedrock", "vertex"].includes(id);
  const keyless = ["custom", "lmstudio", "opencode-free"].includes(id);
  const oauth = ["copilot", "nous", "minimax-oauth", "xai-oauth", "qwen-oauth"].includes(id);
  const profile: IntegrationProfile = {
    id, kind: "model-provider", displayName: row.display_name ?? id,
    aliases: (row.aliases ?? []).filter((a) => !["codex", "opencode", "claude-code", "grok", "openai"].includes(a)),
    auth: { type: keyless ? "none" : cloud ? "external-cli" : oauth ? "oauth-device" : "api-key" },
    settings: [{ key: "baseUrl", label: "Base URL", required: !row.base_url }, { key: "model", label: "Model" },
      ...(!cloud && !keyless && !oauth ? [{ key: "api-key", label: "API key", secret: true, required: true }] : []),
      ...(id === "bedrock" ? [{ key: "region", label: "AWS region" }, { key: "profile", label: "AWS profile" }] : []),
      ...(id === "vertex" ? [{ key: "project", label: "Google Cloud project", required: true }, { key: "location", label: "Google Cloud location", required: true }] : []),
      ...(id === "azure-foundry" ? [{ key: "deployment", label: "Deployment" }, { key: "apiMode", label: "Protocol (responses or anthropic-messages)" }, { key: "apiVersion", label: "API version" }] : [])],
    baseUrl: row.base_url || undefined, defaultModels: catalogModels(id), availability: "bundled",
    reuse: { upstream: "NousResearch/hermes-agent provider profiles; @mariozechner/pi-ai", pin: `${HERMES_PIN}; pi-ai@0.73.1`, license: "MIT", prdIds: ["I8", "A05", "A25", "A35"] },
    async probe(ctx) {
      const connected = Boolean(ctx.credentialRef || catalogEnvironment(id) || keyless || cloud);
      return statusOf({ id, kind: "model-provider", displayName: profile.displayName,
        configured: connected && Boolean(catalogEndpoint(id, ctx.settings)), credentialState: ctx.needsReauth ? "needs-reauth" : cloud || keyless ? "n/a" : connected ? "resolvable" : "missing",
        reason: "Connection configuration only; live inference not yet verified", howToConfigure: `keli setup provider (${id})` });
    },
    async roundTrip(ctx) {
      const start = performance.now();
      const model = ctx.settings.model ?? profile.defaultModels?.[0];
      if (!model) return { ok: false, detail: "Select a model before testing inference", failure: "not-configured" };
      const provider = await createCatalogProvider({ profile, settings: ctx.settings, credentialRef: ctx.credentialRef ?? null, source: "config" }, model, ctx.credentialSource ?? (ctx.credential ? { name: "probe", available: true, get: async () => ctx.credential! } : undefined));
      const result = await provider.complete([{ role: "user", content: 'Reply with exactly {"connected":true}' }], { responseFormat: "json_object", maxTokens: 128, timeoutMs: ctx.timeoutMs ?? 30_000 });
      let ok = false;
      try { ok = !result.error && JSON.parse(result.content!).connected === true; } catch { /* malformed */ }
      return { ok, detail: ok ? "Model completed an inference request" : result.error ?? "Unexpected response", failure: ok ? undefined : "invalid", latencyMs: Math.round(performance.now() - start) };
    },
  };
  registerIntegration(profile);
}
