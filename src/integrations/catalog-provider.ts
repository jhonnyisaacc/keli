import { getModels, type Api, type Model, type KnownProvider } from "@mariozechner/pi-ai";
import data from "./hermes-catalog.json";
import { SdkModelProvider } from "../model/sdk-provider.ts";
import { defaultCredentialSource, type CredentialSource } from "../credentials/source.ts";
import { KeliError } from "../core/errors.ts";
import type { ResolvedIntegration } from "./types.ts";

export const HERMES_PIN = "93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544";
export type CatalogEntry = { name: string; display_name?: string; aliases?: string[]; base_url?: string; env_vars?: string[]; auth_type?: string; api_mode?: string; default_aux_model?: string | null; fallback_models?: string[] };
export const hermesCatalog: CatalogEntry[] = data;
export const catalogEntry = (id: string) => hermesCatalog.find((r) => r.name === id);
const SDK_IDS: Record<string, KnownProvider> = { "openai-api": "openai", grok: "xai", gemini: "google", vertex: "google-vertex", bedrock: "amazon-bedrock", copilot: "github-copilot", "ai-gateway": "vercel-ai-gateway", "opencode-zen": "opencode", "kimi-coding": "moonshotai", "kimi-coding-cn": "moonshotai-cn" };
export function catalogModels(id: string): string[] {
  const row = catalogEntry(id);
  const models = getModels((SDK_IDS[id] ?? id) as KnownProvider).map((m) => m.id);
  return [...new Set([...(row?.default_aux_model ? [row.default_aux_model] : []), ...(row?.fallback_models ?? []), ...models])];
}
export function catalogEnvironment(id: string): string | undefined {
  const prefix = `KELI_${id.toUpperCase().replace(/-/g, "_")}`;
  return [ `${prefix}_API_KEY`, `${prefix}_TOKEN`, ...(catalogEntry(id)?.env_vars ?? []).filter((n) => !n.endsWith("BASE_URL")) ].map((n) => process.env[n]).find(Boolean);
}
export function catalogEndpoint(id: string, settings: Record<string, string>): string | undefined {
  const row = catalogEntry(id);
  return settings.baseUrl || row?.env_vars?.filter((n) => n.endsWith("BASE_URL")).map((n) => process.env[n]).find(Boolean) || row?.base_url || undefined;
}
export function catalogDescriptor(id: string, model: string, settings: Record<string, string> = {}): Model<Api> {
  const row = catalogEntry(id)!;
  const provider = SDK_IDS[id] ?? id;
  const known = getModels(provider as KnownProvider).find((m) => m.id === model);
  let api: Api = row.api_mode === "anthropic_messages" ? "anthropic-messages" : row.api_mode === "codex_responses" ? "openai-responses" : "openai-completions";
  if (id === "gemini") api = "google-generative-ai";
  if (id === "vertex") api = "google-vertex";
  if (id === "bedrock") api = "bedrock-converse-stream";
  if (id === "copilot" && known) api = known.api;
  if (id === "azure-foundry") {
    if (settings.apiMode === "anthropic-messages") api = "anthropic-messages";
    else api = "azure-openai-responses";
  }
  let baseUrl = catalogEndpoint(id, settings) ?? "";
  if (id === "vertex" && baseUrl === "https://aiplatform.googleapis.com") baseUrl = "";
  if (!baseUrl && id !== "vertex") throw new KeliError(`${id} needs a base URL`, "invalid_request");
  return { ...(known ?? { id: model, name: model, reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32768, maxTokens: 4096 }), provider, api, baseUrl, id: model, name: model };
}
export async function createCatalogProvider(resolved: ResolvedIntegration, model: string, credentials: CredentialSource = defaultCredentialSource()): Promise<SdkModelProvider> {
  const { profile, settings, credentialRef } = resolved;
  let descriptor = catalogDescriptor(profile.id, model, settings);
  const key = async () => {
    if (credentialRef?.id === "oauth") {
      const { providerOAuthSession } = await import("./provider-oauth.ts");
      const session = await providerOAuthSession(profile.id, credentialRef, credentials);
      return session.provider.getApiKey(session.credentials);
    }
    if (credentialRef?.id === "qwen-cli") {
      const { qwenAccessToken } = await import("./provider-oauth.ts"); return qwenAccessToken();
    }
    if (credentialRef) {
      const value = await credentials.get(credentialRef);
      if (!value) throw new KeliError(`Credential missing for ${profile.id}`, "secret_unavailable");
      return value;
    }
    const value = catalogEnvironment(profile.id);
    if (!value && !["none", "external-cli"].includes(profile.auth.type)) throw new KeliError(`Run keli auth add ${profile.id}`, "secret_unavailable");
    return value ?? (profile.auth.type === "none" ? "keli-keyless" : undefined);
  };
  if (credentialRef?.id === "oauth") {
    const { providerOAuthSession } = await import("./provider-oauth.ts");
    const session = await providerOAuthSession(profile.id, credentialRef, credentials);
    descriptor = session.provider.modifyModels?.([descriptor], session.credentials)[0] ?? descriptor;
  }
  const initialKey = await key();
  if (profile.id === "kimi-coding" && initialKey?.startsWith("sk-kimi-") && descriptor.baseUrl === "https://api.moonshot.ai/v1") {
    descriptor = { ...descriptor, baseUrl: "https://api.kimi.com/coding/v1", headers: { ...descriptor.headers, "User-Agent": "Keli/0.1.0" } };
  }
  const transportOptions = { project: settings.project, location: settings.location, region: settings.region, profile: settings.profile, azureBaseUrl: settings.baseUrl, azureDeploymentName: settings.deployment ?? model, azureApiVersion: settings.apiVersion };
  return new SdkModelProvider(descriptor, key, undefined, transportOptions);
}
