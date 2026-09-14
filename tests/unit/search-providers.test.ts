import { describe, expect, test } from "bun:test";
import { searchQuery } from "../../src/adapters/search.ts";
import { defaultConfig } from "../../src/state/config.ts";
import "../../src/integrations/load.ts";

describe("search providers", () => {
  test("missing access is typed when search is unset", async () => {
    const prev = process.env.KELI_FIXTURE_SEARCH;
    const prevAlias = process.env.KELI_SEARCH_FIXTURE_URL;
    delete process.env.KELI_FIXTURE_SEARCH;
    delete process.env.KELI_SEARCH_FIXTURE_URL;
    const result = await searchQuery({ query: "keli" }, { config: defaultConfig() });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("missing_access");
    if (prev === undefined) delete process.env.KELI_FIXTURE_SEARCH;
    else process.env.KELI_FIXTURE_SEARCH = prev;
    if (prevAlias === undefined) delete process.env.KELI_SEARCH_FIXTURE_URL;
    else process.env.KELI_SEARCH_FIXTURE_URL = prevAlias;
  });

  test("generic JSON normalizes results and rejects malformed bodies", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname.endsWith("/search") && req.headers.get("authorization") === "Bearer secret") {
          const body = (await req.json()) as { query: string };
          if (body.query === "bad") return new Response("not-json");
          return Response.json({ results: [{ title: "Hit", url: "https://example.com/", snippet: "n" }] });
        }
        return new Response("no", { status: 401 });
      },
    });
    const config = {
      ...defaultConfig(),
      integrations: {
        search: {
          enabled: true,
          settings: { baseUrl: `http://127.0.0.1:${server.port}` },
          credentialRef: { service: "keli/search", id: "api-key" },
        },
      },
    };
    const prev = process.env.KELI_FIXTURE_SEARCH;
    delete process.env.KELI_FIXTURE_SEARCH;
    delete process.env.KELI_SEARCH_FIXTURE_URL;
    const ok = await searchQuery({ query: "keli" }, { config, credential: "secret" });
    expect(ok.ok).toBe(true);
    expect((ok.output as { results: Array<{ url: string }> }).results[0]?.url).toBe("https://example.com/");
    const bad = await searchQuery({ query: "bad" }, { config, credential: "secret" });
    expect(bad.ok).toBe(false);
    expect(bad.error?.code).toBe("invalid_request");
    const denied = await searchQuery({ query: "keli" }, { config, credential: "wrong" });
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe("needs_reauth");
    server.stop(true);
    if (prev !== undefined) process.env.KELI_FIXTURE_SEARCH = prev;
  });
});
