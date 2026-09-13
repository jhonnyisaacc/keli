import { describe, expect, test } from "bun:test";
import { createModelProvider } from "../../src/model/provider-factory.ts";
import { listProviders } from "../../src/model/provider-registry.ts";
import { HttpModelProvider } from "../../src/model/http-provider.ts";
import { KeliError } from "../../src/core/errors.ts";
import type { CredentialSource } from "../../src/credentials/source.ts";
import { defaultConfig, type KeliConfig } from "../../src/state/config.ts";
import { renderLiveProbe, requiredIntegrationIds, runLiveProbe } from "../../src/integrations/live-probe.ts";
import { classifyProviderError, withBoundedRetries } from "../../src/model/retry.ts";

function fakeCredentials(values: Record<string, string>): CredentialSource {
  return {
    name: "fake",
    available: true,
    async get(ref) {
      return values[`${ref.service}/${ref.id}`] ?? null;
    },
  };
}

function captureServer() {
  let lastAuth: string | null = null;
  let lastModel: string | null = null;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      lastAuth = req.headers.get("authorization");
      const url = new URL(req.url);
      if (url.pathname.endsWith("/models")) {
        if (lastAuth !== "Bearer sk-live") return new Response("nope", { status: 401 });
        return Response.json({ data: [{ id: "m" }] });
      }
      const body = (await req.json()) as { model: string };
      lastModel = body.model;
      return Response.json({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ ok: true }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    },
  });
  return {
    endpoint: `http://127.0.0.1:${server.port}/v1`,
    lastAuth: () => lastAuth,
    lastModel: () => lastModel,
    stop: () => server.stop(),
  };
}

function configWithProvider(endpoint: string, extra: Partial<KeliConfig> = {}): KeliConfig {
  return {
    ...defaultConfig(),
    ownerId: "owner",
    defaultProjectId: "p",
    providers: { primary: { id: "openai-compatible", model: "gpt-test" } },
    integrations: {
      "openai-compatible": {
        enabled: true,
        settings: { baseUrl: endpoint },
        credentialRef: { id: "api-key", service: "keli/openai-compatible" },
      },
    },
    ...extra,
  };
}

