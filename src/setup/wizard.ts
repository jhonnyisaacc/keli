import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { initializeState } from "../state/init.ts";
import { DEFAULT_PROJECT_NAME } from "../state/defaults.ts";
import { readConfig, writeConfig, type KeliConfig } from "../state/config.ts";
import { projectScope, getProjectById } from "../state/repos.ts";
import { bindTransportRoute } from "../transports/routes.ts";
import { sendDiscordMessage } from "../transports/discord.ts";
import { resolveDiscordBackend } from "../transports/discord-resolve.ts";
import { sendTelegramMessage } from "../transports/telegram.ts";
import { resolveTelegramBackend } from "../transports/telegram-resolve.ts";
import { getIntegration, listIntegrations, probeIntegration } from "../integrations/registry.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { runLiveProbe } from "../integrations/live-probe.ts";
import { FIRST_USE_PROVIDERS, FIRST_USE_STATUS_IDS } from "../integrations/first-use.ts";
import { confirmPairing, issuePairingCode, pairingAccepts, pairingExpiresAt, pairingPhrase } from "../transports/pairing.ts";
import "../integrations/load.ts";

export type SetupSection = "provider" | "transport" | "delegate" | "memory" | "mcp" | "search";

export type SetupOptions = {
  stateDir?: string;
  cwd?: string;
  nonInteractive?: boolean;
  transport?: "discord" | "telegram" | "none";
  discordChannel?: string;
  discordThread?: string;
  telegramChat?: string;
  telegramTopic?: string;
  primaryModel?: string;
  fallbackModel?: string;
  skipCalibration?: boolean;
  skipTransportTest?: boolean;
  searchEndpoint?: string;
  mcpUrl?: string;
  mcpCommand?: string;
  pairingCode?: string;
  pairingActorId?: string;
  section?: SetupSection;
  quick?: boolean;
  minimal?: boolean;
  projectName?: string;
};

export type SetupResult = {
  stateDir: string;
  transport: "discord" | "telegram" | "none";
  routeBound: boolean;
  transportTested: boolean;
  calibrationSkipped: boolean;
  providerConnected: boolean;
  searchConnected: boolean;
  pairingVerified: boolean;
  pairingPending: boolean;
  projectName: string;
};

