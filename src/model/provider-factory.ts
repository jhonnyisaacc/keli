import { KeliError } from "../core/errors.ts";
import { defaultCredentialSource, type CredentialSource } from "../credentials/source.ts";
import { integrationEndpoint, resolveIntegration } from "../integrations/resolve.ts";
import type { ResolvedIntegration } from "../integrations/types.ts";
import type { KeliConfig } from "../state/config.ts";
import type { ChatModelProvider } from "./chat-provider.ts";
import { HttpModelProvider, unsupportedApiModeReason } from "./http-provider.ts";
import { FixtureModelProvider, type ModelProvider } from "./provider.ts";
import "../integrations/load.ts";

export type CreateProviderOptions = {
  config?: KeliConfig | null;
  explicitId?: string;
  role?: string;
  model?: string;
  credentials?: CredentialSource;
};

export type CreatedProvider = {
  provider: ModelProvider & Partial<ChatModelProvider>;
  providerId: string;
  model: string;
  endpoint: string;
  resolved: ResolvedIntegration;
  /** Pricing is configured for this provider id; otherwise cost stays visibly unknown. */
  costKnown: boolean;
};

export function selectModel(resolved: ResolvedIntegration, requested?: string): string | undefined {
  return (
    requested ??
    resolved.model ??
    resolved.settings.model ??
    resolved.profile.defaultModels?.[0]
  );
}

/**
 * The only place that turns a resolved model-provider integration into a live provider.
 * Saved config, credential references, and configured models all feed this path; fixture
 * env selection stays explicit through the resolver's `source`.
 */
export async function createModelProvider(options: CreateProviderOptions = {}): Promise<CreatedProvider> {
  const resolved = resolveIntegration("model-provider", {
    explicitId: options.explicitId,
    role: options.role,
    config: options.config,
    model: options.model,
  });
  const profile = resolved.profile;
  if (profile.id === "chatgpt") {
    const { ChatGptModelProvider, CHATGPT_DEFAULT_MODEL } = await import("./chatgpt-provider.ts");
    const { chatGptAccessToken } = await import("../integrations/chatgpt-auth.ts");
    const model = selectModel(resolved, options.model) ?? CHATGPT_DEFAULT_MODEL;
    await chatGptAccessToken(resolved.credentialRef, options.credentials);
    return { provider: new ChatGptModelProvider(model, () => chatGptAccessToken(resolved.credentialRef, options.credentials)), providerId: profile.id, model, endpoint: "https://chatgpt.com/backend-api/codex", resolved, costKnown: false };
  }
  const { catalogEntry, createCatalogProvider, catalogEndpoint } = await import("../integrations/catalog-provider.ts");
  if (catalogEntry(profile.id) && profile.reuse.pin !== "config" && !resolved.fixtureUrl) {
    const model = selectModel(resolved, options.model);
    if (!model) throw new KeliError(`${profile.id} needs a model; run keli setup provider`, "invalid_request");
    return { provider: await createCatalogProvider(resolved, model, options.credentials), providerId: profile.id, model,
      endpoint: catalogEndpoint(profile.id, resolved.settings) ?? "", resolved, costKnown: Boolean(options.config?.pricing?.[profile.id]) };
  }
  const endpoint = integrationEndpoint(resolved);
  if (!endpoint) {
    throw new KeliError(
      `${profile.displayName} has no base URL. Run: keli config set integrations.${profile.id}.settings.baseUrl <url>`,
      "capability_unavailable",
    );
  }
  const costKnown = Boolean(options.config?.pricing?.[profile.id]);

  if (profile.id === "fixture") {
    return {
      provider: new FixtureModelProvider(endpoint),
      providerId: profile.id,
      model: selectModel(resolved) ?? "keli-fixture",
      endpoint,
      resolved,
      costKnown,
    };
  }

  const unsupported = unsupportedApiModeReason(profile.apiMode);
  if (unsupported) {
    throw new KeliError(`${profile.displayName}: ${unsupported}`, "capability_unavailable");
  }

  const model = selectModel(resolved, options.model);
  if (!model) {
    throw new KeliError(
      `${profile.displayName} needs a model. Run: keli config set providers.primary.model <name>`,
      "invalid_request",
    );
  }

  let apiKey: string | undefined;
  if (resolved.credentialRef) {
    const source = options.credentials ?? defaultCredentialSource();
    const value = await source.get(resolved.credentialRef);
    if (!value) {
      throw new KeliError(
        `Credential for '${profile.id}' is missing. Run: keli auth add ${profile.id}`,
        "secret_unavailable",
      );
    }
    apiKey = value;
  } else if (profile.auth.type !== "none" && resolved.source !== "fixture-env") {
    const requiresKey = profile.settings.some((s) => s.secret && s.required);
    if (requiresKey) {
      throw new KeliError(
        `${profile.displayName} requires a credential. Run: keli auth add ${profile.id}`,
        "secret_unavailable",
      );
    }
  }

  return {
    provider: new HttpModelProvider(endpoint, model, {
      apiKey,
      apiMode: profile.apiMode,
      providerId: profile.id,
    }),
    providerId: profile.id,
    model,
    endpoint,
    resolved,
    costKnown,
  };
}
