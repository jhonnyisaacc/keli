import type { ChatCompletion, ChatMessage, ChatModelProvider } from "../../src/model/chat-provider.ts";
import type { ModelDecision } from "../../src/conversation/types.ts";
import type { ChatModelFactory } from "../../src/conversation/loop.ts";

export type ScriptedStep = ModelDecision | string | ((messages: ChatMessage[]) => ModelDecision | string);

/**
 * Deterministic chat provider for replay tests. Each `complete` call consumes one scripted step;
 * every call's messages are recorded so tests can assert what the loop fed back to the model.
 */
export class ScriptedChatModel implements ChatModelProvider {
  readonly calls: ChatMessage[][] = [];
  private cursor = 0;

  constructor(private readonly steps: ScriptedStep[]) {}

  async complete(messages: ChatMessage[]): Promise<ChatCompletion> {
    this.calls.push(messages.map((m) => ({ ...m })));
    const step = this.steps[this.cursor++];
    if (step === undefined) {
      return { content: "", error: "scripted model exhausted", usage: undefined };
    }
    const value = typeof step === "function" ? step(messages) : step;
    const content = typeof value === "string" ? value : JSON.stringify(value);
    return {
      content,
      usage: { reportedIn: 100, reportedOut: 20 },
      finishReason: "stop",
    };
  }

  remaining(): number {
    return this.steps.length - this.cursor;
  }
}

export function scriptedFactory(model: ScriptedChatModel): ChatModelFactory {
  return async () => ({ provider: model, providerId: "scripted", model: "scripted-1", costKnown: false });
}
