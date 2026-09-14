/** Adapted from Hermes auth_device_flow.py, auth_nous.py, auth_xai.py and auth_minimax.py.
 * MIT, upstream 93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544; see THIRD_PARTY_NOTICES.
 * Only protocol exchanges are reused. Credentials belong exclusively to Keli's OS store.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { OAuthCredentials, OAuthProviderInterface } from "@mariozechner/pi-ai/oauth";
import { KeliError } from "../core/errors.ts";

type Flow = { client: string; scope: string; device: string; token: string; minimax?: boolean; nous?: boolean };
const FLOWS: Record<string, Flow> = {
  nous: { client: "hermes-cli", scope: "inference:invoke", device: "https://portal.nousresearch.com/api/oauth/device/code", token: "https://portal.nousresearch.com/api/oauth/token", nous: true },
  "xai-oauth": { client: "b1a00492-073a-47ea-816f-4c329264a828", scope: "openid profile email offline_access grok-cli:access api:access", device: "https://auth.x.ai/oauth2/device/code", token: "" },
  "minimax-oauth": { client: "78257093-7e40-4613-99e0-527b14b39113", scope: "group_id profile model.completion", device: "https://api.minimax.io/oauth/code", token: "https://api.minimax.io/oauth/token", minimax: true },
};
const failed = () => new KeliError("Account authorization failed or expired; retry keli auth add <provider>", "secret_unavailable");
async function tokenEndpoint(flow: Flow, signal?: AbortSignal): Promise<string> {
  if (flow.token) return flow.token;
  const response = await fetch("https://auth.x.ai/.well-known/openid-configuration", { signal: signal ?? AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw failed();
  const data = await response.json() as { token_endpoint?: string };
  const url = new URL(data.token_endpoint ?? "");
  if (url.protocol !== "https:" || url.hostname !== "auth.x.ai" || url.username || url.password || (url.port && url.port !== "443")) throw failed();
  return url.href;
}
async function post(url: string, values: Record<string, string>, signal?: AbortSignal, headers: Record<string, string> = {}) {
  const response = await fetch(url, { method: "POST", redirect: "error", body: new URLSearchParams(values), headers: { Accept: "application/json", ...headers }, signal: AbortSignal.any([AbortSignal.timeout(20_000), ...(signal ? [signal] : [])]) });
  const data = await response.json() as Record<string, unknown>;
  return { ok: response.ok, data };
}
function expires(raw: unknown, minimax = false): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw failed();
  return minimax && n > Date.now() / 2 ? n : Date.now() + n * 1000;
}
function credentials(data: Record<string, unknown>, flow: Flow, refresh?: string): OAuthCredentials {
  if (typeof data.access_token !== "string" || !data.access_token || !(data.refresh_token || refresh)) throw failed();
  let expiry: number;
  if (data.expires_in == null && !flow.minimax) {
    try {
      const claims = JSON.parse(Buffer.from(data.access_token.split(".")[1]!, "base64url").toString());
      if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw failed();
      expiry = claims.exp * 1000;
    } catch { throw failed(); }
  } else expiry = expires(flow.minimax ? data.expired_in : data.expires_in, flow.minimax);
  if (flow.nous) {
    // The Portal token must authorize inference; never substitute a billing credential.
    let claims: { scope?: string; scp?: string; exp?: number };
    try { claims = JSON.parse(Buffer.from(data.access_token.split(".")[1]!, "base64url").toString()); } catch { throw failed(); }
    if (!`${data.scope ?? ""} ${claims.scope ?? ""} ${claims.scp ?? ""}`.split(/\s+/).includes("inference:invoke")) throw failed();
    if (claims.exp && claims.exp * 1000 <= Date.now()) throw failed();
  }
  return { access: data.access_token, refresh: String(data.refresh_token || refresh), expires: expiry };
}
export function hermesOAuthProvider(id: string): OAuthProviderInterface | undefined {
  const flow = FLOWS[id];
  if (!flow) return undefined;
  return {
    id, name: id,
    async login(callbacks) {
      const signal = AbortSignal.any([AbortSignal.timeout(15 * 60_000), ...(callbacks.signal ? [callbacks.signal] : [])]);
      const verifier = randomBytes(48).toString("base64url");
      const state = randomBytes(16).toString("base64url");
      const fields: Record<string, string> = { client_id: flow.client, scope: flow.scope };
      if (flow.minimax) Object.assign(fields, { response_type: "code", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state });
      const start = await post(flow.device, fields, signal, flow.minimax ? { "x-request-id": randomUUID() } : {});
      const d = start.data;
      if (!start.ok || typeof d.user_code !== "string" || typeof d.verification_uri !== "string" || (flow.minimax && d.state !== state) || (!flow.minimax && typeof d.device_code !== "string")) throw failed();
      const url = new URL(String(d.verification_uri_complete ?? d.verification_uri));
      if (url.protocol !== "https:" || url.username || url.password) throw failed();
      callbacks.onAuth({ url: url.href, instructions: `Enter code: ${d.user_code}` });
      const deadline = expires(flow.minimax ? d.expired_in : d.expires_in, flow.minimax);
      let interval = Math.max(1000, Number(d.interval || (flow.minimax ? 2000 : 5)) * (flow.minimax ? 1 : 1000));
      if (!Number.isFinite(interval)) throw failed();
      const endpoint = await tokenEndpoint(flow, signal);
      while (Date.now() < deadline) {
        const request: Record<string, string> = { client_id: flow.client, grant_type: flow.minimax ? "urn:ietf:params:oauth:grant-type:user_code" : "urn:ietf:params:oauth:grant-type:device_code", ...(flow.minimax ? { user_code: d.user_code, code_verifier: verifier } : { device_code: String(d.device_code) }) };
        const result = await post(endpoint, request, signal);
        if (result.ok && result.data.access_token) return credentials(result.data, flow);
        if (result.data.error === "slow_down") interval += 5000;
        else if (result.data.error !== "authorization_pending" && !(flow.minimax && result.ok && result.data.status === "pending")) throw failed();
        await delay(Math.min(interval, Math.max(1, deadline - Date.now())), undefined, { signal });
      }
      throw failed();
    },
    async refreshToken(previous) {
      const endpoint = await tokenEndpoint(flow);
      const result = await post(endpoint, { grant_type: "refresh_token", client_id: flow.client, ...(!flow.nous ? { refresh_token: previous.refresh } : {}) }, undefined, flow.nous ? { "x-nous-refresh-token": previous.refresh } : {});
      if (!result.ok) throw failed();
      return credentials(result.data, flow, previous.refresh);
    },
    getApiKey: (c) => c.access,
  };
}
