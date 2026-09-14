import { expect, test } from "bun:test";
import { catalogDescriptor, catalogEntry, createCatalogProvider, providerCatalog } from "../../src/integrations/catalog-provider.ts";
import { getIntegration } from "../../src/integrations/registry.ts";
import { createModelProvider, isProviderFallbackEligible } from "../../src/model/provider-factory.ts";
import { listProviders } from "../../src/model/provider-registry.ts";
import { HttpModelProvider } from "../../src/model/http-provider.ts";
import { SdkModelProvider, type ModelCompletion } from "../../src/model/sdk-provider.ts";
import { defaultConfig } from "../../src/state/config.ts";
import { providerDeviceOAuthProvider } from "../../src/integrations/provider-device-oauth.ts";
import { clearLiveCheck } from "../../src/integrations/live-probe.ts";
import { KeliError } from "../../src/core/errors.ts";
import "../../src/integrations/load.ts";

const credentials = { name: "test", available: true, get: async () => "test-key" };

test("every bundled inference profile constructs through the shared factory; delegate identities stay distinct", async () => {
  for (const row of providerCatalog) {
    if (["openai-codex", "grok", "moa", "copilot-acp"].includes(row.name)) continue;
    const id = row.name;
    const config = { ...defaultConfig(), providers: { primary: { id, model: "account-model" } }, integrations: { [id]: { enabled: true, settings: { baseUrl: "http://127.0.0.1:1/v1" }, credentialRef: { service: `keli/${id}`, id: "api-key" } } } };
    const result = await createModelProvider({ config, credentials });
    expect(result.providerId).toBe(id);
    expect(result.model).toBe("account-model");
    expect(result.provider).toBeInstanceOf(SdkModelProvider);
  }
  expect(getIntegration("codex")?.kind).toBe("delegate");
  expect(getIntegration("opencode")?.kind).toBe("delegate");
  expect(getIntegration("openai-codex")?.id).toBe("chatgpt");
  expect(getIntegration("anthropic")?.id).toBe("anthropic");
  expect(getIntegration("openai")?.id).toBe("openai-compatible");
  expect(catalogEntry("grok")).toBeUndefined();
  expect(catalogEntry("xai-oauth")?.name).toBe("xai-oauth");
});

test("grok remains the A05 HTTP override; xAI subscription uses xai-oauth", async () => {
  const grok = await createModelProvider({
    config: {
      ...defaultConfig(),
      providers: { primary: { id: "grok", model: "grok-4" } },
      integrations: { grok: { enabled: true, settings: { baseUrl: "http://127.0.0.1:1/v1" }, credentialRef: { service: "keli/grok", id: "api-key" } } },
    },
    credentials,
  });
  expect(grok.provider).toBeInstanceOf(HttpModelProvider);
  const subscription = await createModelProvider({
    config: {
      ...defaultConfig(),
      providers: { primary: { id: "xai-oauth", model: "account-model" } },
      integrations: { "xai-oauth": { enabled: true, settings: { baseUrl: "http://127.0.0.1:1/v1" }, credentialRef: { service: "keli/xai-oauth", id: "api-key" } } },
    },
    credentials,
  });
  expect(subscription.provider).toBeInstanceOf(SdkModelProvider);
});

test("native protocols are selected instead of sending everything to chat/completions", () => {
  for (const [id, api] of [["anthropic", "anthropic-messages"], ["minimax", "anthropic-messages"], ["gemini", "google-generative-ai"], ["vertex", "google-vertex"], ["bedrock", "bedrock-converse-stream"], ["openai-api", "openai-responses"], ["azure-foundry", "azure-openai-responses"]]) {
    expect(catalogDescriptor(id!, "chosen", { baseUrl: "https://configured.example/v1" }).api).toBe(api!);
  }
});

test("native chat-completions transport sends model, scoped credential and no executable tools", async () => {
  let body: Record<string, unknown> = {};
  let auth: string | null = null;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
    expect(new URL(req.url).pathname).toBe("/v1/chat/completions");
    auth = req.headers.get("authorization"); body = await req.json() as Record<string, unknown>;
    const chunk = { id: "1", object: "chat.completion.chunk", created: 1, model: "account-model", choices: [{ index: 0, delta: { content: '{"connected":true}' }, finish_reason: "stop" }], usage: { prompt_tokens: 7, completion_tokens: 4 } };
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  } });
  try {
    const profile = getIntegration("openrouter")!;
    const provider = await createCatalogProvider({ profile, settings: { baseUrl: `http://127.0.0.1:${server.port}/v1` }, credentialRef: { service: "keli/openrouter", id: "api-key" }, source: "config" }, "account-model", credentials);
    const result = await provider.complete([{ role: "user", content: "hello" }]);
    expect(result.error).toBeUndefined(); expect(result.content).toBe('{"connected":true}');
    expect(auth as string | null).toBe("Bearer test-key"); expect(body.model).toBe("account-model"); expect(body.tools ?? []).toEqual([]);
  } finally { server.stop(true); }
});

