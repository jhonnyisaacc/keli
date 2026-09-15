#!/usr/bin/env bun
/**
 * Build the single portable provider manifest.
 *
 * Hermes inference rows live in provider-manifest.json (`hermesInference`). Optional
 * `KELI_HERMES_ROOT` may refresh that snapshot via an extractor that prints JSON to
 * stdout. Never write `hermes-catalog.json`. Nanobot is attribution-only.
 *
 * Usage: bun run scripts/import-provider-manifest.ts
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const HERMES_PIN = "93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544";
export const NANOBOT_PIN = "f49965445152361b779b465e8a5111549ac934c4";
export const PI_AI = "0.73.1";

export type ProtocolFamily =
  | "native-sdk"
  | "openai-compatible-http"
  | "openai-responses"
  | "anthropic-messages"
  | "other-http"
  | "oauth-external-cli"
  | "cloud-sdk"
  | "local-process"
  | "fixture-only"
  | "unsupported";

export type InventoryStatus = "catalogued" | "fixture-verified" | "blocked" | "excluded";

export type ProviderCategory =
  | "model-provider"
  | "search"
  | "memory"
  | "browser-backend"
  | "documents"
  | "ocr"
  | "speech"
  | "mcp-server"
  | "transport"
  | "delegate";

export type ManifestRow = {
  category: ProviderCategory;
  id: string;
  aliases: string[];
  displayName: string;
  authStrategy: string;
  protocol: ProtocolFamily;
  protocolNote?: string;
  endpointDefaults?: string;
  envVars?: string[];
  modelDiscovery?: string;
  options?: string[];
  runtimeAdapter: string;
  sourceCommit: string;
  license: string;
  status: InventoryStatus;
  prdIds: string[];
  origin: "hermes" | "keli" | "nanobot";
  apiMode?: string;
  defaultAuxModel?: string | null;
  fallbackModels?: string[];
};

type HermesRow = {
  name: string;
  display_name?: string;
  aliases?: string[];
  base_url?: string;
  env_vars?: string[];
  auth_type?: string;
  api_mode?: string;
  default_aux_model?: string | null;
  fallback_models?: string[];
};

const OAUTH_IDS = new Set(["nous", "copilot", "minimax-oauth", "xai-oauth", "qwen-oauth"]);
const SKIP_RUNTIME = new Set(["openai-codex", "grok", "copilot-acp", "moa"]);

function protocolOf(row: HermesRow): { protocol: ProtocolFamily; note?: string; adapter: string } {
  if (row.name === "moa") {
    return {
      protocol: "unsupported",
      note: "Mixture composition is not a model provider; opt-in gated capability later, never implicit fallback",
      adapter: "none",
    };
  }
  if (row.name === "copilot-acp") {
    return {
      protocol: "unsupported",
      note: "ACP agent process, not Chat Completions; keep as a gated delegate identity",
      adapter: "none",
    };
  }
  if (row.name === "openai-codex") {
    return {
      protocol: "oauth-external-cli",
      note: "ChatGPT inference is the Keli chatgpt profile; Codex app-server remains a delegate",
      adapter: "none",
    };
  }
  if (row.name === "grok") {
    return {
      protocol: "openai-compatible-http",
      note: "Hermes xAI catalog row is not the runtime; Keli grok is the A05 HTTP API-key override",
      adapter: "none",
    };
  }
  if (row.name === "bedrock" || row.auth_type === "aws_sdk" || row.api_mode === "bedrock_converse") {
    return { protocol: "cloud-sdk", note: "AWS credential chain, not an API key header", adapter: "SdkModelProvider" };
  }
  if (row.name === "vertex" || row.auth_type === "vertex") {
    return { protocol: "cloud-sdk", note: "Google ADC/project/location, not Gemini AI Studio", adapter: "SdkModelProvider" };
  }
  if (row.name === "gemini") {
    return { protocol: "native-sdk", note: "Google AI Studio native API, not Vertex", adapter: "SdkModelProvider" };
  }
  if (OAUTH_IDS.has(row.name)) {
    const note =
      row.name === "xai-oauth"
        ? "Subscription OAuth, distinct from grok API-key HTTP"
        : row.name === "qwen-oauth"
          ? "Read-only link to an existing Qwen CLI session, not a Keli OAuth client"
          : row.name === "copilot"
            ? "Copilot inference OAuth, distinct from copilot-acp"
            : undefined;
    return { protocol: "oauth-external-cli", note, adapter: "SdkModelProvider" };
  }
  if (row.name === "lmstudio") {
    return { protocol: "local-process", note: "Local OpenAI-compatible server, not a cloud account", adapter: "SdkModelProvider" };
  }
  if (row.api_mode === "anthropic_messages") {
    return {
      protocol: "anthropic-messages",
      note: row.name === "commandcode-anthropic" ? "Same host as commandcode but Anthropic Messages, not Chat Completions" : undefined,
      adapter: "SdkModelProvider",
    };
  }
  if (row.api_mode === "codex_responses") {
    return { protocol: "openai-responses", adapter: "SdkModelProvider" };
  }
  return { protocol: "openai-compatible-http", adapter: SKIP_RUNTIME.has(row.name) ? "none" : "SdkModelProvider" };
}

function authStrategyOf(row: HermesRow): string {
  if (row.name === "moa") return "none";
  if (row.name === "copilot-acp") return "external-cli";
  if (row.name === "bedrock") return "cloud-sdk";
  if (row.name === "vertex") return "cloud-sdk";
  if (OAUTH_IDS.has(row.name) || row.name === "openai-codex") return "oauth-device";
  if (["custom", "lmstudio", "opencode-free"].includes(row.name)) return "none";
  return row.auth_type === "api_key" || !row.auth_type ? "api-key" : row.auth_type.replaceAll("_", "-");
}

function inventoryStatus(row: HermesRow): InventoryStatus {
  if (row.name === "moa" || row.name === "copilot-acp" || row.name === "openai-codex" || row.name === "grok") {
    return "excluded";
  }
  return "catalogued";
}

function keliOwned(): ManifestRow[] {
  const hermes = HERMES_PIN;
  const keli = "in-tree";
  return [
    {
      category: "model-provider",
      id: "fixture",
      aliases: ["keli-fixture"],
      displayName: "Fixture provider",
      authStrategy: "none",
      protocol: "fixture-only",
      protocolNote: "Explicit test/dev only; never an implicit production default",
      runtimeAdapter: "FixtureModelProvider",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "fixture-verified",
      prdIds: ["A01"],
      origin: "keli",
      modelDiscovery: "fixed:keli-fixture",
    },
    {
      category: "model-provider",
      id: "openai-compatible",
      aliases: ["openai"],
      displayName: "OpenAI-compatible",
      authStrategy: "api-key",
      protocol: "openai-compatible-http",
      protocolNote: "Configurable endpoint; openai-api is the OpenAI platform catalog row",
      runtimeAdapter: "HttpModelProvider",
      sourceCommit: keli,
      license: "n/a",
      status: "fixture-verified",
      prdIds: ["I8"],
      origin: "keli",
      modelDiscovery: "GET /models",
    },
    {
      category: "model-provider",
      id: "grok",
      aliases: ["xai", "grok-build"],
      displayName: "Grok (xAI)",
      authStrategy: "api-key",
      protocol: "openai-compatible-http",
      protocolNote: "A05 HTTP API-key override; xai-oauth is the subscription path",
      endpointDefaults: "https://api.x.ai/v1",
      envVars: ["XAI_API_KEY"],
      runtimeAdapter: "HttpModelProvider",
      sourceCommit: hermes,
      license: "MIT",
      status: "fixture-verified",
      prdIds: ["A05"],
      origin: "keli",
      modelDiscovery: "GET /models",
    },
    {
      category: "model-provider",
      id: "chatgpt",
      aliases: ["chatgpt-account", "chatgpt-oauth", "openai-codex"],
      displayName: "ChatGPT account",
      authStrategy: "oauth-device",
      protocol: "oauth-external-cli",
      protocolNote: "Account inference via pi-ai; not Codex app-server delegation",
      endpointDefaults: "https://chatgpt.com/backend-api/codex",
      runtimeAdapter: "ChatGptModelProvider",
      sourceCommit: PI_AI,
      license: "MIT",
      status: "fixture-verified",
      prdIds: ["I8", "A25", "A35"],
      origin: "keli",
      modelDiscovery: "bundled suggestions",
    },
    {
      category: "model-provider",
      id: "claude-code",
      aliases: [],
      displayName: "Claude Code",
      authStrategy: "api-key",
      protocol: "anthropic-messages",
      protocolNote: "Named-later until release-pinned; not the anthropic catalog row",
      runtimeAdapter: "none",
      sourceCommit: keli,
      license: "n/a",
      status: "blocked",
      prdIds: ["I8"],
      origin: "keli",
    },
    {
      category: "model-provider",
      id: "antigravity",
      aliases: [],
      displayName: "Antigravity",
      authStrategy: "api-key",
      protocol: "openai-compatible-http",
      runtimeAdapter: "none",
      sourceCommit: keli,
      license: "n/a",
      status: "blocked",
      prdIds: ["I8"],
      origin: "keli",
    },
    {
      category: "search",
      id: "search",
      aliases: ["web-search"],
      displayName: "Search",
      authStrategy: "api-key",
      protocol: "other-http",
      protocolNote: "Brave GET /res/v1/web/search or generic JSON POST /search; extra vendors after protocol check",
      runtimeAdapter: "searchQuery",
      sourceCommit: keli,
      license: "n/a",
      status: "fixture-verified",
      prdIds: ["I9"],
      origin: "keli",
    },
    {
      category: "memory",
      id: "local-notes",
      aliases: ["notes"],
      displayName: "Local notes (FTS)",
      authStrategy: "none",
      protocol: "local-process",
      runtimeAdapter: "notes.ts",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "fixture-verified",
      prdIds: ["I1", "A29"],
      origin: "keli",
    },
    {
      category: "memory",
      id: "honcho",
      aliases: ["dialectic"],
      displayName: "Honcho",
      authStrategy: "api-key",
      protocol: "other-http",
      protocolNote: "Fixture path only until a stable HTTP contract is verified; not a second authority",
      runtimeAdapter: "honcho.ts",
      sourceCommit: NANOBOT_PIN,
      license: "MIT",
      status: "blocked",
      prdIds: ["A29", "I1"],
      origin: "nanobot",
    },
    {
      category: "browser-backend",
      id: "browser-fixture",
      aliases: ["browser"],
      displayName: "Browser fixture",
      authStrategy: "none",
      protocol: "fixture-only",
      runtimeAdapter: "browser-backends.ts",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "fixture-verified",
      prdIds: ["I9"],
      origin: "keli",
    },
    {
      category: "browser-backend",
      id: "browser-playwright",
      aliases: ["playwright"],
      displayName: "Playwright",
      authStrategy: "none",
      protocol: "local-process",
      protocolNote: "Optional binary; missing install is blocked not a hidden dependency",
      runtimeAdapter: "browser-backends.ts",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "catalogued",
      prdIds: ["I9"],
      origin: "keli",
    },
    {
      category: "browser-backend",
      id: "browser-cdp",
      aliases: ["cdp"],
      displayName: "CDP",
      authStrategy: "local-endpoint",
      protocol: "other-http",
      runtimeAdapter: "browser-backends.ts",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "catalogued",
      prdIds: ["I9"],
      origin: "keli",
    },
    {
      category: "browser-backend",
      id: "browser-mcp",
      aliases: ["mcp"],
      displayName: "Browser MCP",
      authStrategy: "none",
      protocol: "other-http",
      runtimeAdapter: "browser-backends.ts",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "catalogued",
      prdIds: ["I9"],
      origin: "keli",
    },
    {
      category: "mcp-server",
      id: "mcp",
      aliases: ["modelcontextprotocol"],
      displayName: "MCP",
      authStrategy: "none",
      protocol: "other-http",
      protocolNote: "JSON-RPC HTTP or owned stdio; tools/call requires a prior tools/list schema check",
      runtimeAdapter: "mcp.ts",
      sourceCommit: keli,
      license: "MIT",
      status: "fixture-verified",
      prdIds: ["A41", "A42"],
      origin: "keli",
    },
    {
      category: "transport",
      id: "discord",
      aliases: ["discord.js"],
      displayName: "Discord",
      authStrategy: "token",
      protocol: "other-http",
      protocolNote: "Discord REST v10; discord.js is not wired",
      runtimeAdapter: "discord-backend.ts",
      sourceCommit: keli,
      license: "n/a",
      status: "fixture-verified",
      prdIds: ["A17", "A18"],
      origin: "keli",
    },
    {
      category: "transport",
      id: "telegram",
      aliases: ["grammy", "grammY"],
      displayName: "Telegram",
      authStrategy: "token",
      protocol: "other-http",
      protocolNote: "Telegram Bot API; grammY is not wired",
      runtimeAdapter: "telegram-backend.ts",
      sourceCommit: keli,
      license: "n/a",
      status: "fixture-verified",
      prdIds: ["A17", "A18"],
      origin: "keli",
    },
    {
      category: "delegate",
      id: "codex",
      aliases: [],
      displayName: "Codex CLI",
      authStrategy: "external-cli",
      protocol: "local-process",
      protocolNote: "App-server coding delegate, not ChatGPT inference",
      runtimeAdapter: "codex-app-server.ts",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "fixture-verified",
      prdIds: ["A19", "A20", "A24", "A37"],
      origin: "keli",
    },
    {
      category: "delegate",
      id: "opencode",
      aliases: ["open-code"],
      displayName: "OpenCode CLI",
      authStrategy: "external-cli",
      protocol: "local-process",
      protocolNote: "ACP coding delegate, distinct from opencode-zen inference. Fixture or ACP handshake required.",
      runtimeAdapter: "none",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "blocked",
      prdIds: ["A19", "A20", "A37"],
      origin: "keli",
    },
    {
      category: "delegate",
      id: "copilot-acp-delegate",
      aliases: ["copilot-acp-agent"],
      displayName: "GitHub Copilot ACP",
      authStrategy: "oauth-external-cli",
      protocol: "oauth-external-cli",
      protocolNote: "ACP coding delegate; distinct from Copilot Chat Completions. Child completion without artifacts stays unverified.",
      runtimeAdapter: "delegateRun",
      sourceCommit: keli,
      license: "n/a",
      status: "blocked",
      prdIds: ["A19", "A20", "A37"],
      origin: "keli",
    },
    {
      category: "documents",
      id: "documents-pdf",
      aliases: ["pdf"],
      displayName: "PDF text extraction",
      authStrategy: "none",
      protocol: "local-process",
      runtimeAdapter: "documentsExtract",
      sourceCommit: keli,
      license: "Apache-2.0 (wrapper); no npm PDF parser adopted",
      status: "fixture-verified",
      prdIds: ["I9"],
      origin: "keli",
      protocolNote: "Uncompressed PDF strings in-process; optional pdftotext. No third-party PDF library until license/API is verified.",
    },
    {
      category: "ocr",
      id: "ocr-tesseract",
      aliases: ["tesseract"],
      displayName: "Tesseract OCR",
      authStrategy: "none",
      protocol: "local-process",
      runtimeAdapter: "ocrExtract",
      sourceCommit: keli,
      license: "Apache-2.0",
      status: "fixture-verified",
      prdIds: ["I9"],
      origin: "keli",
      protocolNote: "Optional tesseract binary; missing install is typed unavailable, not a CI dependency",
    },
    {
      category: "speech",
      id: "speech-transcribe",
      aliases: ["stt"],
      displayName: "Speech transcription",
      authStrategy: "api-key",
      protocol: "openai-compatible-http",
      runtimeAdapter: "speechTranscribe",
      sourceCommit: keli,
      license: "n/a",
      status: "fixture-verified",
      prdIds: ["I9"],
      origin: "keli",
      protocolNote: "OpenAI-compatible POST /audio/transcriptions; fixture proves request shape",
    },
    {
      category: "speech",
      id: "speech-synthesize",
      aliases: ["tts"],
      displayName: "Speech synthesis",
      authStrategy: "api-key",
      protocol: "openai-compatible-http",
      protocolNote: "Optional OpenAI-compatible POST /audio/speech; full TTS plugin zoo excluded",
      runtimeAdapter: "speechSynthesize",
      sourceCommit: keli,
      license: "n/a",
      status: "fixture-verified",
      prdIds: ["I9"],
      origin: "keli",
    },
  ];
}

function fromHermes(row: HermesRow): ManifestRow {
  const mapped = protocolOf(row);
  return {
    category: "model-provider",
    id: row.name,
    aliases: row.aliases ?? [],
    displayName: row.display_name ?? row.name,
    authStrategy: authStrategyOf(row),
    protocol: mapped.protocol,
    protocolNote: mapped.note,
    endpointDefaults: row.base_url,
    envVars: row.env_vars,
    modelDiscovery: mapped.adapter === "SdkModelProvider" ? "pi-ai getModels plus fallback_models" : undefined,
    options: row.name === "azure-foundry" ? ["deployment", "apiMode", "apiVersion"] : row.name === "bedrock" ? ["region", "profile"] : row.name === "vertex" ? ["project", "location"] : undefined,
    runtimeAdapter: mapped.adapter,
    sourceCommit: HERMES_PIN,
    license: "MIT",
    status: inventoryStatus(row),
    prdIds: ["I8", "A05", "A25", "A35"],
    origin: "hermes",
    apiMode: row.api_mode,
    defaultAuxModel: row.default_aux_model,
    fallbackModels: row.fallback_models,
  };
}

function loadHermesRows(root: string): HermesRow[] {
  const manifestPath = join(root, "src/integrations/provider-manifest.json");
  if (!existsSync(manifestPath)) throw new Error("provider-manifest.json missing; it is the only inventory");
  const existing = JSON.parse(readFileSync(manifestPath, "utf8")) as { hermesInference?: HermesRow[] };
  const hermesRoot = process.env.KELI_HERMES_ROOT;
  if (hermesRoot) {
    const extractor = join(root, "scripts/extract-hermes-inference.py");
    if (!existsSync(extractor)) {
      if (!existing.hermesInference?.length) {
        throw new Error("Hermes extractor missing; keep hermesInference inside provider-manifest.json");
      }
    } else {
      const result = spawnSync("python3", [extractor, hermesRoot], { encoding: "utf8" });
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || "Hermes extract failed");
      }
      const rows = JSON.parse(result.stdout) as HermesRow[];
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("Hermes extractor returned no rows");
      return rows;
    }
  }
  if (!existing.hermesInference?.length) {
    throw new Error("hermesInference snapshot missing from provider-manifest.json");
  }
  return existing.hermesInference;
}

export function buildManifest(root = process.cwd()) {
  const hermesRows = loadHermesRows(root);
  const ownedIds = new Set(keliOwned().map((row) => row.id));
  const providers = [
    ...hermesRows.map(fromHermes).filter((row) => !ownedIds.has(row.id)),
    ...keliOwned(),
  ];
  return {
    attribution: {
      hermes: { upstream: "NousResearch/hermes-agent", pin: HERMES_PIN, license: "MIT" },
      nanobot: { upstream: "HKUDS/nanobot", pin: NANOBOT_PIN, license: "MIT" },
      piAi: { package: "@mariozechner/pi-ai", version: PI_AI, license: "MIT" },
    },
    hermesInference: hermesRows,
    providers,
  };
}

const isMain = import.meta.main;
if (isMain) {
  const root = process.cwd();
  const manifest = buildManifest(root);
  const out = join(root, "src/integrations/provider-manifest.json");
  await Bun.write(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.providers.length} rows to src/integrations/provider-manifest.json`);
}
