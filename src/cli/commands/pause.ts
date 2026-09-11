import { defineCommand } from "citty";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import {
  pauseAutonomy,
  resumeAutonomy,
  stopAllExecution,
  readControl,
} from "../../ops/control.ts";

export function pauseCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Pause autonomous execution (jobs and effectful capabilities)" },
    async run() {
      try {
        const control = await pauseAutonomy(globals.stateDir);
        emit(control, globals.outputFormat, "Autonomy paused");
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

export function resumeCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Resume autonomous execution after pause or restore" },
    args: {
      revalidated: {
        type: "boolean",
        default: false,
        description: "Confirm routes/grants were revalidated after restore",
      },
    },
    async run({ args }) {
      try {
        const control = await resumeAutonomy(globals.stateDir, {
          routesRevalidated: args.revalidated,
        });
        emit(control, globals.outputFormat, "Autonomy resumed");
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

export function stopCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Stop all execution (stronger than pause)" },
    async run() {
      try {
        const control = await stopAllExecution(globals.stateDir);
        emit(control, globals.outputFormat, "All execution stopped");
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

export function statusCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Show global execution control state" },
    async run() {
      const control = await readControl(globals.stateDir);
      emit(control, globals.outputFormat, JSON.stringify(control));
    },
  });
}
