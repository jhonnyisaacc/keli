import { getIntegration } from "../integrations/registry.ts";
import { BRAVE_SEARCH_URL, authFlowType, isLoopbackUrl, requiresBaseUrlPrompt } from "../integrations/provider-behavior.ts";
import type { KeliConfig } from "../state/config.ts";
import { readConfig, writeConfig } from "../state/config.ts";
import type { WizardIo } from "./io.ts";
import {
  OPTIONAL_CATEGORIES,
  formatProviderChoice,
  moreModelProviders,
  providersForCategory,
  SETUP_CATEGORIES,
  setupBadge,
  type SetupCategory,
} from "./categories.ts";
import type { ManifestRow } from "../integrations/manifest.ts";
import { authenticateIntegration, configureModel, connectIntegration, persistIntegration } from "./flows.ts";

export type InteractiveDraft = {
  primaryModel?: string;
  fallbackModel?: string;
  transport?: "discord" | "telegram" | "none";
  discordChannel?: string;
  discordThread?: string;
  telegramChat?: string;
  telegramTopic?: string;
  searchEndpoint?: string;
  mcpUrl?: string;
  mcpCommand?: string;
  skipCalibration?: boolean;
  memoryProvider?: string;
};

async function pickNumber(io: WizardIo, prompt: string, max: number): Promise<number | undefined> {
  const answer = await io.question(prompt);
  if (!answer || answer.toLowerCase() === "s" || answer.toLowerCase() === "skip") return undefined;
  const n = Number(answer);
  if (n === 0) return undefined;
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error("Choose a listed number, or skip");
  return n;
}

/** addCredential writes the ref to disk; probes use this object, so reload before live-check. */
export async function syncIntegrationFromDisk(config: KeliConfig, stateDir: string, id: string): Promise<void> {
  const persisted = await readConfig(stateDir);
  const saved = persisted?.integrations?.[id];
  if (!saved) return;
  config.integrations = { ...config.integrations, [id]: { ...config.integrations?.[id], ...saved } };
}

function oauthCallbacks(io: WizardIo) {
  return {
    onAuth: ({ url, instructions }: { url: string; instructions?: string }) => {
      io.println(`Sign in: ${url}`);
      if (instructions) io.println(instructions);
    },
    onPrompt: ({ message }: { message: string }) => io.question(message),
  };
}

async function configureModelProvider(io: WizardIo, config: KeliConfig, id: string, stateDir: string, advanced = false): Promise<void> {
  const profile = getIntegration(id);
  if (!profile || profile.availability === "named-later") throw new Error(`Provider '${id}' is not implemented`);
  let type = authFlowType(id);
  if (requiresBaseUrlPrompt(id) && !advanced) {
    const current = config.integrations?.[id]?.settings.baseUrl ?? profile.baseUrl ?? "";
    const typed = await io.question(`Base URL [${current}]: `);
    const baseUrl = typed || current;
    if (baseUrl) await persistIntegration({ config, stateDir, id, settings: { baseUrl } });
  }
  const loopback = isLoopbackUrl(config.integrations?.[id]?.settings.baseUrl ?? profile.baseUrl ?? "");
  if (id === "chatgpt" && !config.integrations?.[id]?.credentialRef) {
    io.println("1. New ChatGPT login");
    io.println("2. Existing Codex CLI");
    const picked = await pickNumber(io, "ChatGPT sign-in [1]: ", 2);
    if (picked === 2) type = "external-cli";
    else type = "oauth-device";
  } else if (id === "anthropic" && !config.integrations?.[id]?.credentialRef) {
    io.println("1. API key");
    io.println("2. Account login");
    const picked = await pickNumber(io, "Anthropic authentication [1]: ", 2);
    if (picked === 2) type = "oauth-device";
    else type = "api-key";
  } else if (type === "api-key" && loopback) {
    type = "keyless";
  }
  const auth = await authenticateIntegration({
    integrationId: id,
    stateDir,
    config,
    io,
    type,
    oauthCallbacks: oauthCallbacks(io),
    retryOnCancel: true,
  });
  if (!auth.ok) {
    io.println(auth.cancelled ? "Cancelled." : auth.error.message);
    if (auth.cancelled) return;
    throw auth.error;
  }
  const model = await configureModel({
    integrationId: id,
    stateDir,
    config,
    io,
    advanced,
  });
  if (!model.ok) {
    io.println(model.cancelled ? "Cancelled." : model.error.message);
    if (model.cancelled) return;
    throw model.error;
  }
  io.println(model.probe.ok ? `Connected: ${model.probe.detail}` : `Not connected: ${model.probe.detail}`);
}

