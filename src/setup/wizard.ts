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
import { listIntegrations, probeIntegration } from "../integrations/registry.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { runLiveProbe } from "../integrations/live-probe.ts";
import "../integrations/load.ts";

export type SetupSection = "provider" | "transport" | "delegate" | "memory" | "mcp";

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
    const statuses = await Promise.all(
      listIntegrations().map((p) =>
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
      returning ? "Returning-user mode: press Enter to keep current values." : "First-run wizard.",
      "",
      ...statuses.slice(0, 8).map((s) => `  ${s.id}: ${s.configured ? "configured" : "unset"} (${s.howToConfigure})`),
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

  if (!options.nonInteractive && section !== "transport" && section !== "delegate" && section !== "memory" && section !== "mcp") {
    if (!skipProvider) {
      const rl = readline.createInterface({ input, output });
      try {
        const providers = listIntegrations("model-provider")
          .map((p) => p.id)
          .join(", ");
        const primaryAnswer = await rl.question(`Primary provider [${primaryModel}] (${providers}, or custom): `);
        if (primaryAnswer.trim()) primaryModel = primaryAnswer.trim();
        const fallbackAnswer = await rl.question(`Fallback provider [${fallbackModel}] (optional): `);
        if (fallbackAnswer.trim()) fallbackModel = fallbackAnswer.trim();
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

  if (!options.nonInteractive && !minimal && section !== "provider" && section !== "delegate" && section !== "memory" && section !== "mcp") {
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
  transport = transport ?? (minimal ? "none" : "discord");

  if (transport === "discord" && !discordChannel && section !== "provider") {
    throw new Error("Discord setup requires --discord-channel or an interactive channel id");
  }
  if (transport === "telegram" && !telegramChat && section !== "provider") {
    throw new Error("Telegram setup requires --telegram-chat or an interactive chat id");
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
  if (!options.skipTransportTest && transport !== "none") {
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
  }

  db.close();

  const next: KeliConfig = {
    ...existing,
    ownerId: owner.id,
    primaryModel,
    fallbackModel,
    providers: {
      ...existing.providers,
      primary: { id: primaryModel },
      fallback: fallbackModel ? [{ id: fallbackModel }] : existing.providers?.fallback,
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
        ? { channelId: discordChannel, threadId: discordThread }
        : existing.transports?.discord,
      telegram: transport === "telegram"
        ? { chatId: telegramChat, topicId: telegramTopic }
        : existing.transports?.telegram,
    },
    setup: {
      completedAt: new Date().toISOString(),
      transport,
      calibrationSkipped: skipCalibration,
      mode: minimal ? "minimal" : "full",
    },
  };

  let providerConnected = false;
  let providerDetail = "";
  {
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
    }
  }
  next.setup = { ...next.setup, providerConnected, providerDetail };
  await writeConfig(next, stateDir);

  if (!options.nonInteractive) {
    explain([
      "",
      `Setup complete. Project: ${projectName}. Transport: ${transport}. Route ${routeBound ? `bound to project ${project.name}` : "not bound (CLI recovery still works)"}.`,
      providerConnected
        ? `Primary provider connected (${providerDetail}).`
        : `Primary provider not yet connected: ${providerDetail || "run keli auth add <provider> then keli doctor"}.`,
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
    projectName,
  };
}
