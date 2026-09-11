import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { initializeState } from "../state/init.ts";
import { readConfig, writeConfig, type KeliConfig } from "../state/config.ts";
import { projectScope, getProjectById } from "../state/repos.ts";
import { bindTransportRoute } from "../transports/routes.ts";
import { sendDiscordMessage } from "../transports/discord.ts";
import { sendTelegramMessage } from "../transports/telegram.ts";

export type SetupOptions = {
  stateDir?: string;
  cwd?: string;
  nonInteractive?: boolean;
  transport?: "discord" | "telegram";
  discordChannel?: string;
  discordThread?: string;
  telegramChat?: string;
  telegramTopic?: string;
  primaryModel?: string;
  fallbackModel?: string;
  skipCalibration?: boolean;
  skipTransportTest?: boolean;
};

export type SetupResult = {
  stateDir: string;
  transport: "discord" | "telegram";
  routeBound: boolean;
  transportTested: boolean;
  calibrationSkipped: boolean;
};

function explain(lines: string[]): void {
  for (const line of lines) console.log(line);
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const init = await initializeState(options.stateDir, {
    cwd: options.cwd,
    projectName: "Rocket",
  });
  const stateDir = init.stateDir;
  const config = (await readConfig(stateDir)) ?? { version: 1, ownerId: init.ownerId, defaultProjectId: init.projectId };

  if (!options.nonInteractive) {
    explain([
      "Keli setup — personal agent with durable scoped corrections.",
      "This wizard configures models and one messaging transport.",
      "Broad routing and budgets stay configurable later; nothing installs automatically.",
      "",
    ]);
  }

  let transport = options.transport;
  let discordChannel = options.discordChannel;
  let discordThread = options.discordThread;
  let telegramChat = options.telegramChat;
  let telegramTopic = options.telegramTopic;
  let primaryModel = options.primaryModel ?? config.primaryModel ?? "fixture";
  let fallbackModel = options.fallbackModel ?? config.fallbackModel ?? "fixture";
  let skipCalibration = options.skipCalibration ?? false;

  if (!options.nonInteractive) {
    const rl = readline.createInterface({ input, output });
    try {
      const primaryAnswer = await rl.question(
        `Primary model [${primaryModel}] (fixture until live providers ship): `,
      );
      if (primaryAnswer.trim()) primaryModel = primaryAnswer.trim();

      const fallbackAnswer = await rl.question(
        `Fallback model [${fallbackModel}] (optional): `,
      );
      if (fallbackAnswer.trim()) fallbackModel = fallbackAnswer.trim();

      const transportAnswer = await rl.question("Transport to pair now (discord/telegram) [discord]: ");
      transport = (transportAnswer.trim() || "discord") as "discord" | "telegram";

      if (transport === "discord") {
        discordChannel = await rl.question("Discord channel id: ");
        const threadAnswer = await rl.question("Discord thread id (optional): ");
        if (threadAnswer.trim()) discordThread = threadAnswer.trim();
      } else {
        telegramChat = await rl.question("Telegram chat id: ");
        const topicAnswer = await rl.question("Telegram topic id (optional): ");
        if (topicAnswer.trim()) telegramTopic = topicAnswer.trim();
      }

      const calAnswer = await rl.question("Skip optional calibration for now? [Y/n]: ");
      skipCalibration = !calAnswer.trim() || calAnswer.toLowerCase().startsWith("y");
    } finally {
      rl.close();
    }
  }

  transport = transport ?? "discord";
  if (transport === "discord" && !discordChannel) {
    throw new Error("Discord setup requires --discord-channel or an interactive channel id");
  }
  if (transport === "telegram" && !telegramChat) {
    throw new Error("Telegram setup requires --telegram-chat or an interactive chat id");
  }

  const { requireInitialized } = await import("../state/init.ts");
  const { db, owner } = await requireInitialized(stateDir);
  const project = getProjectById(db, config.defaultProjectId);
  if (!project) throw new Error("Default project missing");
  const scope = projectScope(project.id);

  let routeBound = false;
  if (transport === "discord") {
    const externalId = discordThread ? `${discordChannel}:${discordThread}` : discordChannel!;
    bindTransportRoute(db, {
      transport: "discord",
      externalId,
      scope,
      metadata: { channelId: discordChannel, threadId: discordThread ?? null },
    });
    routeBound = true;
  } else {
    const externalId = telegramTopic ? `${telegramChat}:${telegramTopic}` : telegramChat!;
    bindTransportRoute(db, {
      transport: "telegram",
      externalId,
      scope,
      metadata: { chatId: telegramChat, topicId: telegramTopic ?? null },
    });
    routeBound = true;
  }

  let transportTested = false;
  if (!options.skipTransportTest) {
    if (transport === "discord") {
      if (!process.env.KELI_DISCORD_FIXTURE_URL) {
        if (!options.nonInteractive) {
          explain([
            "Transport test skipped: set KELI_DISCORD_FIXTURE_URL or connect discord.js later.",
          ]);
        }
      } else {
        await sendDiscordMessage(db, {
          channelId: discordChannel!,
          threadId: discordThread,
          message: "Keli setup test message",
          scope,
        });
        transportTested = true;
      }
    } else if (process.env.KELI_TELEGRAM_FIXTURE_URL) {
      await sendTelegramMessage(db, {
        chatId: telegramChat!,
        topicId: telegramTopic,
        message: "Keli setup test message",
        scope,
      });
      transportTested = true;
    } else if (!options.nonInteractive) {
      explain([
        "Transport test skipped: set KELI_TELEGRAM_FIXTURE_URL or connect grammY later.",
      ]);
    }
  }

  db.close();

  const next: KeliConfig = {
    ...config,
    ownerId: owner.id,
    primaryModel,
    fallbackModel,
    transports: {
      ...config.transports,
      discord: transport === "discord"
        ? { channelId: discordChannel, threadId: discordThread }
        : config.transports?.discord,
      telegram: transport === "telegram"
        ? { chatId: telegramChat, topicId: telegramTopic }
        : config.transports?.telegram,
    },
    setup: {
      completedAt: new Date().toISOString(),
      transport,
      calibrationSkipped: skipCalibration,
    },
  };
  await writeConfig(next, stateDir);

  if (!options.nonInteractive) {
    explain([
      "",
      `Setup complete. Transport: ${transport}. Route bound to project ${project.name}.`,
      skipCalibration
        ? "Optional calibration skipped — you can run a real task anytime."
        : "Run a real conversation when ready; routing stays configurable later.",
    ]);
  }

  return {
    stateDir,
    transport,
    routeBound,
    transportTested,
    calibrationSkipped: skipCalibration,
  };
}
