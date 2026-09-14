import { describe, expect, test } from "bun:test";
import { webFetch } from "../../src/adapters/web.ts";
import { browserCapture, browserNavigate } from "../../src/adapters/browser.ts";
import { createHash } from "node:crypto";

describe("browser and web artifacts", () => {
  test("web.fetch records type, bytes, hash, and bounded text", async () => {
    const html = "<html><body><p>Hello artifact</p></body></html>";
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        return new Response(html, { headers: { "content-type": "text/html" } });
      },
    });
    const url = `http://127.0.0.1:${server.port}/page`;
    const result = await webFetch({ url }, { allowedHosts: ["127.0.0.1"] });
    expect(result.ok).toBe(true);
    const output = result.output as { text: string; bytes: number; sha256: string; contentType: string; url: string };
    expect(output.url).toBe(url);
    expect(output.contentType).toBe("text/plain");
    expect(output.text).toContain("Hello artifact");
    expect(output.sha256).toBe(createHash("sha256").update(output.text).digest("hex"));
    expect(result.artifacts?.[0]?.hash).toBe(output.sha256);
    server.stop(true);
  });

  test("model-supplied hosts cannot bypass the allowlist", async () => {
    const denied = await webFetch({ url: "https://example.com/" }, { allowedHosts: ["127.0.0.1"] });
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe("capability_denied");
  });

  test("browser navigate preserves hashable content from the fixture backend", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path.endsWith("/navigate")) {
          return Response.json({ url: "https://example.com/", title: "Example", content: "<html>ok</html>" });
        }
        if (path.endsWith("/capture")) {
          const png = Buffer.from("fixture-png");
          return Response.json({
            url: "https://example.com/",
            kind: "screenshot",
            contentType: "image/png",
            bodyBase64: png.toString("base64"),
            title: "Example",
          });
        }
        return new Response("no", { status: 404 });
      },
    });
    const prev = process.env.KELI_FIXTURE_BROWSER;
    process.env.KELI_FIXTURE_BROWSER = `http://127.0.0.1:${server.port}`;
    const result = await browserNavigate(
      { url: "https://example.com/" },
      { allowedHosts: ["example.com"] },
      { primary: "fixture", fixtureUrl: `http://127.0.0.1:${server.port}` },
    );
    expect(result.ok).toBe(true);
    const output = result.output as { sha256: string; bytes: number; content: string };
    expect(output.bytes).toBeGreaterThan(0);
    expect(output.sha256).toHaveLength(64);
    expect(result.artifacts?.[0]?.hash).toBe(output.sha256);
    const shot = await browserCapture(
      { url: "https://example.com/", kind: "screenshot" },
      { allowedHosts: ["example.com"] },
      { primary: "fixture", fixtureUrl: `http://127.0.0.1:${server.port}` },
    );
    expect(shot.ok).toBe(true);
    const capture = shot.output as { bodyBase64: string; sha256: string; bytes: number };
    expect(capture.sha256).toBe(createHash("sha256").update(Buffer.from(capture.bodyBase64, "base64")).digest("hex"));
    expect(shot.artifacts?.[0]?.hash).toBe(capture.sha256);
    server.stop(true);
    if (prev === undefined) delete process.env.KELI_FIXTURE_BROWSER;
    else process.env.KELI_FIXTURE_BROWSER = prev;
  });
});
