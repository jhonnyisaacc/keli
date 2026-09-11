import { defineCommand } from "citty";
import { runSetup } from "../../setup/wizard.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function setupCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Explained setup wizard for models and one transport" },
    args: {
      "non-interactive": {
        type: "boolean",
        description: "Use flags only (for automation/tests)",
        default: false,
      },
      transport: {
        type: "string",
        description: "discord or telegram",
      },
      "discord-channel": { type: "string", description: "Discord channel id" },
      "discord-thread": { type: "string", description: "Discord thread id" },
      "telegram-chat": { type: "string", description: "Telegram chat id" },
      "telegram-topic": { type: "string", description: "Telegram topic id" },
      "primary-model": { type: "string", description: "Primary model id" },
      "fallback-model": { type: "string", description: "Fallback model id" },
      "skip-calibration": { type: "boolean", default: false },
      "skip-transport-test": { type: "boolean", default: false },
    },
    async run({ args }) {
      try {
        const transport = args.transport as "discord" | "telegram" | undefined;
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
        });
        emit(result, globals.outputFormat, `Setup complete (${result.transport})`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