async function configureSearch(io: WizardIo, config: KeliConfig, stateDir: string, draft: InteractiveDraft): Promise<void> {
  io.println("Search backends: Brave (API key) or generic JSON POST /search.");
  io.println("0. Skip");
  io.println("1. Brave Search");
  io.println("2. Generic JSON");
  const picked = await pickNumber(io, "Select search backend [0]: ", 2);
  if (!picked) return;
  if (picked === 1) {
    await persistIntegration({
      config,
      stateDir,
      id: "search",
      settings: { baseUrl: BRAVE_SEARCH_URL },
    });
    const auth = await authenticateIntegration({
      integrationId: "search",
      stateDir,
      config,
      io,
      type: "api-key",
    });
    io.println(auth.ok ? (auth.probe.ok ? `Connected: ${auth.probe.detail}` : `Not connected: ${auth.probe.detail}`) : auth.error.message);
    draft.searchEndpoint = BRAVE_SEARCH_URL;
    return;
  }
  const current = config.integrations?.search?.settings.baseUrl ?? "";
  const endpoint = (await io.question(`Search endpoint (generic JSON) [${current}]: `)) || current;
  if (!endpoint) return;
  draft.searchEndpoint = endpoint;
  await persistIntegration({ config, stateDir, id: "search", settings: { baseUrl: endpoint } });
  const result = await connectIntegration({ integrationId: "search", stateDir, config, io, values: { baseUrl: endpoint } });
  if (result.ok) io.println(result.probe.ok ? `Connected: ${result.probe.detail}` : `Not connected: ${result.probe.detail}`);
}

async function configureSelectedProvider(
  io: WizardIo,
  category: SetupCategory,
  row: ManifestRow,
  config: KeliConfig,
  stateDir: string,
): Promise<void> {
  const result = await connectIntegration({
    integrationId: row.id,
    stateDir,
    config,
    io,
    advanced: true,
    oauthCallbacks: oauthCallbacks(io),
  });
  if (!result.ok) {
    io.println(result.cancelled ? "Cancelled." : result.error.message);
    return;
  }
  if (category.id === "browser" && row.id.startsWith("browser-")) {
    const kind = row.id.slice("browser-".length);
    if (kind === "fixture" || kind === "playwright" || kind === "cdp" || kind === "mcp") {
      config.browser = { ...config.browser, primary: kind };
      await writeConfig(config, stateDir);
    }
  }
}

async function configureCategory(
  io: WizardIo,
  category: SetupCategory,
  config: KeliConfig,
  stateDir: string,
  draft: InteractiveDraft,
  allowFixture: boolean,
  advanced = false,
): Promise<void> {
  if (category.id === "service") {
    io.println("Background execution is a lifecycle command, not a provider.");
    io.println("Run `keli service install` then `keli service status` after setup.");
    return;
  }
  if (category.id === "search") {
    await configureSearch(io, config, stateDir, draft);
    return;
  }
  const row = category.id === "models"
    ? await pickModelProvider(io, config, allowFixture)
    : await pickCategoryProvider(io, category, config, allowFixture);
  if (!row) return;
  if (row.status === "blocked" || setupBadge(row, config, allowFixture) === "blocked") {
    io.println(`${row.displayName} is blocked until its protocol, binary, or access is available.`);
    return;
  }
  if (category.id === "models") {
    await configureModelProvider(io, config, row.id, stateDir, advanced);
    draft.primaryModel = row.id;
    return;
  }
  if (category.id === "messaging") {
    if (row.id === "discord") {
      draft.transport = "discord";
      draft.discordChannel = (await io.question(`Discord channel id [${draft.discordChannel ?? ""}]: `)) || draft.discordChannel;
      draft.discordThread = (await io.question(`Discord thread id (optional) [${draft.discordThread ?? ""}]: `)) || draft.discordThread;
    } else {
      draft.transport = "telegram";
      draft.telegramChat = (await io.question(`Telegram chat id [${draft.telegramChat ?? ""}]: `)) || draft.telegramChat;
      draft.telegramTopic = (await io.question(`Telegram topic id (optional) [${draft.telegramTopic ?? ""}]: `)) || draft.telegramTopic;
    }
    await connectIntegration({ integrationId: row.id, stateDir, config, io, oauthCallbacks: oauthCallbacks(io) });
    const cal = await io.question("Skip optional calibration for now? [Y/n]: ");
    draft.skipCalibration = !cal || cal.toLowerCase().startsWith("y");
    return;
  }
  if (category.id === "delegates") {
    if (row.id === "mcp") {
      draft.mcpUrl = (await io.question(`MCP HTTP URL [${draft.mcpUrl ?? ""}]: `)) || draft.mcpUrl;
      draft.mcpCommand = (await io.question(`MCP stdio command [${draft.mcpCommand ?? ""}]: `)) || draft.mcpCommand;
      await persistIntegration({
        config,
        stateDir,
        id: "mcp",
        settings: {
          ...(draft.mcpUrl ? { url: draft.mcpUrl, transport: "http" } : {}),
          ...(draft.mcpCommand ? { command: draft.mcpCommand, transport: "stdio" } : {}),
        },
      });
      const probe = await connectIntegration({ integrationId: "mcp", stateDir, config, io, values: config.integrations?.mcp?.settings });
      if (probe.ok) io.println(probe.probe.ok ? `Connected: ${probe.probe.detail}` : `Not connected: ${probe.probe.detail}`);
      return;
    }
    await connectIntegration({ integrationId: row.id, stateDir, config, io });
    return;
  }
  if (category.id === "memory") {
    draft.memoryProvider = row.id;
    config.memory = { ...config.memory, provider: row.id };
    await writeConfig(config, stateDir);
    const result = await connectIntegration({ integrationId: row.id, stateDir, config, io, oauthCallbacks: oauthCallbacks(io) });
    if (result.ok) io.println(result.probe.ok ? `Connected: ${result.probe.detail}` : `Not connected: ${result.probe.detail}`);
    return;
  }
  await configureSelectedProvider(io, category, row, config, stateDir);
}

