import type { ProviderUsage } from "../core/gate.ts";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  name?: string;
};

export type ChatCompletionOptions = {
  responseFormat?: "json_object" | "text";
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type ChatCompletion = {
  content?: string;
  error?: string;
  finishReason?: string;
  usage?: ProviderUsage;
};

/**
 * Plain chat completion over the configured protocol. Keli asks for JSON objects instead of
 * native tool calling so any OpenAI-compatible endpoint works; the conversation loop parses
 * and validates the shape before anything executes.
 */
export interface ChatModelProvider {
  complete(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletion>;
}

export function isChatModelProvider(value: unknown): value is ChatModelProvider {
  return Boolean(value) && typeof (value as ChatModelProvider).complete === "function";
}