function explain(lines: string[]): void {
  for (const line of lines) console.log(line);
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  let projectName = options.projectName?.trim();
  if (!options.nonInteractive && !projectName) {
    const rl = readline.createInterface({ input, output });
    try {
      const answer = await rl.question(`Project name [${DEFAULT_PROJECT_NAME}]: `);
      if (answer.trim()) projectName = answer.trim();
    } finally {
      rl.close();
    }
  }
  const init = await initializeState(options.stateDir, {
    cwd: options.cwd,
    projectName: projectName || DEFAULT_PROJECT_NAME,
  });
  projectName = init.projectName;
  const stateDir = init.stateDir;
  const existing = (await readConfig(stateDir)) ?? {
    version: 2,
    ownerId: init.ownerId,
    defaultProjectId: init.projectId,
  };
  const returning = Boolean(existing.setup?.completedAt);
  const quick = options.quick ?? false;
  const minimal = options.minimal ?? existing.setup?.mode === "minimal";

  if (!options.nonInteractive) {
    const interesting = listIntegrations().filter((p) => (FIRST_USE_STATUS_IDS as readonly string[]).includes(p.id));
    const statuses = await Promise.all(
      interesting.map((p) =>
        probeIntegration(p.id, {
          settings: existing.integrations?.[p.id]?.settings ?? {},
          credentialRef: existing.integrations?.[p.id]?.credentialRef,
        }),
      ),
    );
    explain([
      "Keli setup — personal agent with durable scoped corrections.",
      "Registration is not authorization. Grants stay in the gate.",
      "Secrets go to the OS keychain as refs; config never stores plaintext.",
      "Catalog providers are optional; first-use needs one model, not every listed id.",
      returning ? "Returning-user mode: press Enter to keep current values." : "First-run wizard.",
      "",
      ...statuses.map((s) => `  ${s.id}: ${s.configured ? "configured" : "unset"} (${s.howToConfigure})`),
      "",
    ]);
  }

  let transport = options.transport;
  let discordChannel = options.discordChannel ?? existing.transports?.discord?.channelId;
  let discordThread = options.discordThread ?? existing.transports?.discord?.threadId;
  let telegramChat = options.telegramChat ?? existing.transports?.telegram?.chatId;
  let telegramTopic = options.telegramTopic ?? existing.transports?.telegram?.topicId;
  let primaryModel =
    options.primaryModel ?? existing.providers?.primary?.id ?? existing.primaryModel ?? "fixture";
  let fallbackModel =
    options.fallbackModel ?? existing.providers?.fallback?.[0]?.id ?? existing.fallbackModel ?? "fixture";
  let skipCalibration = options.skipCalibration ?? false;
  const section = options.section;

  const skipProvider = quick && returning && Boolean(existing.providers?.primary ?? existing.primaryModel);
  const skipTransport =
    minimal ||
    (quick && returning && Boolean(existing.setup?.transport && existing.setup.transport !== "none"));

  if (!options.nonInteractive && section !== "transport" && section !== "delegate" && section !== "memory" && section !== "mcp" && section !== "search") {
    if (!skipProvider) {
      const rl = readline.createInterface({ input, output });
      try {
        const shortlist = FIRST_USE_PROVIDERS.join(", ");
        const primaryAnswer = await rl.question(`Primary provider [${primaryModel}] (${shortlist}, or other catalog id): `);
        if (primaryAnswer.trim()) primaryModel = primaryAnswer.trim();
        const fallbackAnswer = await rl.question(`Fallback provider [${fallbackModel}] (optional): `);
        if (fallbackAnswer.trim()) fallbackModel = fallbackAnswer.trim();
        primaryModel = getIntegration(primaryModel)?.id ?? primaryModel;
        fallbackModel = getIntegration(fallbackModel)?.id ?? fallbackModel;
        for (const id of new Set([primaryModel, fallbackModel])) {
          const profile = getIntegration(id);
          if (!profile || profile.kind !== "model-provider" || profile.availability === "named-later") throw new Error(`Provider '${id}' is not implemented`);
          if (id === "fixture") continue;
          const entry = existing.integrations?.[id] ?? { enabled: true, settings: {} };
          const { catalogModels, catalogEnvironment } = await import("../integrations/catalog-provider.ts");
          const models = catalogModels(id);
          if (models.length) explain([`Suggested models: ${models.slice(0, 12).join(", ")} (other model IDs accepted)`]);
          const currentModel = entry.settings.model ?? (existing.providers?.primary?.id === id ? existing.providers.primary.model : undefined) ?? profile.defaultModels?.[0] ?? "";
          const chosen = (await rl.question(`Model for ${id} [${currentModel}]: `)).trim() || currentModel;
          if (!chosen) throw new Error(`A model is required for ${id}`);
          entry.settings = { ...entry.settings, model: chosen };
          for (const setting of profile.settings.filter((p) => !p.secret && p.key !== "model")) {
            const current = entry.settings[setting.key] ?? (setting.key === "baseUrl" ? profile.baseUrl : setting.default) ?? "";
            const value = (await rl.question(`${setting.label} [${current}]: `)).trim() || current;
            if (!value && setting.required) throw new Error(`${setting.label} is required for ${id}`);
            if (value) entry.settings[setting.key] = value;
          }
          entry.enabled = true;
          existing.integrations = { ...existing.integrations, [id]: entry };
          await writeConfig(existing, stateDir);
          if (id === "chatgpt") continue;
          if (!entry.credentialRef && profile.auth.type !== "none" && profile.auth.type !== "external-cli" && !catalogEnvironment(id)) {
            const { addCredential } = await import("../integrations/auth.ts");
            let type = profile.auth.type;
            if (id === "anthropic" && (await rl.question("Authentication: API key or account login? [api-key/account]: ")).trim() === "account") type = "oauth-device";
            let value: string | undefined;
            if (type === "api-key" || type === "token") {
              rl.pause();
              try { const { promptSecret } = await import("./secret-prompt.ts"); value = await promptSecret(`Credential for ${id} (hidden): `); } finally { rl.resume(); }
            }
            await addCredential(id, { stateDir, type, value, oauthCallbacks: {
              onAuth: ({ url, instructions }) => explain([`Sign in: ${url}`, instructions ?? ""]),
              onPrompt: ({ message }) => rl.question(`${message} `),
            } });
            existing.integrations = (await readConfig(stateDir))?.integrations;
          }
        }
        if (primaryModel === "chatgpt" || fallbackModel === "chatgpt") {
          if (!existing.integrations?.chatgpt?.credentialRef) {
            const { addCredential } = await import("../integrations/auth.ts");
            const { codexAccessToken } = await import("../integrations/chatgpt-auth.ts");
            let linked = false;
            try { await codexAccessToken(); linked = true; } catch { /* independent login below */ }
            const useExisting = linked && !(await rl.question("Use your existing Codex ChatGPT login? [Y/n]: ")).trim().toLowerCase().startsWith("n");
            await addCredential("chatgpt", {
              stateDir, type: useExisting ? "external-cli" : "oauth-device",
              oauthCallbacks: {
                onAuth: ({ url, instructions }) => explain([`Sign in in your browser: ${url}`, instructions ?? ""]),
                onPrompt: ({ message }) => rl.question(`${message} `),
              },
            });
            existing.integrations = (await readConfig(stateDir))?.integrations;
          }
        }
      } finally {
        rl.close();
      }
    }
  }

  if (!options.nonInteractive && !minimal && section !== "provider" && section !== "delegate" && section !== "memory" && section !== "mcp" && section !== "search") {
    if (!skipTransport) {
      const rl = readline.createInterface({ input, output });
      try {
        const transports = listIntegrations("transport").map((p) => p.id).join("/");
        const transportAnswer = await rl.question(`Transport to pair now (${transports}/none) [${transport ?? existing.setup?.transport ?? "discord"}]: `);
        const chosen = transportAnswer.trim() || transport || existing.setup?.transport || "discord";
        transport = chosen as SetupOptions["transport"];
        if (transport === "discord") {
          const channel = await rl.question(`Discord channel id [${discordChannel ?? ""}]: `);
          if (channel.trim()) discordChannel = channel.trim();
          const threadAnswer = await rl.question(`Discord thread id (optional) [${discordThread ?? ""}]: `);
          if (threadAnswer.trim()) discordThread = threadAnswer.trim();
        } else if (transport === "telegram") {
          const chat = await rl.question(`Telegram chat id [${telegramChat ?? ""}]: `);
          if (chat.trim()) telegramChat = chat.trim();
          const topicAnswer = await rl.question(`Telegram topic id (optional) [${telegramTopic ?? ""}]: `);
          if (topicAnswer.trim()) telegramTopic = topicAnswer.trim();
        }
        const calAnswer = await rl.question("Skip optional calibration for now? [Y/n]: ");
        skipCalibration = !calAnswer.trim() || calAnswer.toLowerCase().startsWith("y");
      } finally {
        rl.close();
      }
    }
  }

  if (minimal && !transport) transport = "none";
  if (section === "search" || section === "mcp" || section === "provider" || section === "memory") {
    transport = transport ?? existing.setup?.transport ?? "none";
  }
  transport = transport ?? (minimal ? "none" : "discord");

  if (transport === "discord" && !discordChannel && section !== "provider" && section !== "search" && section !== "mcp" && section !== "memory") {
    throw new Error("Discord setup requires --discord-channel or an interactive channel id");
  }
  if (transport === "telegram" && !telegramChat && section !== "provider" && section !== "search" && section !== "mcp" && section !== "memory") {
    throw new Error("Telegram setup requires --telegram-chat or an interactive chat id");
  }

  let searchEndpoint = options.searchEndpoint ?? existing.integrations?.search?.settings.baseUrl;
  let searchTouched = section === "search" || options.searchEndpoint !== undefined;
  if (!options.nonInteractive && !minimal && (section === "search" || !section)) {
    const rl = readline.createInterface({ input, output });
    try {
      const current = searchEndpoint ?? "";
      const answer = await rl.question(`Search endpoint (Brave or generic JSON, empty to skip) [${current}]: `);
      if (answer.trim()) {
        searchEndpoint = answer.trim();
        searchTouched = true;
      }
    } finally {
      rl.close();
    }
  }

  let mcpUrl = options.mcpUrl ?? existing.integrations?.mcp?.settings.url ?? existing.mcp?.servers?.[0]?.url;
  let mcpCommand = options.mcpCommand ?? existing.integrations?.mcp?.settings.command ?? existing.mcp?.servers?.[0]?.command;
  const mcpTouched = section === "mcp" || options.mcpUrl !== undefined || options.mcpCommand !== undefined;
  if (!options.nonInteractive && section === "mcp") {
    const rl = readline.createInterface({ input, output });
    try {
      const urlAnswer = await rl.question(`MCP HTTP URL [${mcpUrl ?? ""}]: `);
      if (urlAnswer.trim()) mcpUrl = urlAnswer.trim();
      const cmdAnswer = await rl.question(`MCP stdio command [${mcpCommand ?? ""}]: `);
      if (cmdAnswer.trim()) mcpCommand = cmdAnswer.trim();
    } finally {
      rl.close();
    }
  }

  if (searchTouched && searchEndpoint) {
    const previous = existing.integrations?.search;
    existing.integrations = {
      ...existing.integrations,
      search: {
        enabled: true,
        settings: { ...previous?.settings, baseUrl: searchEndpoint },
        credentialRef: previous?.credentialRef,
        status: previous?.status,
      },
    };
  }
  if (mcpTouched && (mcpUrl || mcpCommand)) {
    const previousServers = existing.mcp?.servers ?? [];
    const previousEntry = existing.integrations?.mcp;
    const nextServer = mcpCommand
      ? {
          id: previousServers.find((s) => s.command === mcpCommand)?.id ?? previousServers[0]?.id ?? "mcp",
          transport: "stdio" as const,
          command: mcpCommand,
          args: previousServers.find((s) => s.command === mcpCommand)?.args ?? previousServers[0]?.args,
          envRefs: previousServers.find((s) => s.command === mcpCommand)?.envRefs ?? previousServers[0]?.envRefs,
        }
      : {
          id: previousServers.find((s) => s.url === mcpUrl)?.id ?? previousServers[0]?.id ?? "mcp",
          transport: "http" as const,
          url: mcpUrl!,
          envRefs: previousServers.find((s) => s.url === mcpUrl)?.envRefs ?? previousServers[0]?.envRefs,
        };
    const remaining = previousServers.filter((s) => s.id !== nextServer.id);
    existing.mcp = { ...existing.mcp, servers: [nextServer, ...remaining] };
    existing.integrations = {
      ...existing.integrations,
      mcp: {
        enabled: true,
        credentialRef: previousEntry?.credentialRef,
        status: previousEntry?.status,
        settings: {
          ...previousEntry?.settings,
          ...(mcpUrl ? { url: mcpUrl, transport: "http" } : {}),
          ...(mcpCommand ? { command: mcpCommand, transport: "stdio" } : {}),
        },
      },
    };
  }

  const { requireInitialized } = await import("../state/init.ts");
  const { db, owner } = await requireInitialized(stateDir);
  const project = getProjectById(db, existing.defaultProjectId);
  if (!project) throw new Error("Default project missing");
  const scope = projectScope(project.id);

  let routeBound = false;
  if (transport === "discord" && discordChannel) {
    const externalId = discordThread ? `${discordChannel}:${discordThread}` : discordChannel;
    bindTransportRoute(db, {
      transport: "discord",
      externalId,
      scope,
      metadata: { channelId: discordChannel, threadId: discordThread ?? null },
    });
    routeBound = true;
  } else if (transport === "telegram" && telegramChat) {
    const externalId = telegramTopic ? `${telegramChat}:${telegramTopic}` : telegramChat;
    bindTransportRoute(db, {
      transport: "telegram",
      externalId,
      scope,
      metadata: { chatId: telegramChat, topicId: telegramTopic ?? null },
    });
    routeBound = true;
  }

  let transportTested = false;
  let pairingVerified = Boolean(existing.setup?.pairing?.verifiedAt);
  let pairingPending = Boolean(existing.setup?.pairing && !existing.setup.pairing.verifiedAt);
  let pairing = existing.setup?.pairing;
  const skipThisTransport =
    options.skipTransportTest ||
    section === "search" ||
    section === "mcp" ||
    section === "provider" ||
    section === "memory";
  if (!skipThisTransport && transport !== "none") {
    if (transport === "discord") {
      try {
        const backend = fixtureUrlFor("discord")
          ? undefined
          : await resolveDiscordBackend(existing);
        await sendDiscordMessage(
          db,
          {
            channelId: discordChannel!,
            threadId: discordThread,
            message: "Keli setup test message",
            scope,
          },
          backend,
        );
        transportTested = true;
      } catch {
        if (!options.nonInteractive) {
          explain(["Transport test skipped: keli auth add discord, then retry keli setup transport."]);
        }
      }
    } else if (transport === "telegram") {
      try {
        const backend = fixtureUrlFor("telegram")
          ? undefined
          : await resolveTelegramBackend(existing);
        await sendTelegramMessage(
          db,
          {
            chatId: telegramChat!,
            topicId: telegramTopic,
            message: "Keli setup test message",
            scope,
          },
          backend,
        );
        transportTested = true;
      } catch {
        if (!options.nonInteractive) {
          explain(["Transport test skipped: keli auth add telegram, then retry keli setup transport."]);
        }
      }
    }

    const externalId =
      transport === "discord"
        ? discordThread
          ? `${discordChannel}:${discordThread}`
          : discordChannel!
        : telegramTopic
          ? `${telegramChat}:${telegramTopic}`
          : telegramChat!;
    const pending = existing.setup?.pairing;
    const reusePending =
      pending &&
      !pending.verifiedAt &&
      pending.transport === transport &&
      pending.externalId === externalId &&
      Date.parse(pending.expiresAt) > Date.now();
    pairing = reusePending
      ? pending
      : {
          transport,
          externalId,
          code: issuePairingCode(),
          expiresAt: pairingExpiresAt(),
        };
    const phrase = pairingPhrase(pairing.code);
    try {
      if (transport === "discord") {
        const backend = fixtureUrlFor("discord") ? undefined : await resolveDiscordBackend(existing);
        await sendDiscordMessage(
          db,
          {
            channelId: discordChannel!,
            threadId: discordThread,
            message: `Reply with ${phrase} from this chat to finish pairing. Notifications stay local until pairing succeeds.`,
            scope,
          },
          backend,
        );
      } else if (transport === "telegram") {
        const backend = fixtureUrlFor("telegram") ? undefined : await resolveTelegramBackend(existing);
        await sendTelegramMessage(
          db,
          {
            chatId: telegramChat!,
            topicId: telegramTopic,
            message: `Reply with ${phrase} from this chat to finish pairing. Notifications stay local until pairing succeeds.`,
            scope,
          },
          backend,
        );
      }
    } catch {
      /* pairing message is best-effort; the challenge is still stored */
    }
    pairingPending = true;
    if (options.pairingCode && pairingAccepts(pairing, options.pairingCode)) {
      pairing = confirmPairing(pairing, options.pairingActorId ?? owner.id);
      pairingVerified = true;
      pairingPending = false;
    }
  }

  db.close();

  const next: KeliConfig = {
    ...existing,
    ownerId: owner.id,
    primaryModel,
    fallbackModel,
    providers: {
      ...existing.providers,
      primary: { id: primaryModel, model: existing.integrations?.[primaryModel]?.settings.model ?? (existing.providers?.primary?.id === primaryModel ? existing.providers.primary.model : undefined) },
      fallback: fallbackModel ? [{ id: fallbackModel, model: existing.integrations?.[fallbackModel]?.settings.model ?? existing.providers?.fallback?.find((p) => p.id === fallbackModel)?.model }] : existing.providers?.fallback,
    },
    integrations: {
      ...existing.integrations,
      ...(transport === "discord" && discordChannel
        ? {
            discord: {
              enabled: true,
              settings: {
                channelId: discordChannel,
                ...(discordThread ? { threadId: discordThread } : {}),
              },
            },
          }
        : {}),
      ...(transport === "telegram" && telegramChat
        ? {
            telegram: {
              enabled: true,
              settings: {
                chatId: telegramChat,
                ...(telegramTopic ? { topicId: telegramTopic } : {}),
              },
            },
          }
        : {}),
    },
    transports: {
      ...existing.transports,
      discord: transport === "discord"
        ? { channelId: discordChannel, threadId: discordThread, ownerUserId: pairing?.pairedActorId ?? existing.transports?.discord?.ownerUserId }
        : existing.transports?.discord,
      telegram: transport === "telegram"
        ? { chatId: telegramChat, topicId: telegramTopic }
        : existing.transports?.telegram,
    },
    setup: {
      ...existing.setup,
      completedAt: new Date().toISOString(),
      transport,
      calibrationSkipped: skipCalibration,
      mode: minimal ? "minimal" : existing.setup?.mode ?? "full",
      pairing,
    },
  };

  let providerConnected = Boolean(existing.setup?.providerConnected);
  let providerDetail = existing.setup?.providerDetail ?? "";
  const shouldProbeProvider = !section || section === "provider";
  if (shouldProbeProvider) {
    try {
      const probe = await runLiveProbe({
        config: next,
        only: [primaryModel],
        timeoutMs: primaryModel === "chatgpt" ? 30_000 : 8000,
      });
      const line = probe.lines.find((l) => l.id === primaryModel);
      providerConnected =
        line?.outcome === "pass" ||
        (primaryModel === "fixture" && Boolean(fixtureUrlFor("model") || fixtureUrlFor("provider")));
      providerDetail =
        line?.detail ??
        (providerConnected ? "fixture or configured endpoint reachable" : "provider round-trip not verified");
    } catch (e) {
      providerDetail = String(e);
      providerConnected = false;
    }
    next.setup = { ...next.setup, providerConnected, providerDetail };
    if (providerConnected) {
      next.setup.liveChecked = {
        ...next.setup.liveChecked,
        [primaryModel]: {
          at: new Date().toISOString(),
          model: next.providers?.primary?.model ?? (primaryModel === "chatgpt" ? "gpt-5.5" : undefined),
        },
      };
    }
  }
  await writeConfig(next, stateDir);

  if (!options.nonInteractive) {
    explain([
      "",
      `Setup complete. Project: ${projectName}. Transport: ${transport}. Route ${routeBound ? `bound to project ${project.name}` : "not bound (CLI recovery still works)"}.`,
      providerConnected
        ? `Primary provider live-checked for this model (${providerDetail}). Catalog membership is not entitlement.`
        : `Primary provider not yet connected: ${providerDetail || "run keli auth add <provider> then keli doctor"}.`,
      searchEndpoint ? `Search connected (${searchEndpoint}).` : "Search not connected — web investigation will explain the missing access.",
      pairingVerified
        ? "Transport pairing verified."
        : pairingPending
          ? "Transport pairing pending — reply with the KELI-PAIR code from that chat."
          : transport === "none"
            ? "CLI-only: notifications stay local."
            : "",
      skipCalibration
        ? "Optional calibration skipped — you can run a real task anytime."
        : "Run a real conversation when ready.",
      "Routing roles and budgets stay on keli config — they are not part of onboarding.",
    ]);
  }

  return {
    stateDir,
    transport,
    routeBound,
    transportTested,
    calibrationSkipped: skipCalibration,
    providerConnected,
    searchConnected: Boolean(searchEndpoint || fixtureUrlFor("search")),
    pairingVerified,
    pairingPending,
    projectName,
  };
}
