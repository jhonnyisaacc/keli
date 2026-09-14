import { initializeState } from "../state/init.ts";
import { DEFAULT_PROJECT_NAME } from "../state/defaults.ts";
import { readConfig, writeConfig, type KeliConfig } from "../state/config.ts";
import { projectScope, getProjectById } from "../state/repos.ts";
import { bindTransportRoute } from "../transports/routes.ts";
import { sendDiscordMessage } from "../transports/discord.ts";
import { resolveDiscordBackend } from "../transports/discord-resolve.ts";
import { sendTelegramMessage } from "../transports/telegram.ts";
import { resolveTelegramBackend } from "../transports/telegram-resolve.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { runLiveProbe } from "../integrations/live-probe.ts";
import { confirmPairing, issuePairingCode, pairingAccepts, pairingExpiresAt, pairingPhrase } from "../transports/pairing.ts";
import { createReadlineWizardIo, type WizardIo } from "./io.ts";
import { runInteractiveCategories, sectionToCategory, type InteractiveDraft } from "./interactive.ts";
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
  fixture?: boolean;
  io?: WizardIo;
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

function explain(lines: string[], io?: WizardIo): void {
  for (const line of lines) {
    if (io) io.println(line);
    else console.log(line);
  }
}

function explicitFixture(options: SetupOptions): boolean {
  return Boolean(options.fixture || fixtureUrlFor("model") || fixtureUrlFor("provider") || options.primaryModel === "fixture");
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const ownedIo = !options.nonInteractive && !options.io ? createReadlineWizardIo() : undefined;
  const io = options.io ?? ownedIo;
  try {
    return await runSetupBody(options, io);
  } finally {
    ownedIo?.close();
  }
}

async function runSetupBody(options: SetupOptions, io?: WizardIo): Promise<SetupResult> {
  let projectName = options.projectName?.trim();
  if (!options.nonInteractive && !projectName) {
    const answer = await io!.question(`Project name [${DEFAULT_PROJECT_NAME}]: `);
    if (answer) projectName = answer;
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
  const allowFixture = explicitFixture(options);

  if (!options.nonInteractive) {
    explain([
      "Keli setup — choose connections by number.",
      "Registration is not authorization. Grants stay in the gate.",
      "Secrets go to the OS keychain as refs; config never stores plaintext.",
      returning ? "Returning-user mode: skip any category to keep current values." : "First-run wizard.",
    ], io);
  }

  const draft: InteractiveDraft = {
    transport: options.transport,
    discordChannel: options.discordChannel ?? existing.transports?.discord?.channelId,
    discordThread: options.discordThread ?? existing.transports?.discord?.threadId,
    telegramChat: options.telegramChat ?? existing.transports?.telegram?.chatId,
    telegramTopic: options.telegramTopic ?? existing.transports?.telegram?.topicId,
    primaryModel: options.primaryModel ?? existing.providers?.primary?.id ?? existing.primaryModel,
    fallbackModel: options.fallbackModel ?? existing.providers?.fallback?.[0]?.id ?? existing.fallbackModel,
    skipCalibration: options.skipCalibration ?? false,
    searchEndpoint: options.searchEndpoint ?? existing.integrations?.search?.settings.baseUrl,
    mcpUrl: options.mcpUrl ?? existing.integrations?.mcp?.settings.url ?? existing.mcp?.servers?.[0]?.url,
    mcpCommand: options.mcpCommand ?? existing.integrations?.mcp?.settings.command ?? existing.mcp?.servers?.[0]?.command,
  };
  if (!draft.primaryModel && allowFixture) draft.primaryModel = "fixture";

  const section = options.section;

  if (!options.nonInteractive && io) {
    await runInteractiveCategories(io, existing, stateDir, draft, allowFixture, sectionToCategory(section));
    const reloaded = await readConfig(stateDir);
    if (reloaded?.integrations) existing.integrations = reloaded.integrations;
    if (reloaded?.memory) existing.memory = reloaded.memory;
  }

  let transport = draft.transport;
  let discordChannel = draft.discordChannel;
  let discordThread = draft.discordThread;
  let telegramChat = draft.telegramChat;
  let telegramTopic = draft.telegramTopic;
  let primaryModel = draft.primaryModel;
  let fallbackModel = draft.fallbackModel;
  let skipCalibration = draft.skipCalibration ?? false;

  if (minimal && !transport) transport = "none";
  if (section === "search" || section === "mcp" || section === "provider" || section === "memory") {
    transport = transport ?? existing.setup?.transport ?? "none";
  }
  if (options.nonInteractive) {
    transport = transport ?? (minimal ? "none" : "discord");
  } else {
    transport = transport ?? existing.setup?.transport ?? "none";
  }

  if (transport === "discord" && !discordChannel && section !== "provider" && section !== "search" && section !== "mcp" && section !== "memory" && options.nonInteractive) {
    throw new Error("Discord setup requires --discord-channel or an interactive channel id");
  }
  if (transport === "telegram" && !telegramChat && section !== "provider" && section !== "search" && section !== "mcp" && section !== "memory" && options.nonInteractive) {
    throw new Error("Telegram setup requires --telegram-chat or an interactive chat id");
  }

  let searchEndpoint = draft.searchEndpoint ?? options.searchEndpoint ?? existing.integrations?.search?.settings.baseUrl;
  let searchTouched = section === "search" || options.searchEndpoint !== undefined || Boolean(draft.searchEndpoint);
  let mcpUrl = draft.mcpUrl ?? options.mcpUrl ?? existing.integrations?.mcp?.settings.url ?? existing.mcp?.servers?.[0]?.url;
  let mcpCommand = draft.mcpCommand ?? options.mcpCommand ?? existing.integrations?.mcp?.settings.command ?? existing.mcp?.servers?.[0]?.command;
  const mcpTouched = section === "mcp" || options.mcpUrl !== undefined || options.mcpCommand !== undefined || Boolean(draft.mcpUrl || draft.mcpCommand);

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
      ...(primaryModel
        ? {
            primary: {
              id: primaryModel,
              model: existing.integrations?.[primaryModel]?.settings.model ?? (existing.providers?.primary?.id === primaryModel ? existing.providers.primary.model : undefined),
            },
          }
        : {}),
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
  const shouldProbeProvider = primaryModel && (!section || section === "provider");
  if (shouldProbeProvider && primaryModel) {
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
        ? `Primary provider live-verified for this model (${providerDetail}). Catalog membership is not entitlement.`
        : primaryModel
          ? `Primary provider not yet connected: ${providerDetail || "run keli auth add <provider> then keli doctor"}.`
          : "No conversation model configured — Chat/Models still needs an explicit choice.",
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
    ], io);
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
