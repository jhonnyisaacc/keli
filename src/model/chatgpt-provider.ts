import { complete, getModel, getModels, type Context, type Model, type Api } from "@mariozechner/pi-ai";
import type { ProposalRequest, ProviderResponse } from "../core/gate.ts";
import type { ChatCompletion, ChatCompletionOptions, ChatMessage, ChatModelProvider } from "./chat-provider.ts";
import type { ModelProvider } from "./provider.ts";

export const CHATGPT_DEFAULT_MODEL = "gpt-5.5";
export const chatgptModels = () => getModels("openai-codex").map((m) => m.id);
export type ModelCompletion = typeof complete;

/** Adopt pi-ai's inference transport only. No agent runtime or tool executor is imported. */
export class ChatGptModelProvider implements ModelProvider, ChatModelProvider {
  constructor(
    readonly model: string,
    private readonly accessToken: () => Promise<string>,
    private readonly completion: ModelCompletion = complete,
  ) {}

  async complete(messages: ChatMessage[], options: ChatCompletionOptions = {}): Promise<ChatCompletion> {
    const signal = AbortSignal.any([AbortSignal.timeout(options.timeoutMs ?? 60_000), ...(options.signal ? [options.signal] : [])]);
    try {
      signal.throwIfAborted();
      const known = getModels("openai-codex").find((m) => m.id === this.model);
      // Explicit account-specific model ids use the same protocol; pricing remains unknown in Keli.
      const model: Model<Api> = known ?? { ...getModel("openai-codex", CHATGPT_DEFAULT_MODEL), id: this.model, name: this.model };
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
      const result = await this.completion(model, context, { apiKey, signal, transport: "sse", maxTokens: options.maxTokens, maxRetryDelayMs: 0 });
      const usage = { reportedIn: result.usage.input + result.usage.cacheRead, reportedOut: result.usage.output, reportedCached: result.usage.cacheRead };
      if (result.stopReason === "error" || result.stopReason === "aborted") {
        // Upstream errors may contain response bodies. Never forward credentials or arbitrary raw bodies.
        return { error: result.stopReason === "aborted" ? "cancelled: ChatGPT request interrupted" : "provider_error: ChatGPT request failed; check model availability and account login", usage };
      }
      if (result.content.some((c) => c.type === "toolCall")) return { error: "invalid_request: unexpected native tool call", usage };
      const content = result.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
      if (result.stopReason !== "stop" || !content) return { error: "invalid_request: incomplete ChatGPT response", usage };
      return { content, finishReason: "stop", usage };
    } catch (e) {
      return { error: signal.aborted ? "timeout: ChatGPT request cancelled or timed out" : "provider_error: ChatGPT credentials or connection unavailable; run keli auth status chatgpt" };
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
