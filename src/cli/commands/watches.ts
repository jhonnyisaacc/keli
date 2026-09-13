import { defineCommand } from "citty";
import { join } from "node:path";
import { sendDiscordMessage } from "../../transports/discord.ts";
import { resolveDiscordBackend } from "../../transports/discord-resolve.ts";
import { importHeartbeatFile } from "../../watches/heartbeat-file.ts";
import { tickWatches, type WatchNotification } from "../../watches/heartbeat.ts";
import { getWatch, listWatchEvents, listWatches, setWatchStatus } from "../../watches/store.ts";
import type { WatchStatus } from "../../watches/types.ts";
import { openApp } from "../context.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

function formatWatch(w: { id: string; name: string; status: string; version: number; kind: string; trigger: { schedule: string; target: string }; lastSuccessAt?: string; lastError?: string; attempts: number }) {
  const health = w.lastError ? ` error: ${w.lastError}` : w.lastSuccessAt ? ` ok ${w.lastSuccessAt}` : "";
  return `${w.id}  ${w.name} v${w.version} [${w.status}] ${w.kind} ${w.trigger.target} ${w.trigger.schedule}${health}`;
}

export function watchesCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Watches: compiled, approved proactive checks driven by the heartbeat" },
    subCommands: {
      import: defineCommand({
        meta: { description: "Compile HEARTBEAT.md sections into watch proposals (nothing runs until approved)" },
        args: { file: { type: "string", description: "Path to HEARTBEAT.md (default: config.watches.heartbeatFile or <stateDir>/HEARTBEAT.md)" } },
        async run({ args }) {
          try {
            const app = await openApp(globals, { requireProvider: false });
            const path = (args.file ? String(args.file) : undefined) ?? app.config.watches?.heartbeatFile ?? join(app.stateDir, "HEARTBEAT.md");
            const result = await importHeartbeatFile(app.db, { ownerId: app.owner.id, scope: app.scope, path });
            app.close();
            const lines = [
              ...result.created.map((w) => `proposed  ${w.name} (${w.id}) — approve with: keli watches approve ${w.id}`),
              ...result.updated.map((w) => `updated   ${w.name} v${w.version} → re-approve: keli watches approve ${w.id}`),
              ...result.unchanged.map((w) => `unchanged ${w.name}`),
              ...result.problems.map((p) => `problem   ${p.section}${p.line ? ` (line ${p.line})` : ""}: ${p.message}`),
            ];
            emit(result, globals.outputFormat, lines.join("\n") || "No sections found");
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      list: defineCommand({
        meta: { description: "List watches with health" },
        args: { status: { type: "string", description: "proposed | active | paused | retired" } },
        async run({ args }) {
          try {
            const app = await openApp(globals, { requireProvider: false });
            const watches = listWatches(app.db, { status: args.status as WatchStatus | undefined });
            app.close();
            emit(watches, globals.outputFormat, watches.length ? watches.map(formatWatch).join("\n") : "No watches");
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      approve: statusCommand(globals, "active", "Approve a proposed watch so the heartbeat runs it"),
      pause: statusCommand(globals, "paused", "Pause a watch"),
      retire: statusCommand(globals, "retired", "Retire a watch"),
      events: defineCommand({
        meta: { description: "Show recent events for a watch" },
        args: { id: { type: "positional", required: true } },
        async run({ args }) {
          try {
            const app = await openApp(globals, { requireProvider: false });
            const events = listWatchEvents(app.db, String(args.id));
            app.close();
            emit(events, globals.outputFormat, events.map((e) => `${e.createdAt} ${e.kind}${e.detail ? ` ${JSON.stringify(e.detail)}` : ""}`).join("\n") || "No events");
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      tick: defineCommand({
        meta: { description: "Run one heartbeat tick: fingerprint due watches, research changes, notify once" },
        args: {
          "no-notify": { type: "boolean", default: false, description: "Research but do not deliver notifications" },
        },
        async run({ args }) {
          try {
            const app = await openApp(globals);
            let backend: Awaited<ReturnType<typeof resolveDiscordBackend>> | null = null;
            const notify = args["no-notify"]
              ? undefined
              : async (n: WatchNotification) => {
                  if (!n.watch.notify.channelId) {
                    console.log(n.text);
                    return;
                  }
                  backend ??= await resolveDiscordBackend(app.config);
                  await sendDiscordMessage(
                    app.db,
                    { channelId: n.watch.notify.channelId, threadId: n.watch.notify.threadId, message: n.text, scope: n.watch.scope },
                    backend,
                  );
                };
            const result = await tickWatches(app.db, {
              ownerId: app.owner.id,
              stateDir: app.stateDir,
              behavior: app.behavior,
              loop: app.conversation.loop,
              sources: app.conversation.sources,
              capabilityGate: app.conversation.capabilityGate,
              policy: app.conversation.policy,
              networkHosts: app.config.network?.allowedHosts,
              notify,
            });
            app.close();
            emit(
              result,
              globals.outputFormat,
              `${result.scanned} watch(es), ${result.due} due, ${result.modelWakes} model wake(s), ${result.notifications} notification(s)\n` +
                result.outcomes.map((o) => `  ${o.name}: ${o.result}${o.outcomeKind ? ` (${o.outcomeKind})` : ""}${o.error ? ` — ${o.error}` : ""}`).join("\n"),
            );
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
    },
  });
}

function statusCommand(globals: CliGlobals, status: WatchStatus, description: string) {
  return defineCommand({
    meta: { description },
    args: { id: { type: "positional", required: true, description: "Watch id" } },
    async run({ args }) {
      try {
        const app = await openApp(globals, { requireProvider: false });
        const existing = getWatch(app.db, String(args.id));
        if (!existing) throw new Error(`Unknown watch ${String(args.id)}`);
        const watch = setWatchStatus(app.db, existing.id, status);
        app.close();
        emit(watch, globals.outputFormat, formatWatch(watch));
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
