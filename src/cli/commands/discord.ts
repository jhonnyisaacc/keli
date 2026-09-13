import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { projectScope, getProjectById } from "../../state/repos.ts";
import { sendDiscordMessage, recordDiscordUpdate } from "../../transports/discord.ts";
import { processTransportInbox } from "../../transports/inbox-processor.ts";
import { resolveDiscordBackend } from "../../transports/discord-resolve.ts";
import { runDiscordCycle } from "../../conversation/inbox-handler.ts";
import { emit, emitError } from "../output.ts";
import { openApp, type CliGlobals } from "../context.ts";

export function discordCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Discord transport (REST polling receiver; fixture when KELI_DISCORD_FIXTURE_URL is set)" },
    subCommands: {
      send: discordSendCommand(globals),
      ingest: discordIngestCommand(globals),
      process: discordProcessCommand(globals),
      poll: discordPollCommand(globals),
    },
  });
}

function discordPollCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "One receive → converse → reply cycle over every bound Discord route" },
    args: {
      limit: { type: "string", description: "Max messages per route (default 50)" },
      loop: { type: "string", description: "Keep polling every N seconds" },
    },
    async run({ args }) {
      try {
        const app = await openApp(globals);
        const backend = await resolveDiscordBackend(app.config);
        const limit = args.limit ? Number(args.limit) : undefined;
        const once = async () => {
          const result = await runDiscordCycle(app.db, { ownerId: app.owner.id, backend, loop: app.conversation.loop, limit });
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
          await Bun.sleep(seconds * 1000);
        }
        app.close();
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
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
        const result = await processTransportInbox(db);
        db.close();
        emit(result, globals.outputFormat, `Processed ${result.processed} inbox message(s)`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
