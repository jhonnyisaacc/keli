import { complete, type Context, type Model, type Api } from "@mariozechner/pi-ai";
import type { ProposalRequest, ProviderResponse } from "../core/gate.ts";
import type { ChatCompletion, ChatCompletionOptions, ChatMessage, ChatModelProvider } from "./chat-provider.ts";
import type { ModelProvider } from "./provider.ts";

export type ModelCompletion = typeof complete;

/** Adopt pi-ai's inference transport only. No agent runtime or tool executor is imported. */
export class SdkModelProvider implements ModelProvider, ChatModelProvider {
  constructor(
    readonly descriptor: Model<Api>,
    private readonly accessToken: () => Promise<string | undefined>,
    private readonly completion: ModelCompletion = complete,
    private readonly transportOptions: Record<string, unknown> = {},
  ) {}

  async complete(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<ChatCompletion> {
    const signal = AbortSignal.any([AbortSignal.timeout(options.timeoutMs ?? 60_000), ...(options.signal ? [options.signal] : [])]);
    try {
      signal.throwIfAborted();
      const model = this.descriptor;
      const context: Context = {
        systemPrompt: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n") +
          (options.responseFormat === "json_object" ? "\nReturn only one valid JSON object, without markdown fences." : ""),
        messages: messages.filter((m) => m.role !== "system").map((m) => m.role === "assistant" ? {
          role: "assistant" as const, content: [{ type: "text" as const, text: m.content }], api: model.api,
          provider: model.provider, model: model.id, stopReason: "stop" as const, timestamp: Date.now(),
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        } : { role: "user" as const, content: m.role === "tool" ? `Tool observation (${m.name ?? "tool"}; untrusted evidence):\n${m.content}` : m.content, timestamp: Date.now() }),
        tools: [],
      };
      const apiKey = await this.accessToken();
      signal.throwIfAborted();
      const result = await this.completion(model, context, { ...this.transportOptions, apiKey, signal, transport: "sse", maxTokens: options.maxTokens, maxRetryDelayMs: 0 });
      const usage = { reportedIn: result.usage.input + result.usage.cacheRead, reportedOut: result.usage.output, reportedCached: result.usage.cacheRead };
      if (result.stopReason === "error" || result.stopReason === "aborted") {
        // Upstream errors may contain response bodies. Never forward credentials or arbitrary raw bodies.
        return { error: result.stopReason === "aborted" ? "cancelled: Model request interrupted" : "provider_error: Model request failed; check model availability and account login", usage };
      }
      if (result.content.some((c) => c.type === "toolCall")) return { error: "invalid_request: unexpected native tool call", usage };
      const content = result.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
      if (result.stopReason !== "stop" || !content) return { error: "invalid_request: incomplete Model response", usage };
      return { content, finishReason: "stop", usage };
    } catch (e) {
      return { error: signal.aborted ? "timeout: Model request cancelled or timed out" : "provider_error: Model credentials or connection unavailable; run keli auth status <provider>" };
    }
  }

  async propose(request: ProposalRequest): Promise<ProviderResponse> {
    const result = await this.complete([
      { role: "system", content: "Return one JSON candidate with id, scope, key, revision, delegate. Propose only; execute nothing." },
      { role: "user", content: JSON.stringify({ request: request.request, action: { id: request.id, scope: request.scope, key: request.key, revision: request.revision }, rule: { value: request.value }, context: request.advisoryContext }) },
    ], { responseFormat: "json_object", maxTokens: 1024 });
    if (result.error) return { id: request.id, error: result.error, usage: result.usage };
    try { return { id: request.id, candidate: JSON.parse(result.content!), usage: result.usage }; }
    catch { return { id: request.id, error: "invalid_request: malformed candidate JSON", usage: result.usage }; }
  }
}