test("keyless servers never receive an unrelated ambient OpenAI credential", async () => {
  const before = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = "must-not-leak";
  let auth: string | null = null;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(req) { auth = req.headers.get("authorization"); return new Response("denied", { status: 400 }); } });
  try {
    const provider = await createCatalogProvider({ profile: getIntegration("custom")!, settings: { baseUrl: `http://127.0.0.1:${server.port}/v1` }, credentialRef: null, source: "config" }, "local-model");
    await provider.complete([{ role: "user", content: "hello" }]); expect(auth as string | null).toBe("Bearer keli-keyless");
  } finally { server.stop(true); if (before === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = before; }
});

test("all SDK protocols reject unsolicited tool execution and keep upstream error bodies private", async () => {
  for (const id of ["anthropic", "gemini", "openai-api", "bedrock", "vertex"]) {
    const completion = (async (_model, context) => {
      expect(context.tools).toEqual([]);
      return { content: [{ type: "toolCall", id: "1", name: "shell", arguments: {} }], stopReason: "stop", usage: { input: 1, output: 2, cacheRead: 0 } };
    }) as ModelCompletion;
    const provider = new SdkModelProvider(catalogDescriptor(id, "chosen"), async () => "test-key", completion);
    expect((await provider.complete([{ role: "user", content: "hello" }])).error).toContain("unexpected native tool call");
  }
});

test("role routing does not borrow the primary provider's model", async () => {
  const config = { ...defaultConfig(), providers: { primary: { id: "openai-api", model: "gpt-account" }, fallback: [{ id: "anthropic", model: "claude-account" }] }, routing: { strong: "anthropic" }, integrations: { anthropic: { enabled: true, settings: {}, credentialRef: { service: "keli/anthropic", id: "api-key" } } } };
  const result = await createModelProvider({ config, role: "strong", credentials }); expect(result.model).toBe("claude-account");
});

test("MiniMax account flow validates state before polling", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ user_code: "123", verification_uri: "https://api.minimax.io/login", expired_in: 100, state: "wrong" })) as unknown as typeof fetch;
  try { await expect(providerDeviceOAuthProvider("minimax-oauth")!.login({ onAuth() { throw new Error("must not display mismatched login"); }, onPrompt: async () => "" })).rejects.toThrow("authorization failed"); }
  finally { globalThis.fetch = original; }
});

