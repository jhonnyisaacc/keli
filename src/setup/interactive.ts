import { addCredential } from "../integrations/auth.ts";
import { catalogModels } from "../integrations/catalog-provider.ts";
import { getIntegration } from "../integrations/registry.ts";
import { runLiveProbe } from "../integrations/live-probe.ts";
import type { KeliConfig } from "../state/config.ts";
import { writeConfig } from "../state/config.ts";
import type { WizardIo } from "./io.ts";
import { formatProviderChoice, providersForCategory, SETUP_CATEGORIES, type SetupCategory } from "./categories.ts";

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
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error("Choose a listed number, or skip");
  return n;
}

async function configureModelProvider(io: WizardIo, config: KeliConfig, id: string, stateDir: string): Promise<void> {
  const profile = getIntegration(id);
  if (!profile || profile.availability === "named-later") throw new Error(`Provider '${id}' is not implemented`);
  const entry = config.integrations?.[id] ?? { enabled: true, settings: {} };
  const models = catalogModels(id);
  if (models.length) io.println(`Suggested models: ${models.slice(0, 12).join(", ")} (other model IDs accepted)`);
  const currentModel = entry.settings.model ?? profile.defaultModels?.[0] ?? "";
  const chosen = (await io.question(`Model for ${profile.displayName} [${currentModel}]: `)) || currentModel;
  if (!chosen) throw new Error(`A model is required for ${id}`);
  entry.settings = { ...entry.settings, model: chosen };
  for (const setting of profile.settings.filter((p) => !p.secret && p.key !== "model")) {
    const current = entry.settings[setting.key] ?? (setting.key === "baseUrl" ? profile.baseUrl : setting.default) ?? "";
    const value = (await io.question(`${setting.label} [${current}]: `)) || current;
    if (!value && setting.required) throw new Error(`${setting.label} is required for ${id}`);
    if (value) entry.settings[setting.key] = value;
  }
  entry.enabled = true;
  config.integrations = { ...config.integrations, [id]: entry };
  await writeConfig(config, stateDir);
  if (id === "chatgpt") {
    if (!config.integrations?.chatgpt?.credentialRef) {
      const { codexAccessToken } = await import("../integrations/chatgpt-auth.ts");
      let linked = false;
      try { await codexAccessToken(); linked = true; } catch { /* independent login */ }
      const useExisting = linked && !(await io.question("Use your existing Codex ChatGPT login? [Y/n]: ")).toLowerCase().startsWith("n");
      await addCredential("chatgpt", {
        stateDir,
        type: useExisting ? "external-cli" : "oauth-device",
        oauthCallbacks: {
          onAuth: ({ url, instructions }) => { io.println(`Sign in in your browser: ${url}`); if (instructions) io.println(instructions); },
          onPrompt: ({ message }) => io.question(`${message}`),
        },
      });
    }
    return;
  }
  if (!entry.credentialRef && profile.auth.type !== "none" && profile.auth.type !== "external-cli") {
    let type = profile.auth.type;
    if (id === "anthropic" && (await io.question("Authentication: API key or account login? [api-key/account]: ")) === "account") type = "oauth-device";
    let value: string | undefined;
    if (type === "api-key" || type === "token") value = await io.secret(`Credential for ${profile.displayName} (hidden): `);
    await addCredential(id, {
      stateDir,
      type,
      value,
      oauthCallbacks: {
        onAuth: ({ url, instructions }) => { io.println(`Sign in: ${url}`); if (instructions) io.println(instructions); },
        onPrompt: ({ message }) => io.question(message),
      },
    });
  }
}

