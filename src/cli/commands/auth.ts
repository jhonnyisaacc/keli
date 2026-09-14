import { defineCommand } from "citty";
import { addCredential, credentialStatus, removeCredential } from "../../integrations/auth.ts";
import { getIntegration, listIntegrations } from "../../integrations/registry.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import "../../integrations/load.ts";

export function authCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Manage integration credentials (refs only; secrets stay in the keychain)" },
    subCommands: {
      add: authAddCommand(globals),
      list: authListCommand(globals),
      status: authStatusCommand(globals),
      remove: authRemoveCommand(globals),
      logout: authLogoutCommand(globals),
    },
  });
}

function authAddCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Store a credential ref for an integration" },
    args: {
      integration: { type: "positional", required: true, description: "Integration id" },
      type: { type: "string", description: "api-key | token | external-cli | oauth-device" },
      value: { type: "string", description: "Secret value (omit to be prompted)" },
    },
    async run({ args }) {
      try {
        let value = args.value as string | undefined;
        const type = args.type as "api-key" | "token" | "external-cli" | "oauth-device" | undefined;
        if (!value && type !== "external-cli" && type !== "oauth-device" && getIntegration(String(args.integration))?.auth.type !== "oauth-device" && process.stdin.isTTY) {
          const readline = await import("node:readline/promises");
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          value = await rl.question("Credential (input is recorded; prefer a TTY): ");
          rl.close();
        }
        const ref = await addCredential(String(args.integration), {
          stateDir: globals.stateDir,
          type,
          value,
          oauthCallbacks: process.stdin.isTTY ? {
            onAuth: ({ url, instructions }) => { console.log(`Open this sign-in link in your browser:\n${url}`); if (instructions) console.log(instructions); },
            onPrompt: async ({ message }) => {
              const { createInterface } = await import("node:readline/promises");
              const rl = createInterface({ input: process.stdin, output: process.stdout });
              try { return await rl.question(`${message} `); } finally { rl.close(); }
            },
          } : undefined,
        });
        emit({ ref }, globals.outputFormat, `Stored credential ref ${ref.service}/${ref.id}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function authListCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List credential state (never prints secrets)" },
    async run() {
      try {
        const rows = [];
        for (const profile of listIntegrations()) {
          if (profile.auth.type === "none") continue;
          const state = await credentialStatus(profile.id, { stateDir: globals.stateDir });
          rows.push({ id: profile.id, kind: profile.kind, credentialState: state });
        }
        emit(
          { credentials: rows },
          globals.outputFormat,
          rows.map((r) => `${r.id}\t${r.credentialState}`).join("\n"),
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function authStatusCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Show credential state for one integration" },
    args: {
      integration: { type: "positional", required: true },
    },
    async run({ args }) {
      try {
        const state = await credentialStatus(String(args.integration), { stateDir: globals.stateDir });
        emit({ id: args.integration, credentialState: state }, globals.outputFormat, `${args.integration}: ${state}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function authRemoveCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Remove a stored credential ref" },
    args: {
      integration: { type: "positional", required: true },
    },
    async run({ args }) {
      try {
        await removeCredential(String(args.integration), { stateDir: globals.stateDir });
        emit({ removed: args.integration }, globals.outputFormat, `Removed credential for ${args.integration}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function authLogoutCommand(globals: CliGlobals) {
  return authRemoveCommand(globals);
}
