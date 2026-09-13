import { defineCommand } from "citty";
import { listProviders } from "../../model/provider-registry.ts";
import { readConfig } from "../../state/config.ts";
import { emit } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function providersCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Alias for keli integrations list --kind model-provider" },
    subCommands: {
      list: defineCommand({
        meta: { description: "Show provider availability (config-aware)" },
        async run() {
          const config = await readConfig(globals.stateDir);
          const providers = listProviders(config);
          emit(
            { providers },
            globals.outputFormat,
            providers
              .map(
                (p) =>
                  `${p.id}\t${p.available ? `available via ${p.source}${p.model ? ` (model ${p.model})` : ""}` : "unavailable"}${p.reason ? ` (${p.reason})` : ""}`,
              )
              .join("\n"),
          );
        },
      }),
    },
  });
}
