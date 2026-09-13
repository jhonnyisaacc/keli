import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { defineCommand } from "citty";
import { upsertConversation } from "../../memory/conversations.ts";
import { openApp } from "../context.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function chatCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Interactive CLI chat: research turns with cited evidence, corrections, and coding delegation" },
    args: {
      message: { type: "string", description: "One-shot message (skip REPL)" },
      session: { type: "string", description: "Conversation id to continue (default: cli:<project>)" },
      legacy: { type: "boolean", default: false, description: "Use the coding-delegate loop only" },
    },
    async run({ args }) {
      try {
        // Corrections and undo never need a model; research turns report a missing provider as an outcome.
        const app = await openApp(globals, { requireProvider: Boolean(args.legacy) });
        const external = args.session ?? `cli:${app.project.id}`;
        const conversation = upsertConversation(app.db, { scope: app.scope, transport: "cli", externalId: external });
        const ctx = app.conversation.cliContext(conversation.id);
        const runOnce = async (prompt: string) => {
          if (args.legacy) {
            const result = await app.loop.runTurn(prompt);
            emit(result, globals.outputFormat, result.message);
            return;
          }
          const outcome = await app.conversation.loop.runTurn(ctx, prompt);
          const cites = outcome.citations?.length ? `\nSources: ${outcome.citations.map((c) => c.sourceId).join(", ")}` : "";
          emit(outcome, globals.outputFormat, `[${outcome.kind}] ${outcome.text}${cites}`);
        };
        if (args.message) {
          await runOnce(args.message);
          app.close();
          return;
        }
        if (!process.stdin.isTTY) {
          emitError("keli chat requires a TTY or --message", globals.outputFormat);
        }
        const rl = readline.createInterface({ input, output });
        console.log(`Keli chat (${conversation.id.slice(0, 8)}). Empty line or /quit to exit.`);
        try {
          while (true) {
            const line = await rl.question("> ");
            if (!line.trim() || line.trim() === "/quit") break;
            await runOnce(line);
          }
        } finally {
          rl.close();
          app.close();
        }
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
