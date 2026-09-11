import { defineCommand } from "citty";
import { readConfig } from "../../state/config.ts";
import { openDatabase } from "../../state/db.ts";
import { getSchemaVersion, CURRENT_SCHEMA_VERSION } from "../../state/migrate.ts";
import { resolveStateDir, statePaths } from "../../state/paths.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function doctorCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Check Keli health and readiness" },
    async run() {
      const checks: { name: string; ok: boolean; detail?: string }[] = [];
      const stateDir = resolveStateDir(globals.stateDir);
      const paths = statePaths(stateDir);

      const config = await readConfig(stateDir);
      checks.push({
        name: "config",
        ok: !!config?.ownerId,
        detail: config ? `owner=${config.ownerId}` : "missing",
      });

      let db;
      try {
        db = openDatabase(stateDir);
        const version = getSchemaVersion(db);
        const journal = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
        checks.push({
          name: "schema",
          ok: version === CURRENT_SCHEMA_VERSION,
          detail: `version=${version}, expected=${CURRENT_SCHEMA_VERSION}`,
        });
        checks.push({
          name: "wal",
          ok: journal.journal_mode === "wal",
          detail: journal.journal_mode,
        });
      } catch (e) {
        checks.push({ name: "database", ok: false, detail: String(e) });
      } finally {
        db?.close();
      }

      checks.push({
        name: "state_path",
        ok: true,
        detail: paths.sqlite,
      });

      const ok = checks.every((c) => c.ok);
      const report = { ok, checks };

      if (!ok) {
        if (globals.outputFormat === "json") {
          console.error(JSON.stringify(report, null, 2));
        } else {
          for (const c of checks) {
            console.error(`${c.ok ? "ok" : "FAIL"}  ${c.name}: ${c.detail ?? ""}`);
          }
        }
        process.exit(1);
      }

      emit(report, globals.outputFormat, "keli doctor: all checks passed");
    },
  });
}
