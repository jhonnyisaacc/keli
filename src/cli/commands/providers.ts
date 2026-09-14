import { defineCommand } from "citty";
import { listProviders } from "../../model/provider-registry.ts";
import { readConfig } from "../../state/config.ts";
import { emit } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function providersCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Alias for keli integrations list --kind model-provider" },
    subCommands: {
      models: defineCommand({
        meta: { description: "List bundled model suggestions; explicit account-specific model IDs are also accepted" },
        args: { provider: { type: "positional", required: true } },
        async run({ args }) {
          const { getIntegration } = await import("../../integrations/registry.ts");
          const { catalogModels } = await import("../../integrations/catalog-provider.ts");
          const profile = getIntegration(String(args.provider));
          if (!profile || profile.kind !== "model-provider") throw new Error("Unknown model provider");
          const models = catalogModels(profile.id);
          if (!models.length) models.push(...(profile.defaultModels ?? []));
          emit({ provider: profile.id, models, source: "bundled suggestions, not account entitlement" }, globals.outputFormat, models.length ? models.join("\n") : "Set your server's model ID during keli setup provider");
        },
      }),
      list: defineCommand({
        meta: { description: "Show provider availability (config-aware)" },
        async run() {
          const config = await readConfig(globals.stateDir);
          const providers = listProviders(config);
          emit(
            { providers },
            globals.outputFormat,
            providers
              .map((p) => {
                const layer = p.readiness ?? (p.available ? "configured" : "catalog");
                const avail = p.available ? `available via ${p.source ?? "config"}` : "unavailable";
                return `${p.id}\t${layer}\t${avail}${p.model ? ` (model ${p.model})` : ""}${p.reason ? ` (${p.reason})` : ""}`;
              })
              .join("\n"),
          );
        },
      }),
    },
  });
}
