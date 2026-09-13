import type { RoundTripContext, RoundTripResult } from "./types.ts";

type HttpRoundTripInput = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** Predicate on a 2xx JSON/text body; defaults to accepting any 2xx. */
  accept?: (status: number, body: string) => boolean;
};

/** One bounded HTTP request classified into typed outcomes. Secrets never appear in `detail`. */
export async function httpRoundTrip(input: HttpRoundTripInput): Promise<RoundTripResult> {
  const started = performance.now();
  try {
    const response = await fetch(input.url, {
      method: input.method ?? "GET",
      headers: {
        ...(input.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(input.headers ?? {}),
      },
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      signal: AbortSignal.timeout(input.timeoutMs ?? 8000),
    });
    const latencyMs = Math.round(performance.now() - started);
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      return { ok: false, detail: `HTTP ${response.status} authentication failed`, failure: "auth", latencyMs };
    }
    if (!response.ok) {
      return {
        ok: false,
        detail: `HTTP ${response.status}`,
        failure: response.status >= 500 ? "transport" : "invalid",
        latencyMs,
      };
    }
    if (input.accept && !input.accept(response.status, text)) {
      return { ok: false, detail: `HTTP ${response.status} but response shape unexpected`, failure: "invalid", latencyMs };
    }
    return { ok: true, detail: `HTTP ${response.status}`, latencyMs };
  } catch (e) {
    const message = String(e);
    return {
      ok: false,
      detail: /timeout|TimeoutError/i.test(message) ? "timeout" : `transport error: ${message.slice(0, 120)}`,
      failure: "transport",
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

export function notConfigured(detail: string): RoundTripResult {
  return { ok: false, detail, failure: "not-configured" };
}

export function bearer(ctx: RoundTripContext): Record<string, string> {
  return ctx.credential ? { Authorization: `Bearer ${ctx.credential}` } : {};
}

/** OpenAI-compatible endpoints: `GET /models` is the cheapest authenticated request. */
export async function openAiModelsRoundTrip(ctx: RoundTripContext, baseUrl?: string): Promise<RoundTripResult> {
  const url = baseUrl ?? ctx.settings.baseUrl ?? ctx.fixtureUrl;
  if (!url) return notConfigured("no base URL");
  return httpRoundTrip({
    url: `${url.replace(/\/$/, "")}/models`,
    headers: bearer(ctx),
    timeoutMs: ctx.timeoutMs,
  });
}

/** Fixture servers expose `/chat/completions`; a minimal completion proves the wire shape. */
export async function fixtureCompletionRoundTrip(ctx: RoundTripContext): Promise<RoundTripResult> {
  const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
  if (!url) return notConfigured("no fixture URL");
  return httpRoundTrip({
    url: `${url.replace(/\/$/, "")}/chat/completions`,
    method: "POST",
    headers: { Authorization: "Bearer fixture" },
    body: {
      model: "keli-fixture",
      messages: [
        { role: "system", content: "probe" },
        {
          role: "user",
          content: JSON.stringify({
            request: "probe",
            action: { id: "probe", scope: "probe", key: "coding.delegate", revision: 0 },
            rule: { scope: "probe", key: "coding.delegate", value: "Codex", revision: 0 },
          }),
        },
      ],
    },
    timeoutMs: ctx.timeoutMs,
    accept: (_s, body) => body.includes("choices"),
  });
}
