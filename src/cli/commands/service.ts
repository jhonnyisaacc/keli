import { defineCommand } from "citty";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import { installServiceFiles, readInstalledService, detectServicePlatform } from "../../ops/service.ts";
import { tickScheduler } from "../../jobs/scheduler.ts";
import { createJobTickContext } from "../../jobs/tick-context.ts";
import { tickWatches } from "../../watches/heartbeat.ts";
import { resolveDiscordBackend } from "../../transports/discord-resolve.ts";
import { resolveTelegramBackend } from "../../transports/telegram-resolve.ts";
import { runDiscordCycle, runTelegramCycle } from "../../conversation/inbox-handler.ts";
import { freshReconnectState, notePollFailure, notePollProgress, sleepBackoff } from "../../transports/reconnect.ts";
import { openApp } from "../context.ts";
import { isExecutionBlocked, readControl } from "../../ops/control.ts";
import { writeConfig } from "../../state/config.ts";

export function serviceCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "OS user-service install and the Keli poll/tick loop" },
    subCommands: {
      install: defineCommand({
        meta: { description: "Write a systemd user unit or launchd plist (does not enable lingering)" },
        args: {
          dest: { type: "string", description: "Override destination directory (tests: KELI_SERVICE_DIR)" },
        },
        async run({ args }) {
          try {
            const execPath = process.execPath.includes("bun") ? `${process.cwd()}/dist/keli` : process.execPath;
            const result = await installServiceFiles({
              execPath,
              destDir: typeof args.dest === "string" ? args.dest : process.env.KELI_SERVICE_DIR,
            });
            emit(
              result,
              globals.outputFormat,
              `Wrote ${result.path} (${result.platform}). Enable with systemctl --user enable --now keli.service or launchctl load.`,
            );
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      status: defineCommand({
        meta: { description: "Show whether a service unit file is installed" },
        async run() {
          try {
            const body = await readInstalledService(process.env.KELI_SERVICE_DIR);
            emit(
              { installed: Boolean(body), platform: detectServicePlatform() },
              globals.outputFormat,
              body ? "service unit present" : "service unit not installed (keli service install)",
            );
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      run: defineCommand({
        meta: { description: "One jobs+watches+transport cycle; --loop repeats with reconnect backoff" },
        args: {
          loop: { type: "string", description: "Repeat every N seconds" },
        },
        async run({ args }) {
          try {
            const app = await openApp(globals, { requireProvider: false });
            let reconnect = freshReconnectState();
            const once = async () => {
              const control = await readControl(app.stateDir);
              if (isExecutionBlocked(control)) {
                emit({ skipped: true, reason: "execution paused" }, globals.outputFormat, "paused — skip tick");
                return;
              }
              const jobCtx = createJobTickContext({
                db: app.db,
                ownerId: app.owner.id,
                stateDir: app.stateDir,
                policy: app.conversation.policy,
              });
              const jobs = await tickScheduler(app.db, jobCtx);
              const watches = await tickWatches(app.db, {
                ownerId: app.owner.id,
                stateDir: app.stateDir,
                behavior: app.behavior,
                loop: app.conversation.loop,
                sources: app.conversation.sources,
                capabilityGate: app.conversation.capabilityGate,
                policy: app.conversation.policy,
                networkHosts: app.config.network?.allowedHosts,
              });
              let discordErrors = 0;
              let telegramErrors = 0;
              const pairing =
                app.config.setup?.pairing && !app.config.setup.pairing.verifiedAt
                  ? {
                      challenge: app.config.setup.pairing,
                      onVerified: async (next: typeof app.config.setup.pairing) => {
                        app.config.setup = { ...app.config.setup, pairing: next };
                        if (next?.transport === "discord" && next.pairedActorId) {
                          app.config.transports = {
                            ...app.config.transports,
                            discord: { ...app.config.transports?.discord, ownerUserId: next.pairedActorId },
                          };
                        }
                        await writeConfig(app.config, app.stateDir);
                      },
                    }
                  : undefined;
              try {
                const backend = await resolveDiscordBackend(app.config);
                const cycle = await runDiscordCycle(app.db, {
                  ownerId: app.owner.id,
                  backend,
                  loop: app.conversation.loop,
                  ownerUserId: app.config.transports?.discord?.ownerUserId,
                  pairing,
                });
                discordErrors = cycle.poll.errors.length;
              } catch {
                /* transport optional */
              }
              try {
                const backend = await resolveTelegramBackend(app.config);
                const cycle = await runTelegramCycle(app.db, {
                  ownerId: app.owner.id,
                  backend,
                  loop: app.conversation.loop,
                  pairing,
                });
                telegramErrors = cycle.poll.errors.length;
              } catch {
                /* transport optional */
              }
              if (discordErrors + telegramErrors > 0) reconnect = notePollFailure(reconnect);
              else reconnect = notePollProgress(reconnect);
              emit(
                { jobs, watches, reconnect },
                globals.outputFormat,
                `jobs scanned ${jobs.scanned}; watches ${watches.scanned} scanned / ${watches.due} due`,
              );
            };
            if (!args.loop) {
              await once();
              app.close();
              return;
            }
            const seconds = Math.max(5, Number(args.loop) || 30);
            let running = true;
            process.on("SIGINT", () => {
              running = false;
            });
            while (running) {
              await once();
              await sleepBackoff(reconnect.backoffMs > 0 ? reconnect.backoffMs : seconds * 1000);
            }
            app.close();
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
    },
  });
}
