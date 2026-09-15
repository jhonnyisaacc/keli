import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KeliError } from "../../src/core/errors.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import type { CredentialRef, CredentialSource } from "../../src/credentials/source.ts";
import { defaultModelFor, normalizeModelId, opencodeApiMode, normalizeOpencodeBaseUrl } from "../../src/integrations/provider-behavior.ts";
import { renderCompatLedger } from "../../src/integrations/compat-ledger.ts";
import { loginProvider } from "../../src/integrations/provider-oauth.ts";
import { mcpListTools, mcpTargetFrom } from "../../src/adapters/mcp.ts";
import { searchQuery } from "../../src/adapters/search.ts";
import { speechTranscribe } from "../../src/adapters/speech.ts";
import { importHonchoAdvisory } from "../../src/memory/provider.ts";
import { createModelProvider } from "../../src/model/provider-factory.ts";
import { HttpModelProvider } from "../../src/model/http-provider.ts";
import { CHATGPT_DEFAULT_MODEL } from "../../src/model/chatgpt-provider.ts";
import {
  configureModel,
  persistIntegration,
  runApiKeyAuth,
  runExternalCliAuth,
  runKeylessAuth,
  runOAuthAuth,
} from "../../src/setup/flows.ts";
import { createScriptedWizardIo } from "../../src/setup/io.ts";
import { initializeState, requireInitialized } from "../../src/state/init.ts";
import { defaultConfig, readConfig } from "../../src/state/config.ts";
import { getProjectById, projectScope } from "../../src/state/repos.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import "../../src/integrations/load.ts";

class MemoryCredentialSource implements CredentialSource {
  readonly name = "memory";
  readonly available = true;
  private readonly store = new Map<string, string>();

  private key(ref: CredentialRef): string {
    return `${ref.service}/${ref.id}`;
  }

  async get(ref: CredentialRef): Promise<string | null> {
    return this.store.get(this.key(ref)) ?? null;
  }

  async set(ref: CredentialRef, value: string): Promise<void> {
    this.store.set(this.key(ref), value);
  }

  async delete(ref: CredentialRef): Promise<void> {
    this.store.delete(this.key(ref));
  }
}

const ENV_BROWSER = [
  "KELI_BROWSER_FIXTURE_URL",
  "KELI_FIXTURE_BROWSER",
  "KELI_BROWSER_CDP_URL",
  "KELI_FIXTURE_BROWSER_CDP",
  "KELI_BROWSER_MCP_URL",
  "KELI_FIXTURE_BROWSER_MCP",
] as const;

function clearEnv(keys: readonly string[]): Map<string, string | undefined> {
  const previous = new Map<string, string | undefined>();
  for (const key of keys) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  return previous;
}