async function configureCategory(
  io: WizardIo,
  category: SetupCategory,
  config: KeliConfig,
  stateDir: string,
  draft: InteractiveDraft,
  allowFixture: boolean,
): Promise<void> {
  if (category.id === "service") {
    io.println("Background execution is a lifecycle command, not a provider.");
    io.println("Run `keli service install` then `keli service status` after setup.");
    return;
  }
  const rows = providersForCategory(category, config, allowFixture);
  io.println("");
  io.println(category.label);
  io.println("0. Skip");
  rows.forEach((row, i) => io.println(formatProviderChoice(i + 1, row, config, allowFixture)));
  const picked = await pickNumber(io, `Select ${category.label} provider [0]: `, rows.length);
  if (!picked) return;
  const row = rows[picked - 1]!;
  if (row.status === "blocked") {
    io.println(`${row.displayName} is blocked until its protocol, binary, or access is available.`);
    return;
  }
  if (category.id === "models") {
    await configureModelProvider(io, config, row.id, stateDir);
    draft.primaryModel = row.id;
    const probe = await runLiveProbe({ config, only: [row.id], timeoutMs: row.id === "chatgpt" ? 30_000 : 8000 });
    const line = probe.lines.find((l) => l.id === row.id);
    io.println(line?.outcome === "pass" ? `Connected: ${line.detail}` : `Not connected: ${line?.detail ?? "probe failed"}`);
    return;
  }
  if (category.id === "search") {
    const current = config.integrations?.search?.settings.baseUrl ?? "";
    const endpoint = (await io.question(`Search endpoint (Brave or generic JSON) [${current}]: `)) || current;
    if (endpoint) draft.searchEndpoint = endpoint;
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
    const cal = await io.question("Skip optional calibration for now? [Y/n]: ");
    draft.skipCalibration = !cal || cal.toLowerCase().startsWith("y");
    return;
  }
  if (category.id === "delegates") {
    if (row.id === "mcp") {
      draft.mcpUrl = (await io.question(`MCP HTTP URL [${draft.mcpUrl ?? ""}]: `)) || draft.mcpUrl;
      draft.mcpCommand = (await io.question(`MCP stdio command [${draft.mcpCommand ?? ""}]: `)) || draft.mcpCommand;
      return;
    }
    if (row.id === "codex" || row.id === "opencode") {
      const command = (await io.question(`CLI binary [${row.id}]: `)) || row.id;
      const entry = config.integrations?.[row.id] ?? { enabled: true, settings: {} };
      entry.enabled = true;
      entry.settings = { ...entry.settings, command };
      config.integrations = { ...config.integrations, [row.id]: entry };
      await writeConfig(config, stateDir);
    }
    return;
  }
  if (category.id === "memory") {
    draft.memoryProvider = row.id;
    config.memory = { ...config.memory, provider: row.id };
    await writeConfig(config, stateDir);
    return;
  }
  if (category.manifestCategory === "mcp-server" || category.id === "delegates") {
    draft.mcpUrl = (await io.question(`MCP HTTP URL [${draft.mcpUrl ?? ""}]: `)) || draft.mcpUrl;
    draft.mcpCommand = (await io.question(`MCP stdio command [${draft.mcpCommand ?? ""}]: `)) || draft.mcpCommand;
  }
}

export async function runInteractiveCategories(
  io: WizardIo,
  config: KeliConfig,
  stateDir: string,
  draft: InteractiveDraft,
  allowFixture: boolean,
  only?: SetupCategory["id"],
): Promise<void> {
  const categories = only ? SETUP_CATEGORIES.filter((c) => c.id === only) : SETUP_CATEGORIES;
  let index = 0;
  while (index < categories.length) {
    if (!only) {
      io.println("");
      io.println("Select a category to configure:");
      io.println("0. Finish");
      categories.forEach((c, i) => io.println(`${i + 1}. ${c.label}`));
      const picked = await pickNumber(io, "Category number [0]: ", categories.length);
      if (!picked) break;
      await configureCategory(io, categories[picked - 1]!, config, stateDir, draft, allowFixture);
      const more = await io.question("Configure another category? [y/N]: ");
      if (!more.toLowerCase().startsWith("y")) break;
    } else {
      await configureCategory(io, categories[0]!, config, stateDir, draft, allowFixture);
      break;
    }
    index += 1;
  }
}

export function sectionToCategory(section?: string): SetupCategory["id"] | undefined {
  if (section === "provider") return "models";
  if (section === "transport") return "messaging";
  if (section === "search") return "search";
  if (section === "mcp") return "delegates";
  if (section === "delegate") return "delegates";
  if (section === "memory") return "memory";
  return undefined;
}
