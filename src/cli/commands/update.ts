import { defineCommand } from "citty";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import { KELI_VERSION } from "../../version.ts";
import { checkForUpdate } from "../../update/check.ts";
import { installUpdate, rollbackUpdate } from "../../update/install.ts";

export function updateCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Check or install Keli updates" },
    args: {
      check: { type: "boolean", default: false, description: "Check only; no mutation" },
      install: { type: "boolean", default: false, description: "Download and activate update" },
      rollback: { type: "boolean", default: false, description: "Rollback to previous staged version" },
      manifest: { type: "string", description: "Manifest URL or local path" },
      binary: { type: "string", description: "Local binary path (test hook)" },
    },
    async run({ args }) {
      try {
        if (args.rollback) {
          const result = await rollbackUpdate(globals.stateDir);
          emit(result, globals.outputFormat, result.restored ? "Rollback complete" : result.reason ?? "Rollback failed");
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
        emit(result, globals.outputFormat, `Updated to ${result.version}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