function restoreEnv(previous: Map<string, string | undefined>): void {
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("provider onboarding contracts", () => {
  test("API-key auth stores a credential ref only", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req) {
        if (new URL(req.url).pathname.endsWith("/models")) return Response.json({ data: [] });
        return new Response("no", { status: 404 });
      },
    });
    const stateDir = await mkdtemp(join(tmpdir(), "keli-auth-key-"));
    const init = await initializeState(stateDir);
    const config = (await readConfig(stateDir))!;
    await persistIntegration({
      config,
      stateDir,
      id: "openai-compatible",
      settings: { baseUrl: `http://127.0.0.1:${server.port}/v1` },
    });
    const source = new MemoryCredentialSource();
    const result = await runApiKeyAuth({
      integrationId: "openai-compatible",
      stateDir,
      config,
      value: "sk-never-write-me",
      source,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.credentialRef?.service).toBe("keli/openai-compatible");
      expect(await source.get(result.credentialRef!)).toBe("sk-never-write-me");
    }
    const saved = await readConfig(stateDir);
    expect(JSON.stringify(saved)).not.toContain("sk-never-write-me");
    expect(saved?.integrations?.["openai-compatible"]?.credentialRef).toEqual({
      service: "keli/openai-compatible",
      id: "api-key",
    });
    expect(init.ownerId).toBe(config.ownerId);
    server.stop(true);
    await rm(stateDir, { recursive: true, force: true });
  });

  test("empty API key is a cancelled typed error", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-auth-cancel-"));
    await initializeState(stateDir);
    const config = (await readConfig(stateDir))!;
    const result = await runApiKeyAuth({
      integrationId: "grok",
      stateDir,
      config,
      value: "",
      source: new MemoryCredentialSource(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cancelled).toBe(true);
      expect(result.error.code).toBe("cancelled");
    }
    await rm(stateDir, { recursive: true, force: true });
  });

  test("OAuth abort is cancelled and retry asks once more", async () => {
    await expect(
      loginProvider("anthropic", { signal: AbortSignal.abort(), onAuth() {}, onPrompt: async () => "" }, new MemoryCredentialSource()),
    ).rejects.toMatchObject({ code: "cancelled" });

    const stateDir = await mkdtemp(join(tmpdir(), "keli-auth-oauth-"));
    await initializeState(stateDir);
    const config = (await readConfig(stateDir))!;
    let attempts = 0;
    const lines: string[] = [];
    const io = createScriptedWizardIo(["y", "n"], lines);
    const result = await runOAuthAuth({
      integrationId: "anthropic",
      stateDir,
      config,
      io,
      source: new MemoryCredentialSource(),
      retryOnCancel: true,
      login: async () => {
        attempts += 1;
        throw new KeliError("Login cancelled for anthropic", "cancelled");
      },
    });
    expect(attempts).toBe(2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.cancelled).toBe(true);
      expect(result.error.code).toBe("cancelled");
    }
    await rm(stateDir, { recursive: true, force: true });
  });

  test("external CLI auth persists a credential reference", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-auth-cli-"));
    await initializeState(stateDir);
    const config = (await readConfig(stateDir))!;
    const result = await runExternalCliAuth({
      integrationId: "opencode",
      stateDir,
      config,
      source: new MemoryCredentialSource(),
    });
    expect(result.ok).toBe(true);
    const saved = await readConfig(stateDir);
    expect(saved?.integrations?.opencode?.credentialRef).toEqual({
      id: "external-cli",
      service: "keli/opencode",
    });
    await rm(stateDir, { recursive: true, force: true });
  });

  test("keyless local OpenAI-compatible endpoints send no ambient Authorization", async () => {
    const before = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "must-not-leak";
    let auth: string | null = "unset";
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req) {
        const path = new URL(req.url).pathname;
        auth = req.headers.get("authorization");
        if (path.endsWith("/models")) return Response.json({ data: [{ id: "local-model" }] });
        return Response.json({
          choices: [{ finish_reason: "stop", message: { content: '{"connected":true}' } }],
        });
      },
    });
    const stateDir = await mkdtemp(join(tmpdir(), "keli-keyless-"));
    await initializeState(stateDir);
    const config = (await readConfig(stateDir))!;
    const authResult = await runKeylessAuth({
      integrationId: "openai-compatible",
      stateDir,
      config,
      source: new MemoryCredentialSource(),
    });
    expect(authResult.ok).toBe(true);
    const model = await configureModel({
      integrationId: "openai-compatible",
      stateDir,
      config,
      baseUrl: `http://127.0.0.1:${server.port}/v1`,
      model: "local-model",
    });
    expect(model.ok).toBe(true);
    const saved = (await readConfig(stateDir))!;
    expect(saved.integrations?.["openai-compatible"]?.settings.keyless).toBe("true");
    expect(saved.integrations?.["openai-compatible"]?.credentialRef).toBeUndefined();
    const created = await createModelProvider({ config: saved, credentials: new MemoryCredentialSource() });
    expect(created.provider).toBeInstanceOf(HttpModelProvider);
    await created.provider.complete?.([{ role: "user", content: "hi" }]);
    expect(auth).toBeNull();
    server.stop(true);
    if (before === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = before;
    await rm(stateDir, { recursive: true, force: true });
  });

  test("provider defaults and OpenCode model normalization", () => {
    expect(defaultModelFor("chatgpt")).toBe(CHATGPT_DEFAULT_MODEL);
    expect(defaultModelFor("grok")).toBe("grok-4");
    expect(defaultModelFor("anthropic")).toBe("claude-haiku-4-5-20251001");
    expect(normalizeModelId("opencode-zen", "opencode-zen/claude-sonnet-4")).toBe("claude-sonnet-4");
    expect(opencodeApiMode("opencode-zen", "claude-sonnet-4")).toBe("anthropic_messages");
    expect(opencodeApiMode("opencode-go", "gpt-5")).toBe("codex_responses");
    expect(normalizeOpencodeBaseUrl("opencode-zen", "chat_completions", "https://opencode.ai/zen")).toBe(
      "https://opencode.ai/zen/v1",
    );
    expect(normalizeOpencodeBaseUrl("opencode-zen", "anthropic_messages", "https://opencode.ai/zen/v1")).toBe(
      "https://opencode.ai/zen",
    );
  });

  test("safe defaults skip the model prompt", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req) {
        if (new URL(req.url).pathname.endsWith("/models")) return Response.json({ data: [{ id: "local-discovered" }] });
        return new Response("no", { status: 404 });
      },
    });
    const stateDir = await mkdtemp(join(tmpdir(), "keli-model-default-"));
    await initializeState(stateDir);
    const config = (await readConfig(stateDir))!;
    await persistIntegration({
      config,
      stateDir,
      id: "openai-compatible",
      settings: { baseUrl: `http://127.0.0.1:${server.port}/v1`, keyless: "true" },
    });
    const io = {
      println() {},
      async question() {
        throw new Error("model prompt should not run when a safe default exists");
      },
    };
    const result = await configureModel({
      integrationId: "openai-compatible",
      stateDir,
      config,
      io,
      advanced: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.settings.model).toBe("local-discovered");
    server.stop(true);
    await rm(stateDir, { recursive: true, force: true });
  });

  test("persisted browser settings reach CapabilityGate without fixture env", async () => {
    const previous = clearEnv(ENV_BROWSER);
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-gate-browser-"));
    try {
      await initializeState(stateDir, { cwd: stateDir });
      const { db, owner, config } = await requireInitialized(stateDir);
      config.browser = { primary: "cdp" };
      config.integrations = {
        ...config.integrations,
        "browser-cdp": { enabled: true, settings: { url: fixture.endpoint } },
      };
      const project = getProjectById(db, config.defaultProjectId)!;
      const roots = JSON.parse(project.resource_roots_json) as string[];
      const gate = new CapabilityGate(db, defaultRegistry, stateDir, owner.id);
      const { result } = await gate.run(
        { capabilityId: "browser.navigate", input: { url: `${fixture.endpoint}/page` }, resources: roots },
        { readableRoots: roots, writableRoots: roots },
        projectScope(project.id),
        stateDir,
        { config, networkHosts: ["127.0.0.1", "localhost"] },
      );
      expect(result.ok).toBe(true);
      expect((result.output as { backend: string }).backend).toBe("cdp");
      db.close();
    } finally {
      fixture.stop();
      restoreEnv(previous);
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  test("optional integrations produce typed blockers when unconfigured", async () => {
    const previous = clearEnv(["KELI_FIXTURE_SEARCH", "KELI_SEARCH_FIXTURE_URL", "KELI_FIXTURE_MCP", "KELI_MCP_FIXTURE_URL", "KELI_FIXTURE_SPEECH", "KELI_SPEECH_FIXTURE_URL"]);
    try {
      const search = await searchQuery({ query: "keli" }, { config: defaultConfig() });
      expect(search.error?.code).toBe("missing_access");
      const mcp = await mcpListTools(undefined, defaultConfig());
      expect(mcp.error?.code).toBe("missing_access");
      const audio = join(tmpdir(), `keli-speech-${crypto.randomUUID()}.wav`);
      await writeFile(audio, "RIFF");
      const speech = await speechTranscribe(
        { path: audio },
        { readableRoots: [tmpdir()], writableRoots: [] },
        { config: defaultConfig() },
      );
      expect(speech.ok).toBe(false);
      expect(speech.error?.code).toBe("missing_access");
      const honcho = await importHonchoAdvisory({ scope: "proj", key: "k", content: "x" }, { enabled: true });
      expect(honcho.ok).toBe(false);
      expect(honcho.error?.code).toBe("missing_access");
    } finally {
      restoreEnv(previous);
    }
  });

  test("persisted MCP settings reach dispatch without fixture env", async () => {
    const previous = clearEnv(["KELI_FIXTURE_MCP", "KELI_MCP_FIXTURE_URL"]);
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        if (req.method === "POST" && req.headers.get("content-type")?.includes("json")) {
          const body = (await req.json()) as { method?: string; id?: number };
          if (!body.method) return Response.json({});
          if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
          if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: [] } });
          return Response.json({ jsonrpc: "2.0", id: body.id, result: {} });
        }
        return new Response("no", { status: 404 });
      },
    });
    const stateDir = await mkdtemp(join(tmpdir(), "keli-mcp-persist-"));
    try {
      await initializeState(stateDir);
      const config = (await readConfig(stateDir))!;
      await persistIntegration({
        config,
        stateDir,
        id: "mcp",
        settings: { url: `http://127.0.0.1:${server.port}`, transport: "http" },
      });
      const saved = (await readConfig(stateDir))!;
      expect(mcpTargetFrom(saved).httpUrl).toBe(`http://127.0.0.1:${server.port}`);
      const listed = await mcpListTools(undefined, saved);
      expect(listed.ok).toBe(true);
    } finally {
      server.stop(true);
      restoreEnv(previous);
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  test("committed compatibility ledger is generated from Keli data", async () => {
    const generated = renderCompatLedger();
    const committed = await readFile(new URL("../../docs/evidence/UPSTREAM_COMPAT.md", import.meta.url), "utf8");
    expect(committed).toBe(generated);
    expect(generated).toContain("| `chatgpt` |");
    expect(generated).not.toMatch(/\/(?:home|Users)\//);
    expect(generated).not.toMatch(/\|\s*live-verified\s*\|/);
    expect(generated).toContain("`implemented`");
    expect(generated).toContain("fixture-verified");
    expect(generated).toContain("deferred");
  });
});
