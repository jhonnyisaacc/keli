import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { projectScope, getProjectById } from "../../state/repos.ts";
import { sendTelegramMessage, recordTelegramUpdate } from "../../transports/telegram.ts";
import { processTransportInbox } from "../../transports/inbox-processor.ts";
import { resolveTelegramBackend } from "../../transports/telegram-resolve.ts";
import { runTelegramCycle } from "../../conversation/inbox-handler.ts";
import { freshReconnectState, notePollFailure, notePollProgress, sleepBackoff } from "../../transports/reconnect.ts";
import { emit, emitError } from "../output.ts";
import { openApp, type CliGlobals } from "../context.ts";

export function telegramCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Telegram transport (Bot API getUpdates; fixture when KELI_TELEGRAM_FIXTURE_URL is set)" },
    subCommands: {
      send: telegramSendCommand(globals),
      ingest: telegramIngestCommand(globals),
      process: telegramProcessCommand(globals),
      poll: telegramPollCommand(globals),
    },
  });
}

function telegramPollCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "One receive → converse → reply cycle over bound Telegram chats" },
    args: {
      limit: { type: "string", description: "Max updates (default 50)" },
      loop: { type: "string", description: "Keep polling every N seconds" },
    },
    async run({ args }) {
      try {
        const app = await openApp(globals, { requireProvider: false });
        const backend = await resolveTelegramBackend(app.config);
        const limit = args.limit ? Number(args.limit) : undefined;
        let reconnect = freshReconnectState();
        const once = async () => {
          const result = await runTelegramCycle(app.db, {
            ownerId: app.owner.id,
            backend,
            loop: app.conversation.loop,
            ownerUserId: app.config.transports?.telegram?.chatId,
            limit,
          });
          if (result.poll.errors.length) reconnect = notePollFailure(reconnect);
          else reconnect = notePollProgress(reconnect);
          emit(
            result,
            globals.outputFormat,
            `${backend.name}: ${result.poll.routesPolled} route(s), ${result.poll.recorded} new, ${result.poll.duplicates} dup, ${result.inbox.replied} replied, ${result.inbox.failed} failed${
              result.poll.errors.length ? `\n  ${result.poll.errors.join("\n  ")}` : ""
            }`,
          );
        };
        if (!args.loop) {
          await once();
          app.close();
          return;
        }
        const seconds = Math.max(2, Number(args.loop) || 10);
        let running = true;
        process.on("SIGINT", () => {
          running = false;
        });
        while (running) {
          await once();
          const wait = reconnect.backoffMs > 0 ? reconnect.backoffMs : seconds * 1000;
          await sleepBackoff(wait);
        }
        app.close();
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function telegramSendCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Send a message via Telegram transport" },
    args: {
      chat: { type: "string", required: true, description: "Telegram chat id" },
      message: { type: "string", required: true, description: "Message text" },
      topic: { type: "string", description: "Forum topic id (optional)" },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) throw new Error("Default project missing");
        const result = await sendTelegramMessage(db, {
          chatId: args.chat,
          message: args.message,
          topicId: args.topic,
          scope: projectScope(project.id),
        });
        db.close();
        emit(result, globals.outputFormat, `Delivered message ${result.messageId}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function telegramIngestCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Record a Telegram update with inbox deduplication" },
    args: {
      update: { type: "string", required: true, description: "Telegram update id" },
      chat: { type: "string", required: true, description: "Chat id" },
      topic: { type: "string", description: "Topic id" },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) throw new Error("Default project missing");
        const result = recordTelegramUpdate(db, {
          updateId: args.update,
          chatId: args.chat,
          topicId: args.topic,
          scope: projectScope(project.id),
          payload: { text: "fixture ingest" },
        });
        db.close();
        emit(
          result,
          globals.outputFormat,
          result.duplicate ? "Duplicate update ignored" : "Update queued (unprocessed)",
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function telegramProcessCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Process unprocessed transport inbox messages" },
    async run() {
      try {
        const { db } = await requireInitialized(globals.stateDir);
        const result = await processTransportInbox(db);
        db.close();
        emit(result, globals.outputFormat, `Processed ${result.processed} inbox message(s)`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
