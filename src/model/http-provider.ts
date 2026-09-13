import type { ProposalRequest, ProviderResponse, ProviderUsage } from "../core/gate.ts";
import type { ModelProvider, ProviderMode } from "./provider.ts";
import { normalizeProviderFailure } from "./normalize.ts";
import type { ApiMode } from "../integrations/types.ts";
import type {
  ChatCompletion,
  ChatCompletionOptions,
  ChatMessage,
  ChatModelProvider,
} from "./chat-provider.ts";

export type HttpModelProviderOptions = {
  apiKey?: string;
  apiMode?: ApiMode;
  providerId?: string;
  timeoutMs?: number;
};

type ChatCompletionsPayload = {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string; tool_calls?: unknown[] };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cached_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
};

function usageFrom(payload: ChatCompletionsPayload): ProviderUsage | undefined {
  if (!payload.usage) return undefined;
  return {
    reportedIn: payload.usage.prompt_tokens,
    reportedOut: payload.usage.completion_tokens,
    reportedCached: payload.usage.cached_tokens ?? payload.usage.prompt_tokens_details?.cached_tokens,
  };
}

export function unsupportedApiModeReason(apiMode: ApiMode | undefined): string | null {
  if (!apiMode || apiMode === "chat-completions") return null;
  if (apiMode === "anthropic-messages") {
    return "protocol 'anthropic-messages' is not wired; use an OpenAI-compatible endpoint or wait for the Anthropic profile";
  }
  if (apiMode === "acp") return "protocol 'acp' is a coding delegate protocol, not a chat provider";
  return `protocol '${String(apiMode)}' is not supported`;
}

export class HttpModelProvider implements ModelProvider, ChatModelProvider {
  constructor(
    private readonly endpoint: string,
    private readonly modelId: string,
    private readonly options: HttpModelProviderOptions = {},
  ) {}

  get providerId(): string {
    return this.options.providerId ?? "openai-compatible";
  }

  get model(): string {
    return this.modelId;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.options.apiKey) headers.Authorization = `Bearer ${this.options.apiKey}`;
    return headers;
  }

  private async post(
    body: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<{ payload?: ChatCompletionsPayload; error?: string }> {
    const unsupported = unsupportedApiModeReason(this.options.apiMode);
    if (unsupported) return { error: `unsupported: ${unsupported}` };
    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const text = await response.text();
        const normalized = normalizeProviderFailure(response.status, text);
        return { error: `${normalized.code}: ${normalized.message}` };
      }
      return { payload: (await response.json()) as ChatCompletionsPayload };
    } catch (e) {
      const message = String(e);
      if (/timeout|TimeoutError|aborted/i.test(message)) return { error: `timeout: ${message}` };
      return { error: `transport: ${message}` };
    }
  }

  async propose(request: ProposalRequest, mode: ProviderMode = "normal"): Promise<ProviderResponse> {
    const { payload, error } = await this.post(
      {
        model: this.modelId,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              request: request.request,
              action: {
                id: request.id,
                scope: request.scope,
                key: request.key,
                revision: request.revision,
              },
              rule: {
                scope: request.scope,
                key: request.key,
                value: request.value,
                revision: request.revision,
              },
              mode,
              context: request.advisoryContext,
            }),
          },
        ],
        response_format: { type: "json_object" },
      },
      this.options.timeoutMs ?? 5000,
    );
    if (error || !payload) return { id: request.id, error: error ?? "Empty provider response" };

    const choice = payload.choices?.[0];
    if (choice?.finish_reason !== "stop" || choice.message?.tool_calls?.length) {
      return { id: request.id, error: "invalid_request: Expected final candidate, no tools" };
    }
    const content = choice.message?.content;
    if (!content) return { id: request.id, error: "invalid_request: Empty provider response" };
    try {
      const candidate = JSON.parse(content) as ProviderResponse["candidate"];
      return { id: request.id, candidate, usage: usageFrom(payload) };
    } catch {
      return { id: request.id, error: "invalid_request: Malformed candidate JSON", usage: usageFrom(payload) };
    }
  }

  async complete(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<ChatCompletion> {
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content, ...(m.name ? { name: m.name } : {}) })),
    };
    if (options.responseFormat === "json_object") body.response_format = { type: "json_object" };
    if (options.maxTokens) body.max_tokens = options.maxTokens;

    const { payload, error } = await this.post(
      body,
      options.timeoutMs ?? this.options.timeoutMs ?? 60_000,
      options.signal,
    );
    if (error || !payload) return { error: error ?? "transport: empty response" };
    const choice = payload.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string" || !content.length) {
      return { error: "invalid_request: provider returned no text content", usage: usageFrom(payload) };
    }
    return { content, finishReason: choice?.finish_reason, usage: usageFrom(payload) };
  }
}
