import { defineCommand } from "citty";
import { discoverIntegrations } from "../../integrations/catalog.ts";
import { listIntegrations, probeIntegration } from "../../integrations/registry.ts";
import { readConfig } from "../../state/config.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import type { IntegrationKind } from "../../integrations/types.ts";
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
        const kind = args.kind as IntegrationKind | undefined;
        const config = await readConfig(globals.stateDir);
        const rows = [];
        for (const profile of listIntegrations(kind)) {
          const entry = config?.integrations?.[profile.id];
          const status = await probeIntegration(profile.id, {
            settings: entry?.settings ?? {},
            credentialRef: entry?.credentialRef,
            needsReauth: entry?.status?.needsReauth,
          });
          rows.push({
            ...status,
            id: profile.id,
            kind: profile.kind,
            enabled: entry?.enabled ?? false,
          });
        }
        emit(
          { integrations: rows },
          globals.outputFormat,
          rows
            .map(
              (r) =>
                `${r.id}\t${r.kind}\t${r.configured ? "configured" : "unset"}\t${r.credentialState}${r.howToConfigure ? `\t${r.howToConfigure}` : ""}`,
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