describe("config-aware provider creation", () => {
  test("uses saved config, credential ref, and configured model", async () => {
    const server = captureServer();
    const config = configWithProvider(server.endpoint);
    const created = await createModelProvider({
      config,
      credentials: fakeCredentials({ "keli/openai-compatible/api-key": "sk-live" }),
    });
    expect(created.providerId).toBe("openai-compatible");
    expect(created.model).toBe("gpt-test");
    expect(created.resolved.source).toBe("config");
    expect(created.costKnown).toBe(false);
    const provider = created.provider as HttpModelProvider;
    const completion = await provider.complete([{ role: "user", content: "hi" }]);
    expect(completion.error).toBeUndefined();
    expect(server.lastAuth()).toBe("Bearer sk-live");
    expect(server.lastModel()).toBe("gpt-test");
    expect(completion.usage?.reportedIn).toBe(10);
    server.stop();
  });

  test("missing credential fails closed with a typed error", async () => {
    const server = captureServer();
    const config = configWithProvider(server.endpoint);
    await expect(
      createModelProvider({ config, credentials: fakeCredentials({}) }),
    ).rejects.toMatchObject({ code: "secret_unavailable" });
    server.stop();
  });

  test("disabled integration and unsupported protocol are reported accurately", async () => {
    const server = captureServer();
    const disabled = configWithProvider(server.endpoint);
    disabled.integrations!["openai-compatible"]!.enabled = false;
    await expect(
      createModelProvider({ config: disabled, credentials: fakeCredentials({ "keli/openai-compatible/api-key": "x" }) }),
    ).rejects.toMatchObject({ code: "capability_unavailable" });

    const anthropic: KeliConfig = {
      ...defaultConfig(),
      ownerId: "o",
      defaultProjectId: "p",
      providers: { primary: { id: "claude-code", model: "claude" } },
      integrations: { "claude-code": { enabled: true, settings: { baseUrl: server.endpoint } } },
    };
    let error: unknown;
    try {
      await createModelProvider({ config: anthropic, credentials: fakeCredentials({}) });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(KeliError);
    expect(String((error as Error).message)).toContain("anthropic-messages");
    server.stop();
  });

  test("listProviders reflects config availability without fixture env", () => {
    const prev = process.env.KELI_PROVIDER_URL;
    delete process.env.KELI_PROVIDER_URL;
    const config = configWithProvider("http://127.0.0.1:9/v1");
    const providers = listProviders(config);
    const openai = providers.find((p) => p.id === "openai-compatible");
    expect(openai?.available).toBe(true);
    expect(openai?.source).toBe("config");
    expect(openai?.model).toBe("gpt-test");
    const bare = listProviders(null).find((p) => p.id === "openai-compatible");
    expect(bare?.available).toBe(false);
    if (prev) process.env.KELI_PROVIDER_URL = prev;
  });
});

describe("typed retries", () => {
  test("classification never retries auth or invalid requests", () => {
    expect(classifyProviderError("auth: Provider authentication failed").retryable).toBe(false);
    expect(classifyProviderError("invalid_request: bad").retryable).toBe(false);
    expect(classifyProviderError("transport: Provider HTTP 503").retryable).toBe(true);
    expect(classifyProviderError("timeout: aborted").retryable).toBe(true);
    expect(classifyProviderError("quota: rate limited").retryable).toBe(true);
  });

  test("no-progress stop is reachable within the retry cap and every attempt is reported", async () => {
    const seen: number[] = [];
    const outcome = await withBoundedRetries(async () => ({ error: "transport: Provider HTTP 503" }), {
      errorOf: (r) => r.error,
      baseMs: 0,
      afterAttempt: (n) => {
        seen.push(n);
      },
    });
    expect(outcome.stop).toBe("no_progress");
    expect(outcome.attempts).toBe(3);
    expect(seen).toEqual([1, 2, 3]);
  });

  test("changing errors exhaust retries instead of looping", async () => {
    let n = 0;
    const outcome = await withBoundedRetries(
      async () => ({ error: `transport: attempt ${++n}` }),
      { errorOf: (r) => r.error, baseMs: 0 },
    );
    expect(outcome.stop).toBe("retries_exhausted");
    expect(outcome.attempts).toBe(3);
  });
});

describe("live probe", () => {
  test("required integrations come from config; skipped required never pass", async () => {
    const server = captureServer();
    const config = configWithProvider(server.endpoint, {
      setup: { transport: "discord", completedAt: "now" },
    });
    expect(requiredIntegrationIds(config).sort()).toEqual(["discord", "openai-compatible"]);

    const report = await runLiveProbe({
      config,
      credentials: fakeCredentials({ "keli/openai-compatible/api-key": "sk-live" }),
      only: ["openai-compatible", "discord", "fixture"],
    });
    const openai = report.lines.find((l) => l.id === "openai-compatible");
    expect(openai?.outcome).toBe("pass");
    const discord = report.lines.find((l) => l.id === "discord");
    expect(discord?.required).toBe(true);
    expect(discord?.outcome).toBe("fail");
    expect(report.green).toBe(false);
    expect(renderLiveProbe(report)).toContain("[required]: FAIL");
    server.stop();
  });

  test("auth failures are typed, not transport", async () => {
    const server = captureServer();
    const config = configWithProvider(server.endpoint);
    const report = await runLiveProbe({
      config,
      credentials: fakeCredentials({ "keli/openai-compatible/api-key": "wrong" }),
      only: ["openai-compatible"],
    });
    expect(report.lines[0]?.outcome).toBe("fail");
    expect(report.lines[0]?.detail).toContain("authentication failed");
    server.stop();
  });
});
