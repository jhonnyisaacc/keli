import type { ProposalRequest, ProviderResponse } from "../core/gate.ts";
import type { ModelProvider, ProviderMode } from "./provider.ts";
import { normalizeProviderFailure } from "./normalize.ts";

export class HttpModelProvider implements ModelProvider {
  constructor(
    private readonly endpoint: string,
    private readonly modelId: string,
  ) {}

  async propose(request: ProposalRequest, mode: ProviderMode = "normal"): Promise<ProviderResponse> {
    try {
      const response = await fetch(`${this.endpoint.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer keli-provider",
        },
        body: JSON.stringify({
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
              }),
            },
          ],
          response_format: { type: "json_object" },
        }),
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
      if (!content) return { id: request.id, error: "Empty provider response" };
      const candidate = JSON.parse(content) as ProviderResponse["candidate"];
      return { id: request.id, candidate };
    } catch (e) {
      return { id: request.id, error: String(e) };
    }
  }
}
