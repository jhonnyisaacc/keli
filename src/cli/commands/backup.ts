import { defineCommand } from "citty";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import { createBackup, restoreBackup } from "../../ops/backup.ts";

export function backupCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Create a state backup (credentials excluded)" },
    args: {
      out: { type: "string", description: "Output directory" },
    },
    async run({ args }) {
      try {
        const result = await createBackup(globals.stateDir, args.out);
        emit(result, globals.outputFormat, `Backup written to ${result.path}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

export function restoreCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Restore state from backup (jobs paused until resume)" },
    args: {
      from: { type: "string", required: true, description: "Backup directory" },
    },
    async run({ args }) {
      try {
        const result = await restoreBackup(args.from, globals.stateDir);
        emit(
          result,
          globals.outputFormat,
          "Restore complete. Jobs paused; reconnect routes/grants then `keli resume --revalidated`.",
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
