import { defineCommand } from "citty";
import { emit } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import { KELI_VERSION } from "../../version.ts";

function stub(name: string, detail: string, globals: CliGlobals) {
  return defineCommand({
    meta: { description: `${name} (not configured in 0.1-A)` },
    async run() {
      emit(
        { stub: true, command: name, detail },
        globals.outputFormat,
        `${name}: ${detail}`,
      );
      process.exit(0);
    },
  });
}

export function loginCommand(globals: CliGlobals) {
  return stub("login", "Provider OAuth not configured yet. Coming in onboarding increment.", globals);
}

export function logoutCommand(globals: CliGlobals) {
  return stub("logout", "No cached credentials to clear in 0.1-A.", globals);
}

export function updateCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Check or install updates" },
    args: {
      check: { type: "boolean", default: false },
    },
    async run() {
      emit(
        {
          current: KELI_VERSION,
          updateAvailable: false,
          message: "Update installation not implemented in 0.1-A.",
        },
        globals.outputFormat,
        `keli ${KELI_VERSION} (no updates checked in 0.1-A)`,
      );
    },
  });
}

export function versionCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Print version information" },
    async run() {
      emit(
        {
          version: KELI_VERSION,
          bun: Bun.version,
        },
        globals.outputFormat,
        `keli ${KELI_VERSION} (bun ${Bun.version})`,
      );
    },
  });
}

export function sessionsCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Session management (stub)" },
    subCommands: {
      list: stub("sessions list", "Session CRUD reserved for a later increment.", globals),
    },
  });
}

export function agentCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "ACP agent host (stub)" },
    subCommands: {
      stdio: stub("agent stdio", "ACP delegate host deferred to 0.1-C.", globals),
    },
  });
}
