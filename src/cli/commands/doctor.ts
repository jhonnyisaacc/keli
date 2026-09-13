import { defineCommand } from "citty";
import { readConfig } from "../../state/config.ts";
import { openDatabase } from "../../state/db.ts";
import { getSchemaVersion, CURRENT_SCHEMA_VERSION } from "../../state/migrate.ts";
import { resolveStateDir, statePaths } from "../../state/paths.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import { probeSandbox } from "../../execution/sandbox.ts";
import { probeBrowserBackends } from "../../execution/browser-backends.ts";
import { defaultCredentialSource } from "../../credentials/source.ts";
import { listIntegrations, probeIntegration } from "../../integrations/registry.ts";
import "../../integrations/load.ts";

export function doctorCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Check Keli health and readiness" },
    args: {
      fix: { type: "boolean", default: false, description: "Safe repairs only; never touches secrets" },
    },
    async run({ args }) {
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
        db = await openDatabase(stateDir);
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

      const sandbox = await probeSandbox();
      checks.push({
        name: "sandbox",
        ok: sandbox.available || sandbox.platform !== "linux",
        detail: sandbox.available
          ? `${sandbox.platform} backend ready`
          : `${sandbox.platform}: ${sandbox.reason ?? "unavailable"}`,
      });

      const browserStatuses = await probeBrowserBackends({
        primary: config?.browser?.primary,
        fallback: config?.browser?.fallback,
      });
      const browserReady = browserStatuses.filter((s) => s.available);
      checks.push({
        name: "browser",
        ok: true,
        detail: browserReady.length
          ? `session backends: ${browserReady.map((s) => s.kind).join(", ")}; static pages: web.fetch`
          : `no session backend configured; static pages: http.fetch/web.fetch (${browserStatuses.map((s) => s.kind).join(", ")} probed)`,
      });

      const creds = defaultCredentialSource();
      checks.push({
        name: "credentials",
        ok: creds.available || creds.name === "locked",
        detail: creds.available ? creds.name : "locked (expected on headless hosts)",
      });

      checks.push({
        name: "setup",
        ok: true,
        detail: config?.setup?.completedAt
          ? `completed (${config.setup.transport ?? "unknown transport"})`
          : "not completed — run: keli setup",
      });

      for (const profile of listIntegrations()) {
        if (profile.kind === "browser-backend") continue;
        const entry = config?.integrations?.[profile.id];
        const status = await probeIntegration(profile.id, {
          settings: entry?.settings ?? {},
          credentialRef: entry?.credentialRef,
          needsReauth: entry?.status?.needsReauth,
        });
        if (args.fix && entry?.status?.needsReauth && status.reachable) {
          entry.status.needsReauth = false;
          entry.status.lastProbe = new Date().toISOString();
          const { writeConfig } = await import("../../state/config.ts");
          await writeConfig({ ...config!, integrations: { ...config!.integrations, [profile.id]: entry } }, stateDir);
        }
        const failConfigured =
          Boolean(entry?.enabled) && (status.credentialState === "locked" || status.credentialState === "needs-reauth");
        checks.push({
          name: `integration:${profile.id}`,
          ok: !failConfigured,
          detail: `${status.configured ? "configured" : "unset"} ${status.credentialState}${status.reason ? ` (${status.reason})` : ""}`,
        });
      }

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
