import { defineCommand } from "citty";
import { runSetup, type SetupSection } from "../../setup/wizard.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function setupCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Explained setup wizard driven by the integration registry" },
    args: {
      section: {
        type: "positional",
        description: "provider | transport | delegate | memory | mcp",
        required: false,
      },
      "non-interactive": {
        type: "boolean",
        description: "Use flags only (for automation/tests)",
        default: false,
      },
      transport: {
        type: "string",
        description: "discord, telegram, or none",
      },
      "discord-channel": { type: "string", description: "Discord channel id" },
      "discord-thread": { type: "string", description: "Discord thread id" },
      "telegram-chat": { type: "string", description: "Telegram chat id" },
      "telegram-topic": { type: "string", description: "Telegram topic id" },
      "primary-model": { type: "string", description: "Primary provider/model id" },
      "fallback-model": { type: "string", description: "Fallback provider/model id" },
      project: { type: "string", description: "Default project name (neutral default: personal)" },
      "skip-calibration": { type: "boolean", default: false },
      "skip-transport-test": { type: "boolean", default: false },
      quick: { type: "boolean", default: false, description: "Only prompt for unset items" },
      minimal: { type: "boolean", default: false, description: "Provider + CLI only; no transport" },
    },
    async run({ args }) {
      try {
        const transport = args.transport as "discord" | "telegram" | "none" | undefined;
        const result = await runSetup({
          stateDir: globals.stateDir,
          cwd: globals.cwd,
          nonInteractive: args["non-interactive"],
          transport,
          discordChannel: args["discord-channel"],
          discordThread: args["discord-thread"],
          telegramChat: args["telegram-chat"],
          telegramTopic: args["telegram-topic"],
          primaryModel: args["primary-model"],
          fallbackModel: args["fallback-model"],
          skipCalibration: args["skip-calibration"],
          skipTransportTest: args["skip-transport-test"],
          section: args.section as SetupSection | undefined,
          quick: args.quick,
          minimal: args.minimal,
          projectName: args.project,
        });
        emit(result, globals.outputFormat, `Setup complete (${result.transport})`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
