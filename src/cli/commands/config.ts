import { defineCommand } from "citty";
import {
  getConfigValue,
  isSecretConfigPath,
  readConfig,
  setConfigValue,
  writeConfig,
} from "../../state/config.ts";
import { addCredential } from "../../integrations/auth.ts";
import { getIntegration, listIntegrations } from "../../integrations/registry.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import "../../integrations/load.ts";

export function configCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Read or write config (single mutation path; secrets go to the keychain)" },
    subCommands: {
      get: configGetCommand(globals),
      set: configSetCommand(globals),
    },
  });
}

function configGetCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Print a config path" },
    args: {
      path: { type: "positional", required: true },
    },
    async run({ args }) {
      try {
        const config = await readConfig(globals.stateDir);
        if (!config) emitError("Run keli init first", globals.outputFormat);
        const value = getConfigValue(config, String(args.path));
        if (isSecretConfigPath(String(args.path))) {
          emit({ path: args.path, value: value ? "[ref]" : undefined }, globals.outputFormat, value ? "[ref]" : "");
          return;
        }
        emit(
          { path: args.path, value },
          globals.outputFormat,
          typeof value === "string" ? value : JSON.stringify(value ?? null),
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function configSetCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Set a config path; secret keys become credential refs" },
    args: {
      path: { type: "positional", required: true },
      value: { type: "positional", required: true },
    },
    async run({ args }) {
      try {
        const path = String(args.path);
        const raw = String(args.value);
        const config = await readConfig(globals.stateDir);
        if (!config) emitError("Run keli init first", globals.outputFormat);

        if (path.startsWith("routing.")) {
          const role = path.slice("routing.".length);
          const allowed = listIntegrations("model-provider").some(
            (p) => p.id === raw || p.aliases.includes(raw),
          );
          const custom = config.providers?.custom?.some((c) => c.id === raw);
          if (!allowed && !custom && raw !== "fixture") {
            emitError(
              `Unknown provider '${raw}' for routing.${role}. Run keli integrations list --kind model-provider`,
              globals.outputFormat,
            );
          }
        }

        if (isSecretConfigPath(path)) {
          const integrationId = inferIntegrationId(path);
          if (integrationId && getIntegration(integrationId)) {
            const ref = await addCredential(integrationId, { stateDir: globals.stateDir, value: raw });
            emit({ path, ref }, globals.outputFormat, `Stored secret as ${ref.service}/${ref.id}`);
            return;
          }
        }

        const next = setConfigValue(config, path, coerce(raw));
        await writeConfig(next, globals.stateDir);
        emit({ path, value: raw }, globals.outputFormat, `Set ${path}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function inferIntegrationId(path: string): string | undefined {
  const parts = path.split(".");
  if (parts[0] === "integrations" && parts[1]) return parts[1];
  return undefined;
}

function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
