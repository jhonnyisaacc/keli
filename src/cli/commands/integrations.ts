import { defineCommand } from "citty";
import { discoverIntegrations } from "../../integrations/catalog.ts";
import { listIntegrations, probeIntegration } from "../../integrations/registry.ts";
import { listByStatus } from "../../integrations/manifest.ts";
import { readConfig } from "../../state/config.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import "../../integrations/load.ts";

export function integrationsCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List, probe, or discover integrations (discovery never installs)" },
    subCommands: {
      list: integrationsListCommand(globals),
      discover: integrationsDiscoverCommand(globals),
    },
  });
}

function integrationsListCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Show registered integrations and probe status" },
    args: {
      kind: { type: "string", description: "Filter by kind" },
    },
    async run({ args }) {
      try {
        const kind = args.kind as string | undefined;
        const config = await readConfig(globals.stateDir);
        const inventory = listByStatus(config).filter((row) => !kind || row.category === kind);
        const rows = [];
        for (const row of inventory) {
          const profile = listIntegrations().find((p) => p.id === row.id);
          const entry = config?.integrations?.[row.id];
          const status = profile
            ? await probeIntegration(profile.id, {
                settings: entry?.settings ?? {},
                credentialRef: entry?.credentialRef,
                needsReauth: entry?.status?.needsReauth,
              })
            : undefined;
          const readiness = row.readiness;
          rows.push({
            id: row.id,
            kind: row.category,
            readiness,
            inventory: row.status,
            protocol: row.protocol,
            configured: status?.configured ?? false,
            credentialState: status?.credentialState ?? "n/a",
            howToConfigure: status?.howToConfigure ?? row.protocolNote ?? "",
          });
        }
        emit(
          { integrations: rows },
          globals.outputFormat,
          rows
            .map(
              (r) =>
                `${r.id}\t${r.kind}\t${r.readiness}\t${r.protocol}${r.howToConfigure ? `\t${r.howToConfigure}` : ""}`,
            )
            .join("\n"),
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function integrationsDiscoverCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Look up a static pinned catalog; never installs" },
    args: {
      name: { type: "positional", required: true },
    },
    async run({ args }) {
      const result = discoverIntegrations(String(args.name));
      emit(
        result,
        globals.outputFormat,
        [
          result.message,
          ...result.matches.map(
            (m) =>
              `- ${m.id} (${m.kind}): ${m.summary} [pin=${m.reuse.pin}; bundled=${m.bundled}; packages=${m.packages.join(",") || "none"}]`,
          ),
        ].join("\n"),
      );
    },
  });
}
