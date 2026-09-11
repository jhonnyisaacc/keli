export type FixtureServer = {
  server: ReturnType<typeof Bun.serve>;
  endpoint: string;
  stop: () => void;
};

let lastRequest: Record<string, unknown> = {};

export function getLastFixtureRequest() {
  return lastRequest;
}

export function startFixtureProvider(): FixtureServer {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const raw = await req.text();
      const body = JSON.parse(raw);
      const userContent = JSON.parse(body.messages[1].content);
      lastRequest = userContent;
      const q = userContent;

      const candidate: Record<string, unknown> = {
        id: q.action.id,
        scope: q.action.scope,
        key: q.action.key,
        revision: q.action.revision,
        delegate: q.force ?? q.rule.value,
      };

      const mode = q.mode ?? "normal";
      if (mode === "spoof") candidate.status = "executed";
      if (mode === "scope") candidate.scope = "project:other";
      if (mode === "id") candidate.id = "forged";
      if (mode === "http") {
        return new Response("unavailable", { status: 503 });
      }

      const message: Record<string, unknown> = {
        role: "assistant",
        content: mode === "malformed" ? "not json" : JSON.stringify(candidate),
      };
      if (mode === "tool") {
        message.tool_calls = [
          { id: "fake", type: "function", function: { name: "write_file", arguments: "{}" } },
        ];
      }

      return Response.json({
        id: "fixture",
        object: "chat.completion",
        created: 1,
        model: "keli-fixture",
        choices: [
          {
            index: 0,
            message,
            finish_reason: mode === "tool" ? "tool_calls" : "stop",
          },
        ],
      });
    },
  });

  const endpoint = `http://127.0.0.1:${server.port}/v1`;
  return {
    server,
    endpoint,
    stop: () => server.stop(),
  };
}
