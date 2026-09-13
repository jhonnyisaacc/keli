export type IntegrationFixture = {
  server: ReturnType<typeof Bun.serve>;
  endpoint: string;
  stop: () => void;
};

export type FixtureDiscordMessage = {
  id: string;
  channelId: string;
  parentChannelId?: string;
  authorId: string;
  authorIsBot: boolean;
  content: string;
  timestamp: string;
};

export function startIntegrationFixture(): IntegrationFixture & {
  discord: { inbound: FixtureDiscordMessage[]; sent: Array<{ channelId: string; threadId?: string; content: string }> };
} {
  const sessions = new Map<string, { cancelled: boolean }>();
  const discord = {
    inbound: [] as FixtureDiscordMessage[],
    sent: [] as Array<{ channelId: string; threadId?: string; content: string }>,
  };

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
        const body = (await req.json()) as { channelId: string; threadId?: string; content: string };
        discord.sent.push({ channelId: body.channelId, threadId: body.threadId, content: body.content });
        return Response.json({
          messageId: `discord-${crypto.randomUUID()}`,
          channelId: body.channelId,
          status: "delivered",
        });
      }

      if (path === "/discord/inbound" && req.method === "POST") {
        const body = (await req.json()) as Partial<FixtureDiscordMessage> & { content: string; channelId: string };
        const message: FixtureDiscordMessage = {
          id: body.id ?? String(Date.now() * 1000 + discord.inbound.length),
          channelId: body.channelId,
          parentChannelId: body.parentChannelId,
          authorId: body.authorId ?? "human-1",
          authorIsBot: body.authorIsBot ?? false,
          content: body.content,
          timestamp: body.timestamp ?? new Date().toISOString(),
        };
        discord.inbound.push(message);
        return Response.json(message);
      }

      if (path === "/discord/messages" && req.method === "GET") {
        const channelId = url.searchParams.get("channelId");
        const after = url.searchParams.get("after");
        const messages = discord.inbound
          .filter((m) => m.channelId === channelId)
          .filter((m) => !after || BigInt(m.id) > BigInt(after))
          .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        return Response.json({ messages });
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

      if (path.startsWith("/honcho/") && req.method === "POST") {
        const op = path.replace("/honcho/", "");
        if (process.env.KELI_FIXTURE_HONCHO_OUTAGE === "1") {
          return new Response("honcho outage", { status: 503 });
        }
        const body = (await req.json()) as { scope: string; key?: string; content?: string; query?: string };
        const store = (globalThis as { __honchoStore?: Map<string, string> }).__honchoStore ?? new Map();
        (globalThis as { __honchoStore?: Map<string, string> }).__honchoStore = store;
        const recordKey = `${body.scope}:${body.key ?? body.query ?? ""}`;
        if (op === "store" && body.key && body.content) {
          store.set(`${body.scope}:${body.key}`, body.content);
          return Response.json({ ok: true });
        }
        if (op === "query") {
          const matches = [...store.entries()]
            .filter(([k]) => k.startsWith(`${body.scope}:`))
            .map(([k, content]) => ({ key: k.split(":").slice(1).join(":"), content }));
          return Response.json({ ok: true, records: matches });
        }
        if (op === "delete" && body.key) {
          store.delete(`${body.scope}:${body.key}`);
          return Response.json({ ok: true });
        }
        return Response.json({ ok: false, error: { code: "invalid_request", message: "unknown honcho op" } });
      }

      if (path === "/browser/session" && req.method === "POST") {
        const body = (await req.json()) as { url: string; authenticated?: boolean };
        return Response.json({
          sessionId: `session-${crypto.randomUUID()}`,
          title: body.authenticated ? "Authenticated fixture" : "Anonymous fixture",
          url: body.url,
        });
      }

      if (path === "/chat/completions" && req.method === "POST") {
        const body = (await req.json()) as {
          model?: string;
          messages?: Array<{ content?: string }>;
        };
        const userContent = body.messages?.[0]?.content ?? "{}";
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(userContent) as Record<string, unknown>;
        } catch {
          parsed = {};
        }
        const action = (parsed.action ?? {}) as Record<string, unknown>;
        const rule = (parsed.rule ?? {}) as Record<string, unknown>;
        const candidate = {
          id: action.id ?? crypto.randomUUID(),
          scope: action.scope ?? rule.scope,
          key: action.key ?? rule.key,
          revision: action.revision ?? rule.revision,
          delegate: rule.value ?? "Grok",
        };
        return Response.json({
          choices: [{ finish_reason: "stop", message: { content: JSON.stringify(candidate) } }],
        });
      }

      return new Response("not found", { status: 404 });
    },
  });

  const endpoint = `http://127.0.0.1:${server.port}`;
  return {
    server,
    endpoint,
    discord,
    stop: () => server.stop(),
  };
}
