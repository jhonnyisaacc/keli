import { defineCommand } from "citty";
import { listProviders } from "../../model/provider-registry.ts";
import { emit } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function providersCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List configured model providers" },
    subCommands: {
      list: defineCommand({
        meta: { description: "Show provider availability" },
        async run() {
          const providers = listProviders();
          emit(
            { providers },
            globals.outputFormat,
            providers
              .map((p) => `${p.id}\t${p.available ? "available" : "unavailable"}${p.reason ? ` (${p.reason})` : ""}`)
              .join("\n"),
          );
        },
      }),
    },
  });
}
