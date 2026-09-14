import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ChatGptModelProvider, type ModelCompletion } from "../../src/model/chatgpt-provider.ts";
import { codexAccessToken, chatGptAccessToken, CHATGPT_OAUTH_REF } from "../../src/integrations/chatgpt-auth.ts";
import { createModelProvider } from "../../src/model/provider-factory.ts";

const usage = { input: 10, output: 5, cacheRead: 3, cacheWrite: 0, totalTokens: 18, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
function fake(content: unknown[], stopReason = "stop"): ModelCompletion {
  return (async (_model: unknown, context: { tools?: unknown[] }, options: { apiKey?: string }) => {
    expect(context.tools).toEqual([]);
    expect(options.apiKey).toBe("test-access");
    return { content, stopReason, usage };
  }) as unknown as ModelCompletion;
}

describe("ChatGPT inference boundary", () => {
  test("returns a tool proposal as data, with usage; never executes it", async () => {
    const text = JSON.stringify({ type: "tool_call", capability: "shell.run", input: { command: "never execute" } });
    const provider = new ChatGptModelProvider("gpt-5.5", async () => "test-access", fake([{ type: "text", text }]));
    const result = await provider.complete([{ role: "user", content: "Investigate" }], { responseFormat: "json_object" });
    expect(result.content).toBe(text);
    expect(result.usage?.reportedIn).toBe(13);
  });
  test("rejects unexpected native tool calls and truncated answers", async () => {
    for (const [content, reason] of [[[{ type: "toolCall", id: "x", name: "shell", arguments: {} }], "stop"], [[{ type: "text", text: "partial" }], "length"]] as const) {
      const p = new ChatGptModelProvider("gpt-5.5", async () => "test-access", fake([...content], reason));
      expect((await p.complete([])).error).toContain("invalid_request");
    }
  });
  test("pre-cancelled requests never reach credential storage or inference", async () => {
    let called = false;
    const p = new ChatGptModelProvider("gpt-5.5", async () => { called = true; return "test-access"; }, fake([]));
    const result = await p.complete([], { signal: AbortSignal.abort() });
    expect(result.error).toContain("timeout");
    expect(called).toBe(false);
  });
  test("does not leak upstream errors", async () => {
    const p = new ChatGptModelProvider("gpt-5.5", async () => "test-access", (async () => { throw Error("secret-value"); }) as ModelCompletion);
    expect(JSON.stringify(await p.complete([]))).not.toContain("secret-value");
  });
  test("factory resolves an explicitly stored account without spawning a delegate", async () => {
    const credentials = { name: "test", available: true, get: async () => JSON.stringify({ access: "test-access", refresh: "test-refresh", expires: Date.now() + 3600000 }) };
    const created = await createModelProvider({ explicitId: "chatgpt", credentials, config: { version: 2, ownerId: "o", defaultProjectId: "p", integrations: { chatgpt: { enabled: true, settings: {}, credentialRef: CHATGPT_OAUTH_REF } } } });
    expect(created.provider).toBeInstanceOf(ChatGptModelProvider);
    expect(created.costKnown).toBe(false);
    expect(await chatGptAccessToken(CHATGPT_OAUTH_REF, credentials)).toBe("test-access");
  });
  test("external session stays read-only and expired sessions fail closed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keli-codex-auth-"));
    try {
      const file = join(dir, "auth.json");
      const token = (exp: number) => `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
      const text = JSON.stringify({ tokens: { access_token: token(Date.now() / 1000 + 3600), refresh_token: "must-not-rotate" } });
      await writeFile(file, text);
      expect(await codexAccessToken(file)).toContain("header.");
      expect(await readFile(file, "utf8")).toBe(text);
      await writeFile(file, JSON.stringify({ tokens: { access_token: token(1) } }));
      await expect(codexAccessToken(file)).rejects.toThrow("expired");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

test("concurrent Keli-owned refreshes rotate once and persist before reuse", async () => {
  const { getOAuthProvider } = await import("@mariozechner/pi-ai/oauth");
  const oauth = getOAuthProvider("openai-codex")!;
  const original = oauth.refreshToken;
  const previousLock = process.env.KELI_AUTH_LOCK_DIR;
  const dir = await mkdtemp(join(tmpdir(), "keli-auth-refresh-"));
  let stored = JSON.stringify({ access: "expired", refresh: "original", expires: 1 });
  let refreshes = 0;
  const source = { name: "test", available: true, get: async () => stored, set: async (_ref: unknown, value: string) => { stored = value; } };
  try {
    process.env.KELI_AUTH_LOCK_DIR = dir;
    oauth.refreshToken = async () => { refreshes++; return { access: "renewed", refresh: "rotated", expires: Date.now() + 3600000 }; };
    expect(await Promise.all([chatGptAccessToken(CHATGPT_OAUTH_REF, source), chatGptAccessToken(CHATGPT_OAUTH_REF, source)])).toEqual(["renewed", "renewed"]);
    expect(refreshes).toBe(1);
    expect(JSON.parse(stored).refresh).toBe("rotated");
  } finally {
    oauth.refreshToken = original;
    if (previousLock == null) delete process.env.KELI_AUTH_LOCK_DIR; else process.env.KELI_AUTH_LOCK_DIR = previousLock;
    await rm(dir, { recursive: true, force: true });
  }
});
