import { defineCommand } from "citty";
import { readConfig } from "../../state/config.ts";
import { openDatabase } from "../../state/db.ts";
import { getSchemaVersion } from "../../state/migrate.ts";
import { listProjects, listActiveRules, listRecentJournal } from "../../state/repos.ts";
import { resolveStateDir } from "../../state/paths.ts";
import { toRule } from "../../core/types.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function inspectCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Show discovered rules, projects, and schema state" },
    args: {
      json: {
        type: "boolean",
        description: "Output JSON (alias for --output-format json)",
        default: false,
      },
    },
    async run({ args }) {
      const format = args.json ? "json" : globals.outputFormat;
      try {
        const stateDir = resolveStateDir(globals.stateDir);
        const config = await readConfig(stateDir);
        if (!config?.ownerId) {
          emitError("Not initialized. Run: keli init", format);
        }

        const db = openDatabase(stateDir);
        const payload = {
          schemaVersion: getSchemaVersion(db),
          ownerId: config.ownerId,
          defaultProjectId: config.defaultProjectId,
          projects: listProjects(db),
          rules: listActiveRules(db).map((r) => {
            const rule = toRule(r);
            return {
              scope: rule.scope,
              key: rule.key,
              value: rule.value,
              revision: rule.revision,
              provenance: {
                actor: rule.provenance.actor,
                source: rule.provenance.source,
              },
            };
          }),
          recentChanges: (listRecentJournal(db, 10) as Record<string, unknown>[]).map((j) => ({
            entityType: j.entity_type,
            entityId: j.entity_id,
            revision: j.revision,
            actor: j.actor,
            createdAt: j.created_at,
          })),
        };
        db.close();
        emit(payload, format);
      } catch (e) {
        emitError(String(e), format);
      }
    },
  });
}
