/**
 * Injectable provider/integration setup flows. Wizard IO is a seam; persistence goes
 * through Keli's credential store and config. Nothing here writes canonical behavior
 * state or bypasses CapabilityGate.
 */
import { addCredential } from "../integrations/auth.ts";
import { KeliError } from "../core/errors.ts";
import { defaultCredentialSource, type CredentialRef, type CredentialSource } from "../credentials/source.ts";
import { clearLiveCheck, runLiveProbe } from "../integrations/live-probe.ts";
import { getIntegration } from "../integrations/registry.ts";
import {
  authFlowType,
  defaultBaseUrl,
  defaultModelFor,
  discoverModels,
  isKeylessProvider,
  isLoopbackUrl,
  normalizeModelId,
  requiresBaseUrlPrompt,
  suggestedModels,
  type AuthFlowType,
} from "../integrations/provider-behavior.ts";
import type { RoundTripResult } from "../integrations/types.ts";
import { readConfig, writeConfig, type KeliConfig } from "../state/config.ts";
import type { WizardIo } from "./io.ts";

export type SetupFlowOk = {
  ok: true;
  cancelled?: false;
  integrationId: string;
  settings: Record<string, string>;
  credentialRef?: CredentialRef;
  probe: RoundTripResult;
};

export type SetupFlowFail = {
  ok: false;
  cancelled: boolean;
  error: KeliError;
  integrationId: string;
};

export type SetupFlowResult = SetupFlowOk | SetupFlowFail;

export type AuthFlowInput = {
  integrationId: string;
  stateDir: string;
  config: KeliConfig;
  type?: AuthFlowType;
  value?: string;
  io?: Pick<WizardIo, "println" | "question" | "secret">;
  source?: CredentialSource;
  oauthCallbacks?: import("@mariozechner/pi-ai/oauth").OAuthLoginCallbacks;
  signal?: AbortSignal;
  retryOnCancel?: boolean;
  /** Test/injectable login; production uses `addCredential`. */
  login?: () => Promise<CredentialRef>;
};

export function cancelledResult(integrationId: string, message = "Setup cancelled"): SetupFlowFail {
  return {
    ok: false,
    cancelled: true,
    integrationId,
    error: new KeliError(message, "cancelled"),
  };
}

