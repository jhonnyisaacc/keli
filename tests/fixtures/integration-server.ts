export type IntegrationFixture = {
  server: ReturnType<typeof Bun.serve>;
  endpoint: string;
  stop: () => void;
};

export function startIntegrationFixture(): IntegrationFixture {
  const sessions = new Map<string, { cancelled: boolean }>();

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path === "/search" && req.method === "POST") {
        const body = (await req.json()) as { query: string };
        return Response.json({
          results: [{ title: `Result for ${body.query}`, url: "http://127.0.0.1/example" }],
        });
      }

      if (path === "/navigate" && req.method === "POST") {
        const body = (await req.json()) as { url: string };
        return Response.json({
          url: body.url,
          title: "Fixture Page",
          content: "<html><body>fixture content</body></html>",
        });
      }

      if (path === "/mcp" && req.method === "POST") {
        const body = (await req.json()) as {
          op: string;
          name?: string;
          arguments?: { text?: string };
        };
        if (body.op === "list") {
          return Response.json({ tools: [{ name: "echo", description: "echo text" }] });
        }
        if (body.op === "call") {
          return Response.json({
            content: [{ type: "text", text: String(body.arguments?.text ?? "ok") }],
          });
        }
        return new Response("unknown op", { status: 400 });
      }

      if (path === "/delegate" && req.method === "POST") {
        const body = (await req.json()) as {
          cancelEpoch: number;
          delegate?: string;
        };
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, { cancelled: false });
        if (body.delegate === "Codex" && process.env.KELI_FIXTURE_FAIL_CODEX === "1") {
          return Response.json({
            sessionId,
            status: "failed",
            artifacts: [],
            usageBytes: 0,
            error: "primary delegate unavailable",
          });
        }
        if (body.cancelEpoch > 0) {
          return Response.json({
            sessionId,
            status: "cancelled",
            artifacts: [],
            usageBytes: 0,
          });
        }
        return Response.json({
          sessionId,
          status: "completed",
          artifacts: [{ path: "diff.patch", bytes: 42 }],
          usageBytes: 128,
        });
      }

      if (path === "/discord/send" && req.method === "POST") {
        if (process.env.KELI_FIXTURE_FAIL_DISCORD === "1") {
          return new Response("fixture discord failure", { status: 503 });
        }
        const body = (await req.json()) as { channelId: string; content: string };
        return Response.json({
          messageId: `discord-${crypto.randomUUID()}`,
          channelId: body.channelId,
          status: "delivered",
        });
      }

      if (path === "/telegram/send" && req.method === "POST") {
        if (process.env.KELI_FIXTURE_FAIL_TELEGRAM === "1") {
          return new Response("fixture telegram failure", { status: 503 });
        }
        const body = (await req.json()) as { chatId: string; topicId?: string; content: string };
        return Response.json({
          messageId: `telegram-${crypto.randomUUID()}`,
          chatId: body.chatId,
          topicId: body.topicId ?? null,
          status: "delivered",
        });
      }

      if (path === "/page" && req.method === "GET") {
        return new Response("<html><body><h1>Keli fixture</h1></body></html>", {
          headers: { "content-type": "text/html" },
        });
      }

      return new Response("not found", { status: 404 });
    },
  });

  const endpoint = `http://127.0.0.1:${server.port}`;
  return {
    server,
    endpoint,
    stop: () => server.stop(),
  };
}
