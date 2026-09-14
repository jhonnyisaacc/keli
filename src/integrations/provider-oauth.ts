import { readFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import lockfile from "proper-lockfile";
import { getOAuthProvider, type OAuthCredentials, type OAuthLoginCallbacks, type OAuthProviderInterface } from "@mariozechner/pi-ai/oauth";
import { defaultCredentialSource, type CredentialRef, type CredentialSource } from "../credentials/source.ts";
import { KeliError } from "../core/errors.ts";
import { providerDeviceOAuthProvider } from "./provider-device-oauth.ts";

function oauthProvider(id: string): OAuthProviderInterface {
  const provider = getOAuthProvider(id === "copilot" ? "github-copilot" : id) ?? providerDeviceOAuthProvider(id);
  if (!provider) throw new KeliError(`No account login for ${id}`, "invalid_request");
  return provider;
}
export async function loginProvider(id: string, callbacks: OAuthLoginCallbacks, source = defaultCredentialSource()): Promise<CredentialRef> {
  if (!source.available || !source.set) throw new KeliError("Unlock the OS credential store before signing in", "secret_unavailable");
  const ref = { service: `keli/${id}`, id: "oauth" };
  let credentials: OAuthCredentials;
  try { credentials = await oauthProvider(id).login(callbacks); } catch { throw new KeliError(`Login failed or cancelled for ${id}; retry keli auth add ${id}`, "secret_unavailable"); }
  await source.set(ref, JSON.stringify(credentials));
  return ref;
}
export async function providerOAuthSession(id: string, ref: CredentialRef, source: CredentialSource = defaultCredentialSource()) {
  if (ref.service !== `keli/${id}` || ref.id !== "oauth") throw new KeliError("Invalid account reference", "secret_unavailable");
  const provider = oauthProvider(id);
  const read = async (): Promise<OAuthCredentials> => {
    try {
      const data = JSON.parse(await source.get(ref) ?? "null");
      if (typeof data?.access !== "string" || !data.access || typeof data.refresh !== "string" || !data.refresh || !Number.isFinite(data.expires)) throw new Error();
      return data;
    } catch { throw new KeliError(`Account session missing; run keli auth add ${id}`, "secret_unavailable"); }
  };
  let credentials = await read();
  if (credentials.expires > Date.now() + 60_000) return { credentials, provider };
  if (!source.set) throw new KeliError("Unlock the credential store to refresh your account", "secret_unavailable");
  const lockDir = process.env.KELI_AUTH_LOCK_DIR ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "keli", "auth-locks");
  await mkdir(lockDir, { recursive: true, mode: 0o700 });
  const target = join(lockDir, id);
  await writeFile(target, "", { flag: "a", mode: 0o600 });
  const release = await lockfile.lock(target, { retries: { retries: 20, minTimeout: 100, maxTimeout: 500 }, stale: 60_000 });
  try {
    credentials = await read();
    if (credentials.expires <= Date.now() + 60_000) {
      credentials = await provider.refreshToken(credentials);
      await source.set(ref, JSON.stringify(credentials));
    }
    return { credentials, provider };
  } catch { throw new KeliError(`Account refresh failed; run keli auth add ${id}`, "secret_unavailable"); }
  finally { await release(); }
}
/** Explicit read-only link. The CLI that owns the refresh token remains responsible for renewing it. */
export async function qwenAccessToken(path = join(homedir(), ".qwen", "oauth_creds.json")): Promise<string> {
  try {
    const data = JSON.parse(await readFile(path, "utf8"));
    if (typeof data.access_token !== "string" || !data.access_token || !(data.expiry_date > Date.now() + 60_000)) throw new Error();
    return data.access_token;
  } catch { throw new KeliError("Run qwen auth qwen-oauth to sign in or renew the linked Qwen session", "secret_unavailable"); }
}
