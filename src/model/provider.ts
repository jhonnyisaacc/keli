import type { ProposalRequest, ProviderResponse } from "../core/gate.ts";
import type { DelegateCandidate } from "../core/types.ts";
import { normalizeProviderFailure } from "./normalize.ts";

export type ProviderMode =
  | "normal"
  | "force"
  | "spoof"
  | "scope"
  | "id"
  | "tool"
  | "malformed"
  | "http";

export interface ModelProvider {
  propose(request: ProposalRequest, mode?: ProviderMode): Promise<ProviderResponse>;
}

export class FixtureModelProvider implements ModelProvider {
  constructor(private readonly endpoint: string) {}

  async propose(request: ProposalRequest, mode: ProviderMode = "normal"): Promise<ProviderResponse> {
    const start = performance.now();
    const body = {
      model: "keli-fixture",
      messages: [
        {
          role: "system",
          content:
            "Return one JSON candidate with id, scope, key, revision, delegate. Propose only; execute nothing.",
        },
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
            force: mode === "force" ? "OpenCode" : undefined,
            context: request.advisoryContext,
          }),
        },
      ],
      response_format: { type: "json_object" },
    };

    try {
      const response = await fetch(`${this.endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer fixture",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const body = await response.text();
        const normalized = normalizeProviderFailure(response.status, body);
        return { id: request.id, error: `${normalized.code}: ${normalized.message}` };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ finish_reason?: string; message?: { content?: string; tool_calls?: unknown[] } }>;
      };
      const choice = payload.choices?.[0];
      if (choice?.finish_reason !== "stop" || choice.message?.tool_calls?.length) {
        return { id: request.id, error: "Expected final candidate, no tools" };
      }

      const content = choice.message?.content;
      if (typeof content !== "string" || content.length > 4096) {
        return { id: request.id, error: "Invalid candidate response" };
      }

      const candidate = JSON.parse(content) as DelegateCandidate;
      return { id: request.id, candidate, error: undefined };
    } catch (e) {
      return { id: request.id, error: String(e) };
    } finally {
      void start;
    }
  }
}
