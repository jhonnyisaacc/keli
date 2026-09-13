import { defineCommand } from "citty";
import { emit } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import { KELI_VERSION } from "../../version.ts";
import { addCredential, removeCredential } from "../../integrations/auth.ts";

export function loginCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Alias for keli auth add" },
    args: {
      provider: { type: "string", description: "Integration id" },
      value: { type: "string", description: "Credential value" },
    },
    async run({ args }) {
      if (!args.provider) {
        emit(
          { alias: "auth add", hint: "keli auth add <integration>" },
          globals.outputFormat,
          "login is an alias of keli auth add <integration>",
        );
        return;
      }
      const ref = await addCredential(args.provider, { stateDir: globals.stateDir, value: args.value });
      emit({ ref }, globals.outputFormat, `Stored credential ref ${ref.service}/${ref.id}`);
    },
  });
}

export function logoutCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Alias for keli auth logout" },
    args: {
      provider: { type: "string", description: "Integration id" },
    },
    async run({ args }) {
      if (!args.provider) {
        emit(
          { alias: "auth logout", hint: "keli auth logout <integration>" },
          globals.outputFormat,
          "logout is an alias of keli auth logout <integration>",
        );
        return;
      }
      await removeCredential(args.provider, { stateDir: globals.stateDir });
      emit({ removed: args.provider }, globals.outputFormat, `Removed credential for ${args.provider}`);
    },
  });
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

export function agentCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "ACP agent host (stub)" },
    subCommands: {
      stdio: defineCommand({
        meta: { description: "ACP delegate host (not a v0.1.0 requirement)" },
        async run() {
          emit(
            { stub: true, command: "agent stdio", detail: "Hosting Keli as an ACP agent is post-v0.1.0." },
            globals.outputFormat,
            "agent stdio: hosting Keli as an ACP agent is post-v0.1.0.",
          );
        },
      }),
    },
  });
}
