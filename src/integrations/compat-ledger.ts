/**
 * Upstream compatibility ledger generated from Keli inventory (provider-manifest.json
 * plus registered profiles). Does not claim live-verified when only fixtures exist.
 */
import { listByCategory, providerManifest, type ManifestRow } from "./manifest.ts";
import { getIntegration } from "./registry.ts";
import "./load.ts";

export type AdapterStatus = "implemented" | "fixture-verified" | "deferred";

export type CompatLedgerRow = {
  keliId: string;
  category: string;
  displayName: string;
  upstreamName: string;
  upstreamFile: string;
  license: string;
  pin: string;
  authMethod: string;
  modelDiscovery: string;
  endpointRules: string;
  adapterStatus: AdapterStatus;
};

export function adapterStatusFor(row: ManifestRow): AdapterStatus {
  if (row.status === "blocked" || row.status === "excluded" || row.runtimeAdapter === "none") return "deferred";
  if (row.protocol === "fixture-only" || row.id === "fixture") return "fixture-verified";
  return "implemented";
}

export function upstreamFileFor(row: ManifestRow): string {
  if (row.id === "chatgpt") return "src/integrations/chatgpt-auth.ts; src/model/chatgpt-provider.ts";
  if (row.id === "grok") return "src/integrations/profiles/model-provider/grok.ts";
  if (row.id === "openai-compatible") return "src/integrations/profiles/model-provider/openai-compatible.ts";
  if (row.id === "fixture") return "src/integrations/profiles/model-provider/fixture.ts";
  if (row.id === "nous" || row.id === "xai-oauth" || row.id === "minimax-oauth") {
    return "src/integrations/provider-device-oauth.ts (ADAPT hermes_cli/auth_device_flow.py, auth_nous.py, auth_xai.py, auth_minimax.py)";
  }
  if (row.id === "qwen-oauth") return "src/integrations/provider-oauth.ts (ADAPT hermes_cli/auth_qwen.py; read-only CLI link)";
  if (row.id === "copilot") return "src/integrations/provider-oauth.ts (ADOPT pi-ai GitHub Copilot OAuth)";
  if (row.id === "anthropic") return "src/integrations/auth.ts; src/integrations/catalog-provider.ts (ADAPT hermes_cli/model_setup_flows.py Anthropic auth choice)";
  if (opencodeLike(row.id)) {
    return "src/integrations/provider-behavior.ts (ADAPT hermes_cli/models.py OpenCode family tables)";
  }
  if (row.id === "azure-foundry") return "src/integrations/catalog-provider.ts (ADAPT hermes_cli/model_setup_flows_azure.py options)";
  if (row.id === "bedrock") return "src/integrations/catalog-provider.ts (ADAPT hermes_cli/model_setup_flows_bedrock.py region/profile)";
  if (row.id === "vertex") return "src/integrations/catalog-provider.ts (ADAPT Vertex project/location)";
  if (row.id === "custom" || row.id === "lmstudio") {
    return "src/integrations/catalog-provider.ts (ADAPT hermes_cli/model_setup_flows_custom.py keyless local)";
  }
  if (row.category === "model-provider" && row.origin === "hermes") {
    return "src/integrations/catalog-provider.ts; src/integrations/profiles/model-provider/catalog-providers.ts (ADAPT providers/base.py + hermes_cli/model_setup_flows.py)";
  }
  if (row.category === "search") return "src/adapters/search.ts; src/integrations/profiles/search/fixture.ts";
  if (row.id === "local-notes") return "src/memory/notes.ts; src/integrations/profiles/memory/local-notes.ts";
  if (row.id === "honcho") return "src/adapters/honcho.ts; src/integrations/profiles/memory/honcho.ts";
  if (row.category === "browser-backend") return "src/execution/browser-backends.ts; src/integrations/profiles/browser-backend/index.ts";
  if (row.category === "documents") return "src/adapters/documents.ts; src/integrations/profiles/documents/pdf.ts";
  if (row.category === "ocr") return "src/adapters/documents.ts; src/integrations/profiles/ocr/tesseract.ts";
  if (row.category === "speech") return "src/adapters/speech.ts; src/integrations/profiles/speech/openai-audio.ts";
  if (row.id === "discord") return "src/transports/discord-backend.ts";
  if (row.id === "telegram") return "src/transports/telegram.ts";
  if (row.id === "mcp") return "src/adapters/mcp.ts";
  if (row.id === "codex") return "src/adapters/delegate.ts; src/integrations/profiles/delegate/codex.ts";
  if (row.id === "opencode") return "src/integrations/profiles/delegate/opencode.ts";
  if (row.id === "copilot-acp-delegate") return "src/integrations/profiles/delegate/copilot-acp.ts";
  return getIntegration(row.id)?.reuse.upstream ?? "src/integrations/";
}

function opencodeLike(id: string): boolean {
  return id === "opencode-zen" || id === "opencode-go" || id === "opencode-free";
}

export function buildCompatLedger(): CompatLedgerRow[] {
  return listByCategory().map((row) => {
    const profile = getIntegration(row.id);
    return {
      keliId: row.id,
      category: row.category,
      displayName: row.displayName,
      upstreamName:
        row.origin === "hermes"
          ? providerManifest.attribution.hermes.upstream
          : row.origin === "nanobot"
            ? providerManifest.attribution.nanobot.upstream
            : profile?.reuse.upstream ?? "Keli",
      upstreamFile: upstreamFileFor(row),
      license: row.license,
      pin: String(row.sourceCommit),
      authMethod: row.authStrategy,
      modelDiscovery: row.modelDiscovery ?? (row.category === "model-provider" ? "none (enter or default)" : "n/a"),
      endpointRules: row.endpointDefaults ?? row.protocolNote ?? row.protocol,
      adapterStatus: adapterStatusFor(row),
    };
  });
}

export function renderCompatLedger(rows = buildCompatLedger()): string {
  const attr = providerManifest.attribution;
  const lines = [
    "# Upstream compatibility ledger",
    "",
    "Generated from Keli inventory (`src/integrations/provider-manifest.json` and registered",
    "profiles). Catalog membership is not a live connection. Adapter status is `implemented`",
    "(runtime adapter present), `fixture-verified` (deterministic fixtures), or `deferred`",
    "(blocked, excluded, or no runtime). Do not read `implemented` as live-verified.",
    "",
    `Hermes pin \`${attr.hermes.pin}\` (${attr.hermes.license}). Nanobot pin \`${attr.nanobot.pin}\` (${attr.nanobot.license}).`,
    `pi-ai ${attr.piAi.version} (${attr.piAi.license}). Reproduce: \`bun run scripts/write-compat-ledger.ts\`.`,
    "",
    "| Keli id | Upstream | Source | License / pin | Auth | Model discovery | Endpoint rules | Adapter |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(
      `| \`${row.keliId}\` | ${escapeCell(row.upstreamName)} | ${escapeCell(row.upstreamFile)} | ${escapeCell(`${row.license} / ${row.pin}`)} | ${escapeCell(row.authMethod)} | ${escapeCell(row.modelDiscovery)} | ${escapeCell(row.endpointRules)} | ${row.adapterStatus} |`,
    );
  }
  lines.push(
    "",
    "OpenCode hosted inference (`opencode-zen`, `opencode-go`, `opencode-free`) is adapted from",
    "Hermes's OpenCode family tables (`hermes_cli/models.py`), which themselves follow OpenCode's",
    "published Zen/Go endpoint routing. Keli does not depend on the OpenCode or Hermes runtimes.",
    "",
  );
  return lines.join("\n");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
