import { readFile, mkdir, writeFile } from "node:fs/promises";
import lockfile from "proper-lockfile";
import { homedir } from "node:os";
import { join } from "node:path";
import { getOAuthProvider, type OAuthCredentials, type OAuthLoginCallbacks } from "@mariozechner/pi-ai/oauth";
import { KeliError } from "../core/errors.ts";
import { defaultCredentialSource, type CredentialRef, type CredentialSource } from "../credentials/source.ts";

export const CHATGPT_OAUTH_REF: CredentialRef = { service: "keli/chatgpt", id: "oauth" };
export const CHATGPT_CODEX_REF: CredentialRef = { service: "keli/chatgpt", id: "codex-cli" };

/** Explicit opt-in to read Codex's access token. Never copy, refresh, or write its refresh token. */
export async function codexAccessToken(authFile = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json")): Promise<string> {
  try {
    const data = JSON.parse(await readFile(authFile, "utf8"));
    const token = data.tokens?.access_token;
    if (typeof token !== "string" || !token) throw new Error();
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now() + 30_000) throw new Error();
    return token;
  } catch {
    throw new KeliError("Codex ChatGPT session is missing or expired. Renew it with codex login, or use keli auth add chatgpt for an independent login.", "secret_unavailable");
  }
}

export async function loginChatGpt(callbacks: OAuthLoginCallbacks, source: CredentialSource = defaultCredentialSource()): Promise<CredentialRef> {
  if (!source.available || !source.set) throw new KeliError("Unlock the OS credential store before signing in. To use an existing Codex login: keli auth add chatgpt --type external-cli", "secret_unavailable");
  const credentials = await getOAuthProvider("openai-codex")!.login(callbacks);
  await source.set(CHATGPT_OAUTH_REF, JSON.stringify(credentials));
  return CHATGPT_OAUTH_REF;
}

/** Refresh only Keli-owned OAuth sessions, with a maintained cross-process lock. */
export async function chatGptAccessToken(ref: CredentialRef | null | undefined, source: CredentialSource = defaultCredentialSource()): Promise<string> {
  if (ref?.service !== "keli/chatgpt") throw new KeliError("Run keli auth add chatgpt first", "secret_unavailable");
  if (ref.id === "codex-cli") return codexAccessToken();
  const read = async (): Promise<OAuthCredentials> => {
    try {
      const data = JSON.parse(await source.get(ref) ?? "null") as OAuthCredentials;
      if (!data?.access || !data.refresh || !Number.isFinite(data.expires)) throw new Error();
      return data;
    } catch { throw new KeliError("ChatGPT session missing. Run keli auth add chatgpt", "secret_unavailable"); }
  };
  let credentials = await read();
  if (credentials.expires > Date.now() + 30_000) return credentials.access;
  if (!source.set) throw new KeliError("Unlock the credential store to refresh ChatGPT", "secret_unavailable");
  const lockDir = process.env.KELI_AUTH_LOCK_DIR ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "keli", "auth-locks");
  await mkdir(lockDir, { recursive: true, mode: 0o700 });
  const target = join(lockDir, "chatgpt");
  await writeFile(target, "", { flag: "a", mode: 0o600 });
  const release = await lockfile.lock(target, { retries: { retries: 20, minTimeout: 100, maxTimeout: 500 }, stale: 60_000 });
  try {
    credentials = await read();
    if (credentials.expires <= Date.now() + 30_000) {
      credentials = await getOAuthProvider("openai-codex")!.refreshToken(credentials);
      await source.set(ref, JSON.stringify(credentials));
    }
    return credentials.access;
  } catch { throw new KeliError("ChatGPT refresh failed. Run keli auth add chatgpt to sign in again", "secret_unavailable"); }
  finally { await release(); }
}
