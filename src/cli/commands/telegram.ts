import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { projectScope, getProjectById } from "../../state/repos.ts";
import { sendTelegramMessage, recordTelegramUpdate } from "../../transports/telegram.ts";
import { processTransportInbox } from "../../transports/inbox-processor.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function telegramCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Telegram transport (fixture-backed in 0.1-D)" },
    subCommands: {
      send: telegramSendCommand(globals),
      ingest: telegramIngestCommand(globals),
      process: telegramProcessCommand(globals),
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
        const result = processTransportInbox(db);
        db.close();
        emit(result, globals.outputFormat, `Processed ${result.processed} inbox message(s)`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
