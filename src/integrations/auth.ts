import { KeliError } from "../core/errors.ts";
import {
  credentialService,
  defaultCredentialSource,
  type CredentialRef,
  type CredentialSource,
} from "../credentials/source.ts";
import { readConfig, writeConfig, upsertIntegration } from "../state/config.ts";
import { getIntegration } from "./registry.ts";
import type { AuthType, CredentialState } from "./types.ts";

export type AuthFlowKind = Exclude<AuthType, "none">;

export type AuthAddOptions = {
  stateDir?: string;
  type?: AuthFlowKind;
  value?: string;
  settingKey?: string;
  source?: CredentialSource;
  oauthCallbacks?: import("@mariozechner/pi-ai/oauth").OAuthLoginCallbacks;
};

export async function addCredential(integrationId: string, options: AuthAddOptions = {}): Promise<CredentialRef> {
  const profile = getIntegration(integrationId);
  if (!profile) {
    throw new KeliError(
      `Unknown integration '${integrationId}'. Run: keli integrations discover ${integrationId}`,
      "capability_unavailable",
    );
  }
  const type = options.type ?? (profile.auth.type === "none" ? "api-key" : profile.auth.type);
  if (profile.id === "chatgpt") {
    const { codexAccessToken, loginChatGpt, CHATGPT_CODEX_REF } = await import("./chatgpt-auth.ts");
    if (options.value || (type !== "oauth-device" && type !== "external-cli")) throw new KeliError("ChatGPT uses account login, not an API key", "invalid_request");
    let ref: CredentialRef;
    if (type === "external-cli") { await codexAccessToken(); ref = CHATGPT_CODEX_REF; }
    else {
      if (!options.oauthCallbacks) throw new KeliError("Run keli auth add chatgpt interactively, or --type external-cli to link your existing Codex login", "invalid_request");
      ref = await loginChatGpt(options.oauthCallbacks, options.source);
    }
    const config = await readConfig(options.stateDir);
    if (config?.ownerId) await upsertIntegration(profile.id, { enabled: true, settings: config.integrations?.chatgpt?.settings ?? {}, credentialRef: ref, status: { needsReauth: false } }, options.stateDir);
    return ref;
  }
  if (type === "oauth-device") {
    if (profile.id === "codex") {
      return { id: "external-cli", service: credentialService(profile.id) };
    }
    throw new KeliError(
      `OAuth/device flow for '${profile.id}' is not implemented as a Keli conversation provider.`,
      "invalid_request",
    );
  }
  if (type === "external-cli") {
    return { id: "external-cli", service: credentialService(profile.id) };
  }
  if (!options.value) {
    throw new KeliError("Credential value required for api-key/token auth", "invalid_request");
  }

  const source = options.source ?? defaultCredentialSource();
  const settingKey = options.settingKey ?? secretSettingKey(profile.id) ?? "api-key";
  const ref: CredentialRef = { id: settingKey, service: credentialService(profile.id) };
  if (!source.set) {
    throw new KeliError("Credential store cannot write", "secret_unavailable");
  }
  await source.set(ref, options.value);

  const config = (await readConfig(options.stateDir)) ?? undefined;
  if (config?.ownerId) {
    await upsertIntegration(
      profile.id,
      {
        enabled: true,
        settings: config.integrations?.[profile.id]?.settings ?? {},
        credentialRef: ref,
        status: { needsReauth: false, lastProbe: new Date().toISOString() },
      },
      options.stateDir,
    );
  }
  return ref;
}

export async function removeCredential(
  integrationId: string,
  options: { stateDir?: string; source?: CredentialSource } = {},
): Promise<void> {
  const profile = getIntegration(integrationId);
  if (!profile) {
    throw new KeliError(`Unknown integration '${integrationId}'`, "capability_unavailable");
  }
  const config = await readConfig(options.stateDir);
  const ref = config?.integrations?.[profile.id]?.credentialRef;
  const source = options.source ?? defaultCredentialSource();
  if (ref && source.delete && !(profile.id === "chatgpt" && ref.id === "codex-cli")) {
    try {
      await source.delete(ref);
    } catch {
      // still clear the config ref
    }
  }
  if (config?.ownerId) {
    await upsertIntegration(
      profile.id,
      {
        enabled: config.integrations?.[profile.id]?.enabled ?? false,
        settings: config.integrations?.[profile.id]?.settings ?? {},
        credentialRef: undefined,
        status: { needsReauth: false },
      },
      options.stateDir,
    );
  }
}

export async function credentialStatus(
  integrationId: string,
  options: { stateDir?: string; source?: CredentialSource } = {},
): Promise<CredentialState> {
  const profile = getIntegration(integrationId);
  if (!profile) return "missing";
  if (profile.auth.type === "none") return "n/a";
  if (profile.auth.type === "external-cli") return "n/a";

  const config = await readConfig(options.stateDir);
  if (config?.integrations?.[profile.id]?.status?.needsReauth) return "needs-reauth";
  const ref = config?.integrations?.[profile.id]?.credentialRef;
  if (!ref) return "missing";
  if (profile.id === "chatgpt") {
    try { const { chatGptAccessToken } = await import("./chatgpt-auth.ts"); await chatGptAccessToken(ref, options.source); return "resolvable"; }
    catch { return "needs-reauth"; }
  }

  const source = options.source ?? defaultCredentialSource();
  if (!source.available) return "locked";
  try {
    const value = await source.get(ref);
    return value ? "resolvable" : "missing";
  } catch (e) {
    if (e instanceof KeliError && e.code === "secret_unavailable") return "locked";
    return "missing";
  }
}

export async function markNeedsReauth(integrationId: string, stateDir?: string): Promise<void> {
  const config = await readConfig(stateDir);
  if (!config?.ownerId) return;
  const existing = config.integrations?.[integrationId];
  await upsertIntegration(
    integrationId,
    {
      enabled: existing?.enabled ?? true,
      settings: existing?.settings ?? {},
      credentialRef: existing?.credentialRef,
      status: { ...existing?.status, needsReauth: true, lastProbe: new Date().toISOString() },
    },
    stateDir,
  );
}

function secretSettingKey(integrationId: string): string | undefined {
  const profile = getIntegration(integrationId);
  return profile?.settings.find((s) => s.secret)?.key;
}