export async function runBootstrapModel(
  io: WizardIo,
  config: KeliConfig,
  stateDir: string,
  draft: InteractiveDraft,
  allowFixture: boolean,
): Promise<void> {
  io.println("");
  io.println("Connect one conversation model, then chat. Optional tools: keli connect");
  const row = await pickModelProvider(io, config, allowFixture);
  if (!row) return;
  if (row.status === "blocked" || setupBadge(row, config, allowFixture) === "blocked") {
    io.println(`${row.displayName} is blocked until its protocol, binary, or access is available.`);
    return;
  }
  await configureModelProvider(io, config, row.id, stateDir, false);
  draft.primaryModel = row.id;
  io.println("Run `keli chat` to start. Optional integrations: `keli connect`.");
}

export async function runInteractiveCategories(
  io: WizardIo,
  config: KeliConfig,
  stateDir: string,
  draft: InteractiveDraft,
  allowFixture: boolean,
  only?: SetupCategory["id"],
): Promise<void> {
  const categories = only
    ? SETUP_CATEGORIES.filter((c) => c.id === only)
    : OPTIONAL_CATEGORIES;
  if (!only) {
    io.println("");
    io.println("Optional connections. Chat/Models is configured by `keli setup`.");
  }
  let index = 0;
  while (index < categories.length) {
    if (!only) {
      io.println("");
      io.println("Select a category to configure:");
      io.println("0. Finish");
      categories.forEach((c, i) => io.println(`${i + 1}. ${c.label}`));
      const picked = await pickNumber(io, "Category number [0]: ", categories.length);
      if (!picked) break;
      await configureCategory(io, categories[picked - 1]!, config, stateDir, draft, allowFixture, true);
      const more = await io.question("Configure another category? [y/N]: ");
      if (!more.toLowerCase().startsWith("y")) break;
    } else {
      await configureCategory(io, categories[0]!, config, stateDir, draft, allowFixture, only !== "models");
      break;
    }
    index += 1;
  }
}

async function pickCategoryProvider(
  io: WizardIo,
  category: SetupCategory,
  config: KeliConfig,
  allowFixture: boolean,
): Promise<ManifestRow | undefined> {
  const rows = providersForCategory(category, config, allowFixture);
  io.println("");
  io.println(category.label);
  io.println("0. Skip");
  rows.forEach((row, i) => io.println(formatProviderChoice(i + 1, row, config, allowFixture)));
  const picked = await pickNumber(io, `Select ${category.label} provider [0]: `, rows.length);
  if (!picked) return undefined;
  return rows[picked - 1];
}

async function pickModelProvider(
  io: WizardIo,
  config: KeliConfig,
  allowFixture: boolean,
): Promise<ManifestRow | undefined> {
  const shortlist = providersForCategory(SETUP_CATEGORIES.find((c) => c.id === "models")!, config, allowFixture);
  const more = moreModelProviders(allowFixture);
  io.println("");
  io.println("Chat/Models");
  io.println("Recommended");
  io.println("0. Skip");
  shortlist.forEach((row, i) => io.println(formatProviderChoice(i + 1, row, config, allowFixture)));
  const moreChoice = more.length ? shortlist.length + 1 : 0;
  if (moreChoice) io.println(`${moreChoice}. More providers`);
  const picked = await pickNumber(io, "Select Chat/Models provider [0]: ", moreChoice || shortlist.length);
  if (!picked) return undefined;
  if (moreChoice && picked === moreChoice) {
    io.println("");
    io.println("More providers");
    io.println("0. Back");
    more.forEach((row, i) => io.println(formatProviderChoice(i + 1, row, config, allowFixture)));
    const morePicked = await pickNumber(io, "Select provider [0]: ", more.length);
    if (!morePicked) return undefined;
    return more[morePicked - 1];
  }
  return shortlist[picked - 1];
}

export function sectionToCategory(section?: string): SetupCategory["id"] | undefined {
  if (section === "provider") return "models";
  if (section === "transport") return "messaging";
  if (section === "search") return "search";
  if (section === "mcp") return "delegates";
  if (section === "delegate") return "delegates";
  if (section === "memory") return "memory";
  if (section === "browser") return "browser";
  if (section === "documents") return "documents";
  if (section === "speech") return "speech";
  return undefined;
}