test("Anthropic and Gemini SDKs use their native wire formats", async () => {
  for (const id of ["anthropic", "gemini"]) {
    let captured: { path?: string; body?: Record<string, unknown>; key?: string | null } = {};
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
      captured = { path: new URL(req.url).pathname, body: await req.json() as Record<string, unknown>, key: req.headers.get(id === "anthropic" ? "x-api-key" : "x-goog-api-key") };
      const events = id === "anthropic" ? [
        { type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "chosen", content: [], usage: { input_tokens: 3, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hello" } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 1 } },
        { type: "message_stop" },
      ] : [{ candidates: [{ content: { role: "model", parts: [{ text: "hello" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1, totalTokenCount: 4 } }];
      return new Response(events.map((e) => `${"type" in e ? `event: ${e.type}\n` : ""}data: ${JSON.stringify(e)}\n\n`).join(""), { headers: { "Content-Type": "text/event-stream" } });
    } });
    try {
      const provider = await createCatalogProvider({ profile: getIntegration(id)!, settings: { baseUrl: `http://127.0.0.1:${server.port}` }, credentialRef: { service: `keli/${id}`, id: "api-key" }, source: "config" }, "chosen", credentials);
      const result = await provider.complete([{ role: "user", content: "hello" }]);
      expect(result.error).toBeUndefined(); expect(result.content).toBe("hello");
      expect(captured.key).toBe("test-key");
      expect(captured.path).toContain(id === "anthropic" ? "/v1/messages" : "streamGenerateContent");
      expect(captured.body?.tools ?? []).toEqual([]);
    } finally { server.stop(true); }
  }
});

test("Nous and MiniMax account exchanges use scoped device grants and refresh only their own tokens", async () => {
  const original = globalThis.fetch;
  for (const id of ["nous", "minimax-oauth"]) {
    const isNous = id === "nous";
    const jwt = `header.${Buffer.from(JSON.stringify({ scope: "inference:invoke", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
    let phase = 0;
    globalThis.fetch = (async (_url: unknown, options: RequestInit) => {
      const form = options.body as URLSearchParams;
      if (phase++ === 0) {
        expect(form.get("scope")).toBe(isNous ? "inference:invoke" : "group_id profile model.completion");
        if (!isNous) expect(form.get("code_challenge_method")).toBe("S256");
        return Response.json({ device_code: "device", user_code: "code", verification_uri: "https://login.example/", expires_in: 300, expired_in: 300, state: form.get("state") });
      }
      if (phase === 2) {
        expect(form.get("grant_type")).toBe(isNous ? "urn:ietf:params:oauth:grant-type:device_code" : "urn:ietf:params:oauth:grant-type:user_code");
        if (!isNous) expect(form.get("code_verifier")!.length).toBeGreaterThan(40);
      } else {
        expect(form.get("grant_type")).toBe("refresh_token");
        if (isNous) { expect(new Headers(options.headers).get("x-nous-refresh-token")).toBe("owned-refresh"); expect(form.has("refresh_token")).toBe(false); }
        else expect(form.get("refresh_token")).toBe("owned-refresh");
      }
      return Response.json({ access_token: isNous ? jwt : "access", refresh_token: "owned-refresh", expires_in: 3600, expired_in: 3600, status: "success" });
    }) as unknown as typeof fetch;
    try {
      const provider = providerDeviceOAuthProvider(id)!;
      const session = await provider.login({ onAuth: () => {}, onPrompt: async () => "" });
      expect(session.expires).toBeGreaterThan(Date.now());
      expect((await provider.refreshToken(session)).refresh).toBe("owned-refresh");
    } finally { globalThis.fetch = original; }
  }
});

test("xAI discovery cannot redirect an OAuth exchange to another host", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; return Response.json({ token_endpoint: "https://attacker.example/token" }); }) as unknown as typeof fetch;
  try { await expect(providerDeviceOAuthProvider("xai-oauth")!.refreshToken({ access: "old", refresh: "private", expires: 1 })).rejects.toThrow(); expect(calls).toBe(1); }
  finally { globalThis.fetch = original; }
});

test("live-verified applies only to the probed model, not a later replacement", () => {
  const base = {
    ...defaultConfig(),
    providers: { primary: { id: "chatgpt" as const, model: "gpt-5.4" } },
    integrations: { chatgpt: { enabled: true, settings: {}, credentialRef: { service: "keli/chatgpt", id: "oauth" } } },
    setup: { liveChecked: { chatgpt: { at: "2026-01-01T00:00:00.000Z", model: "gpt-5.5" } } },
  };
  expect(listProviders(base).find((p) => p.id === "chatgpt")?.readiness).toBe("configured");
  const same = {
    ...base,
    providers: { primary: { id: "chatgpt" as const, model: "gpt-5.5" } },
  };
  expect(listProviders(same).find((p) => p.id === "chatgpt")?.readiness).toBe("live-verified");
});

test("fallback is eligible only for typed transport failures, never missing secrets", () => {
  expect(isProviderFallbackEligible(new KeliError("down", "engine_error", true))).toBe(true);
  expect(isProviderFallbackEligible(new KeliError("missing key", "secret_unavailable"))).toBe(false);
  expect(isProviderFallbackEligible(new KeliError("bad json", "invalid_request"))).toBe(false);
  expect(isProviderFallbackEligible("timeout: Model request cancelled or timed out")).toBe(true);
});

test("changing the selected model clears live-verified state", () => {
  const config = {
    ...defaultConfig(),
    providers: { primary: { id: "chatgpt" as const, model: "gpt-5.5" } },
    integrations: { chatgpt: { enabled: true, settings: { model: "gpt-5.5" }, credentialRef: { service: "keli/chatgpt", id: "oauth" } } },
    setup: { liveChecked: { chatgpt: { at: "2026-01-01T00:00:00.000Z", model: "gpt-5.5" } } },
  };
  expect(listProviders(config).find((p) => p.id === "chatgpt")?.readiness).toBe("live-verified");
  clearLiveCheck(config, "chatgpt");
  expect(listProviders({ ...config, providers: { primary: { id: "chatgpt", model: "gpt-5.4" } } }).find((p) => p.id === "chatgpt")?.readiness).toBe("configured");
});
