import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { projectScope, getProjectById } from "../../state/repos.ts";
import { sendDiscordMessage, recordDiscordUpdate } from "../../transports/discord.ts";
import { processTransportInbox } from "../../transports/inbox-processor.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function discordCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Discord transport (fixture-backed in 0.1-D)" },
    subCommands: {
      send: discordSendCommand(globals),
      ingest: discordIngestCommand(globals),
      process: discordProcessCommand(globals),
    },
  });
}

function discordSendCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Send a message via Discord transport" },
    args: {
      channel: { type: "string", required: true, description: "Discord channel id" },
      message: { type: "string", required: true, description: "Message text" },
      thread: { type: "string", description: "Thread id (optional)" },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) throw new Error("Default project missing");
        const result = await sendDiscordMessage(db, {
          channelId: args.channel,
          message: args.message,
          threadId: args.thread,
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

function discordIngestCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Record a Discord update with inbox deduplication (test hook)" },
    args: {
      update: { type: "string", required: true, description: "Discord update id" },
      json: { type: "boolean", default: false },
    },
    async run({ args }) {
      const format = args.json ? "json" : globals.outputFormat;
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) throw new Error("Default project missing");
        const result = recordDiscordUpdate(db, {
          updateId: args.update,
          channelId: "fixture-channel",
          scope: projectScope(project.id),
          payload: { text: "fixture ingest" },
        });
        db.close();
        emit(
          result,
          format,
          result.duplicate ? "Duplicate update ignored" : "Update queued (unprocessed)",
        );
      } catch (e) {
        emitError(String(e), format);
      }
    },
  });
}

function discordProcessCommand(globals: CliGlobals) {
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
