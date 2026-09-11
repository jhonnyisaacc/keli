import { defineCommand } from "citty";
import { initializeState } from "../../state/init.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function initCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Initialize Keli state directory" },
    args: {
      project: {
        type: "string",
        description: "Default project name",
        default: "Rocket",
      },
    },
    async run({ args }) {
      try {
        const result = await initializeState(globals.stateDir, {
          projectName: args.project,
          cwd: globals.cwd,
        });
        emit(
          result,
          globals.outputFormat,
          result.created
            ? `Initialized Keli at ${result.stateDir} (project: ${result.projectName})`
            : `Keli already initialized at ${result.stateDir}`,
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