export function failedResult(integrationId: string, error: unknown): SetupFlowFail {
  if (error instanceof KeliError && error.code === "cancelled") {
    return cancelledResult(integrationId, error.message);
  }
  const aborted =
    (error instanceof Error && (error.name === "AbortError" || /cancel/i.test(error.message))) ||
    (typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError");
  if (aborted) {
    return cancelledResult(integrationId, error instanceof Error ? error.message : "Setup cancelled");
  }
  const keli =
    error instanceof KeliError
      ? error
      : new KeliError(error instanceof Error ? error.message : String(error), "invalid_request");
  return { ok: false, cancelled: keli.code === "cancelled", integrationId, error: keli };
}

export async function persistIntegration(options: {
  config: KeliConfig;
  stateDir: string;
  id: string;
  settings?: Record<string, string>;
  credentialRef?: CredentialRef;
  enabled?: boolean;
}): Promise<void> {
  const previous = options.config.integrations?.[options.id];
  const settings = { ...previous?.settings, ...options.settings };
  const entry = {
    enabled: options.enabled ?? true,
    settings,
    credentialRef: options.credentialRef ?? previous?.credentialRef,
    status: { ...previous?.status, needsReauth: false, lastProbe: new Date().toISOString() },
  };
  options.config.integrations = { ...options.config.integrations, [options.id]: entry };
  if (options.id === "mcp") persistMcpServers(options.config, settings);
  await writeConfig(options.config, options.stateDir);
  const reloaded = await readConfig(options.stateDir);
  if (reloaded?.integrations?.[options.id]) {
    options.config.integrations[options.id] = reloaded.integrations[options.id]!;
  }
  if (options.id === "mcp" && reloaded?.mcp) options.config.mcp = reloaded.mcp;
}

function persistMcpServers(config: KeliConfig, settings: Record<string, string>): void {
  if (!settings.url && !settings.command) return;
  const previousServers = config.mcp?.servers ?? [];
  const stdio = settings.transport === "stdio" || (Boolean(settings.command) && !settings.url);
  const nextServer = stdio
    ? {
        id: previousServers.find((s) => s.command === settings.command)?.id ?? previousServers[0]?.id ?? "mcp",
        transport: "stdio" as const,
        command: settings.command,
        args: previousServers.find((s) => s.command === settings.command)?.args ?? previousServers[0]?.args,
        envRefs: previousServers.find((s) => s.command === settings.command)?.envRefs ?? previousServers[0]?.envRefs,
      }
    : {
        id: previousServers.find((s) => s.url === settings.url)?.id ?? previousServers[0]?.id ?? "mcp",
        transport: "http" as const,
        url: settings.url,
        envRefs: previousServers.find((s) => s.url === settings.url)?.envRefs ?? previousServers[0]?.envRefs,
      };
  const remaining = previousServers.filter((s) => s.id !== nextServer.id);
  config.mcp = { ...config.mcp, servers: [nextServer, ...remaining] };
}

async function boundedProbe(config: KeliConfig, id: string, source?: CredentialSource): Promise<RoundTripResult> {
  const probe = await runLiveProbe({
    config,
    only: [id],
    timeoutMs: id === "chatgpt" ? 30_000 : 8000,
    credentials: source,
  });
  const line = probe.lines.find((l) => l.id === id);
  if (line?.outcome === "pass") return { ok: true, detail: line.detail, latencyMs: line.latencyMs };
  return {
    ok: false,
    detail: line?.detail ?? "probe failed",
    failure: /auth/i.test(line?.detail ?? "") ? "auth" : "transport",
  };
}

export async function runApiKeyAuth(input: AuthFlowInput): Promise<SetupFlowResult> {
  const id = input.integrationId;
  try {
    let value = input.value;
    if (!value && input.io) {
      value = await input.io.secret(`Credential for ${getIntegration(id)?.displayName ?? id} (hidden; empty cancels): `);
    }
    if (!value) return cancelledResult(id, "API key entry cancelled");
    const ref = await addCredential(id, {
      stateDir: input.stateDir,
      type: input.type === "token" ? "token" : "api-key",
      value,
      source: input.source,
    });
    await syncAfterAuth(input, ref);
    const probe = await boundedProbe(input.config, id, input.source);
    return { ok: true, integrationId: id, settings: input.config.integrations?.[id]?.settings ?? {}, credentialRef: ref, probe };
  } catch (error) {
    return failedResult(id, error);
  }
}

export async function runOAuthAuth(input: AuthFlowInput): Promise<SetupFlowResult> {
  const id = input.integrationId;
  const attempt = async (): Promise<SetupFlowResult> => {
    try {
      const ref = input.login
        ? await input.login()
        : await addCredential(id, {
            stateDir: input.stateDir,
            type: "oauth-device",
            source: input.source,
            oauthCallbacks: input.oauthCallbacks ?? oauthIoCallbacks(input.io, input.signal),
          });
      await syncAfterAuth(input, ref);
      const probe = await boundedProbe(input.config, id, input.source);
      return { ok: true, integrationId: id, settings: input.config.integrations?.[id]?.settings ?? {}, credentialRef: ref, probe };
    } catch (error) {
      return failedResult(id, error);
    }
  };
  let result = await attempt();
  while (!result.ok && result.cancelled && input.retryOnCancel !== false && input.io) {
    const again = (await input.io.question("Login cancelled. Retry? [y/N]: ")).toLowerCase();
    if (!again.startsWith("y")) return result;
    result = await attempt();
  }
  return result;
}

export async function runExternalCliAuth(input: AuthFlowInput): Promise<SetupFlowResult> {
  const id = input.integrationId;
  try {
    const ref = await addCredential(id, {
      stateDir: input.stateDir,
      type: "external-cli",
      source: input.source,
    });
    await syncAfterAuth(input, ref);
    const probe = await boundedProbe(input.config, id, input.source);
    return { ok: true, integrationId: id, settings: input.config.integrations?.[id]?.settings ?? {}, credentialRef: ref, probe };
  } catch (error) {
    return failedResult(id, error);
  }
}

export async function runKeylessAuth(input: AuthFlowInput): Promise<SetupFlowResult> {
  const id = input.integrationId;
  try {
    await persistIntegration({ config: input.config, stateDir: input.stateDir, id, settings: { keyless: "true" } });
    const probe = await boundedProbe(input.config, id, input.source);
    return { ok: true, integrationId: id, settings: input.config.integrations?.[id]?.settings ?? {}, probe };
  } catch (error) {
    return failedResult(id, error);
  }
}

export async function authenticateIntegration(input: AuthFlowInput): Promise<SetupFlowResult> {
  const type = input.type ?? authFlowType(input.integrationId);
  if (input.config.integrations?.[input.integrationId]?.credentialRef && type !== "keyless") {
    const probe = await boundedProbe(input.config, input.integrationId, input.source);
    return {
      ok: true,
      integrationId: input.integrationId,
      settings: input.config.integrations[input.integrationId]?.settings ?? {},
      credentialRef: input.config.integrations[input.integrationId]?.credentialRef,
      probe,
    };
  }
  if (type === "oauth-device") return runOAuthAuth(input);
  if (type === "external-cli") return runExternalCliAuth(input);
  if (type === "keyless") return runKeylessAuth({ ...input, type: "keyless" });
  return runApiKeyAuth(input);
}

export type ModelSetupInput = {
  integrationId: string;
  stateDir: string;
  config: KeliConfig;
  io?: Pick<WizardIo, "println" | "question">;
  advanced?: boolean;
  model?: string;
  baseUrl?: string;
  credential?: string;
  fallbackId?: string;
  fallbackModel?: string;
};

export async function configureModel(input: ModelSetupInput): Promise<SetupFlowResult> {
  const id = input.integrationId;
  const profile = getIntegration(id);
  if (!profile) return failedResult(id, new KeliError(`Unknown integration '${id}'`, "capability_unavailable"));
  try {
    const settings = { ...(input.config.integrations?.[id]?.settings ?? {}) };
    let baseUrl = input.baseUrl ?? settings.baseUrl ?? defaultBaseUrl(id, settings);
    if (input.advanced && input.io && !input.baseUrl) {
      const typed = await input.io.question(`Base URL [${baseUrl ?? ""}]: `);
      if (typed) baseUrl = typed;
    } else if (!baseUrl && requiresBaseUrlPrompt(id) && input.io) {
      const typed = await input.io.question("Base URL: ");
      if (typed) baseUrl = typed;
    }
    if (!baseUrl && requiresBaseUrlPrompt(id)) {
      return failedResult(id, new KeliError(`${profile.displayName} needs a base URL`, "invalid_request"));
    }
    if (baseUrl) settings.baseUrl = baseUrl;

    const keyless = isKeylessProvider(id) || settings.keyless === "true" || (baseUrl ? isLoopbackUrl(baseUrl) && !input.config.integrations?.[id]?.credentialRef : false);
    if (keyless) settings.keyless = "true";

    let model = input.model ? normalizeModelId(id, input.model) : undefined;
    const discovered = shouldDiscoverModels(id, baseUrl)
      ? await discoverModels({
          baseUrl: baseUrl!,
          credential: input.credential,
          timeoutMs: 8000,
        }).catch(() => [] as string[])
      : [];
    const fallbackDefault = defaultModelFor(id);
    const safeDefault = model ?? settings.model ?? discovered[0] ?? fallbackDefault;
    if (input.advanced && input.io) {
      const suggestions = [...new Set([...discovered, ...suggestedModels(id)])].slice(0, 12);
      if (suggestions.length) input.io.println(`Suggested models: ${suggestions.join(", ")}`);
      const typed = await input.io.question(`Model [${safeDefault ?? "required"}] (custom id allowed): `);
      model = normalizeModelId(id, typed || safeDefault || "");
    } else {
      model = normalizeModelId(id, safeDefault);
      if (model && input.io) input.io.println(`Using default model ${model}. Advanced endpoint/model: keli setup advanced`);
    }
    if (!model) {
      if (input.io) {
        const typed = await input.io.question("Model id (required; this provider has no safe default): ");
        model = normalizeModelId(id, typed);
      }
    }
    if (!model) return failedResult(id, new KeliError(`${profile.displayName} needs a model`, "invalid_request"));
    settings.model = model;
    if (settings.baseUrl && settings.model) clearLiveCheck(input.config, id);

    await persistIntegration({ config: input.config, stateDir: input.stateDir, id, settings });
    input.config.providers = {
      ...input.config.providers,
      primary: { id, model },
      fallback: input.fallbackId
        ? [{ id: input.fallbackId, model: input.fallbackModel }]
        : input.config.providers?.fallback,
    };
    input.config.primaryModel = id;
    if (input.fallbackId) input.config.fallbackModel = input.fallbackId;
    await writeConfig(input.config, input.stateDir);

    const probe = await boundedProbe(input.config, id, input.credential ? memorySource(input.credential) : undefined);
    if (probe.ok) {
      input.config.setup = {
        ...input.config.setup,
        providerConnected: true,
        providerDetail: probe.detail,
        liveChecked: {
          ...input.config.setup?.liveChecked,
          [id]: { at: new Date().toISOString(), model },
        },
      };
      await writeConfig(input.config, input.stateDir);
    }
    return {
      ok: true,
      integrationId: id,
      settings,
      credentialRef: input.config.integrations?.[id]?.credentialRef,
      probe,
    };
  } catch (error) {
    return failedResult(id, error);
  }
}

export async function connectIntegration(options: {
  integrationId: string;
  stateDir: string;
  config: KeliConfig;
  io?: WizardIo;
  advanced?: boolean;
  values?: Record<string, string>;
  source?: CredentialSource;
  oauthCallbacks?: AuthFlowInput["oauthCallbacks"];
}): Promise<SetupFlowResult> {
  const id = options.integrationId;
  const profile = getIntegration(id);
  if (!profile) return failedResult(id, new KeliError(`Unknown integration '${id}'`, "capability_unavailable"));
  try {
    const settings = { ...(options.config.integrations?.[id]?.settings ?? {}) };
    for (const spec of profile.settings.filter((s) => !s.secret)) {
      const current = options.values?.[spec.key] ?? settings[spec.key] ?? spec.default ?? (spec.key === "baseUrl" ? profile.baseUrl : "") ?? "";
      const ask = options.advanced || spec.required || spec.key === "url" || spec.key === "command" || spec.key === "bin";
      let value = options.values?.[spec.key];
      if (value === undefined && ask && options.io) {
        value = (await options.io.question(`${spec.label} [${current}]: `)) || current;
      } else if (value === undefined) {
        value = current;
      }
      if (!value && spec.required) {
        return failedResult(id, new KeliError(`${spec.label} is required for ${profile.displayName}`, "invalid_request"));
      }
      if (value) settings[spec.key] = value;
    }
    await persistIntegration({ config: options.config, stateDir: options.stateDir, id, settings });
    const type = authFlowType(id);
    if (profile.kind === "model-provider") {
      const auth = await authenticateIntegration({
        integrationId: id,
        stateDir: options.stateDir,
        config: options.config,
        io: options.io,
        source: options.source,
        oauthCallbacks: options.oauthCallbacks,
        value: options.values?.["api-key"] ?? options.values?.token,
      });
      if (!auth.ok) return auth;
      return configureModel({
        integrationId: id,
        stateDir: options.stateDir,
        config: options.config,
        io: options.io,
        advanced: options.advanced,
        model: options.values?.model,
        baseUrl: settings.baseUrl,
      });
    }
    const secretRequired = profile.settings.some((spec) => spec.secret && spec.required);
    const providedSecret = options.values?.["api-key"] ?? options.values?.token;
    if (profile.auth.type === "external-cli") {
      await persistIntegration({
        config: options.config,
        stateDir: options.stateDir,
        id,
        settings,
        credentialRef: { id: "external-cli", service: `keli/${id}` },
      });
    } else if (type !== "keyless" && profile.auth.type !== "none" && (secretRequired || providedSecret || type === "oauth-device" || type === "token")) {
      const auth = await authenticateIntegration({
        integrationId: id,
        stateDir: options.stateDir,
        config: options.config,
        io: options.io,
        source: options.source,
        oauthCallbacks: options.oauthCallbacks,
        value: providedSecret,
      });
      if (!auth.ok && !auth.cancelled) return auth;
    }
    const probe = await boundedProbe(options.config, id, options.source);
    options.io?.println(probe.ok ? `Connected: ${probe.detail}` : `Not connected: ${probe.detail}`);
    return {
      ok: true,
      integrationId: id,
      settings: options.config.integrations?.[id]?.settings ?? settings,
      credentialRef: options.config.integrations?.[id]?.credentialRef,
      probe,
    };
  } catch (error) {
    return failedResult(id, error);
  }
}

async function syncAfterAuth(input: AuthFlowInput, ref: CredentialRef): Promise<void> {
  await persistIntegration({
    config: input.config,
    stateDir: input.stateDir,
    id: input.integrationId,
    credentialRef: ref,
  });
}

function shouldDiscoverModels(id: string, baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  if (isLoopbackUrl(baseUrl)) return true;
  return id === "custom" || id === "lmstudio" || id === "openai-compatible";
}

function oauthIoCallbacks(
  io: AuthFlowInput["io"],
  signal?: AbortSignal,
): import("@mariozechner/pi-ai/oauth").OAuthLoginCallbacks | undefined {
  if (!io) return signal ? { onAuth: () => {}, onPrompt: async () => "", signal } : undefined;
  return {
    signal,
    onAuth: ({ url, instructions }) => {
      io.println(`Sign in: ${url}`);
      if (instructions) io.println(instructions);
    },
    onPrompt: ({ message }) => io.question(message),
  };
}

function memorySource(value: string): CredentialSource {
  return {
    name: "inline",
    available: true,
    async get() {
      return value;
    },
  };
}

export { defaultCredentialSource };
