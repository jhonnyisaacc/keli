import { defineCommand } from "citty";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import { KELI_VERSION } from "../../version.ts";
import { checkForUpdate } from "../../update/check.ts";
import { installUpdate, rollbackUpdate } from "../../update/install.ts";
import { idleReport, runScheduledUpdate } from "../../update/policy.ts";
import { requireInitialized } from "../../state/init.ts";
import { writeConfig } from "../../state/config.ts";

export function updateCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Check, install, roll back, or schedule Keli updates" },
    args: {
      check: { type: "boolean", default: false, description: "Check only; no mutation" },
      install: { type: "boolean", default: false, description: "Download, verify, snapshot state, and activate" },
      rollback: { type: "boolean", default: false, description: "Return to the retained previous release and its state snapshot" },
      scheduled: { type: "boolean", default: false, description: "Run the daily policy (off | notify | auto) once; for cron/heartbeat" },
      mode: { type: "string", description: "Set update mode: off | notify | auto" },
      manifest: { type: "string", description: "Manifest URL or local path" },
      binary: { type: "string", description: "Local binary path (test hook)" },
    },
    async run({ args }) {
      try {
        if (args.mode) {
          if (!["off", "notify", "auto"].includes(args.mode)) throw new Error("mode must be off, notify, or auto");
          const { stateDir, config, db } = await requireInitialized(globals.stateDir);
          db.close();
          const update = { ...(config.update ?? {}), mode: args.mode as "off" | "notify" | "auto", manifestUrl: args.manifest ?? config.update?.manifestUrl };
          await writeConfig({ ...config, update }, stateDir);
          emit(
            update,
            globals.outputFormat,
            `Update mode: ${update.mode}${update.mode === "auto" ? " (installs stable releases daily at an idle boundary; rollback retained)" : ""}`,
          );
          return;
        }

        if (args.rollback) {
          const result = await rollbackUpdate(globals.stateDir);
          emit(result, globals.outputFormat, result.restored ? `Rolled back to ${result.version}${result.stateRestored ? " with pre-update state" : ""}` : result.reason ?? "Rollback failed");
          return;
        }

        if (args.scheduled) {
          const { stateDir, db } = await requireInitialized(globals.stateDir);
          const result = await runScheduledUpdate({ db, stateDir, notify: async (text) => console.log(text) });
          const idle = idleReport(db);
          db.close();
          emit(
            { ...result, idle },
            globals.outputFormat,
            `Update policy ${result.mode}: ${result.outcome}${result.latest ? ` (latest ${result.latest})` : ""}${result.detail ? ` — ${result.detail}` : ""}`,
          );
          return;
        }

        const check = await checkForUpdate(args.manifest);
        if (args.check || !args.install) {
          emit(
            {
              current: check.current,
              latest: check.latest,
              updateAvailable: check.updateAvailable,
              artifact: check.artifact,
            },
            globals.outputFormat,
            check.updateAvailable
              ? `Update available: ${check.latest} (current ${check.current})`
              : `keli ${KELI_VERSION} is up to date`,
          );
          return;
        }

        const result = await installUpdate({
          manifestUrl: args.manifest,
          binaryPath: args.binary,
          stateDir: globals.stateDir,
        });
        emit(
          result,
          globals.outputFormat,
          `Updated to ${result.version} from ${result.previousVersion}${result.rollbackAvailable ? "; rollback available" : "; no rollback binary retained"}`,
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
