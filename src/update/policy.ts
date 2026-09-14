import type { Database } from "bun:sqlite";
import { isExecutionBlocked, readControl } from "../ops/control.ts";
import { readConfig, writeConfig, type KeliConfig } from "../state/config.ts";
import { resolveStateDir } from "../state/paths.ts";
import { checkForUpdate, type UpdateCheckResult } from "./check.ts";
import { installUpdate, recordUpdateOutcome, type InstallResult } from "./install.ts";

export type UpdateMode = NonNullable<NonNullable<KeliConfig["update"]>["mode"]>;

export const DEFAULT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type ScheduledUpdateResult = {
  mode: UpdateMode;
  checked: boolean;
  outcome: "off" | "checked-recently" | "up-to-date" | "available" | "deferred" | "installed" | "failed";
  latest?: string;
  detail?: string;
  notified: boolean;
};

export type ScheduledUpdateDeps = {
  db: Database;
  stateDir?: string;
  now?: Date;
  /** Owner-facing notification; called at most once per run. */
  notify?: (text: string) => Promise<void>;
  /** Injection points for tests. */
  check?: (manifestUrl?: string) => Promise<UpdateCheckResult>;
  install?: (options: { manifestUrl?: string; stateDir?: string }) => Promise<InstallResult>;
  isIdle?: (db: Database) => IdleReport;
};

export type IdleReport = { idle: boolean; reasons: string[] };

/**
 * Idle boundary: no active runs, no pending/running job occurrences, no unprocessed inbox
 * messages. Updates never interrupt work in flight.
 */
export function idleReport(db: Database): IdleReport {
  const reasons: string[] = [];
  const runs = (db.query("SELECT COUNT(*) AS n FROM runs WHERE status = 'active'").get() as { n: number }).n;
  if (runs) reasons.push(`${runs} active run(s)`);
  const occurrences = (
    db.query("SELECT COUNT(*) AS n FROM job_occurrences WHERE status IN ('pending', 'running')").get() as { n: number }
  ).n;
  if (occurrences) reasons.push(`${occurrences} job occurrence(s) in flight`);
  const research = (db.query("SELECT COUNT(*) AS n FROM watch_occurrences WHERE status='active'").get() as { n: number }).n;
  if (research) reasons.push(`${research} research occurrence(s) in flight`);
  const inbox = (db.query("SELECT COUNT(*) AS n FROM transport_inbox WHERE processed_at IS NULL").get() as { n: number }).n;
  if (inbox) reasons.push(`${inbox} unprocessed inbox message(s)`);
  return { idle: reasons.length === 0, reasons };
}

async function notifyOnce(deps: ScheduledUpdateDeps, text: string): Promise<boolean> {
  if (!deps.notify) return false;
  try {
    await deps.notify(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Daily update policy. `off` does nothing. `notify` checks once per interval and tells the
 * owner once per new version. `auto` additionally installs, but only at an idle boundary and
 * never while execution is paused; otherwise it defers and says so in the recorded outcome.
 */
export async function runScheduledUpdate(deps: ScheduledUpdateDeps): Promise<ScheduledUpdateResult> {
  const stateDir = resolveStateDir(deps.stateDir);
  const now = deps.now ?? new Date();
  const config = await readConfig(stateDir);
  const mode: UpdateMode = config?.update?.mode ?? "off";
  if (!config || mode === "off") return { mode, checked: false, outcome: "off", notified: false };

  const lastCheck = config.update?.lastCheckAt ? Date.parse(config.update.lastCheckAt) : 0;
  if (now.getTime() - lastCheck < DEFAULT_CHECK_INTERVAL_MS) {
    return { mode, checked: false, outcome: "checked-recently", notified: false };
  }

  const check = deps.check ?? checkForUpdate;
  let result: UpdateCheckResult;
  try {
    result = await check(config.update?.manifestUrl);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await recordUpdateOutcome(stateDir, { at: now.toISOString(), outcome: "failed", detail: `check: ${detail}` }, { lastCheckAt: now.toISOString() });
    return { mode, checked: true, outcome: "failed", detail, notified: false };
  }

  if (!result.updateAvailable || !result.artifact) {
    await recordUpdateOutcome(
      stateDir,
      { at: now.toISOString(), outcome: "up-to-date", version: result.current },
      { lastCheckAt: now.toISOString() },
    );
    return { mode, checked: true, outcome: "up-to-date", latest: result.latest, notified: false };
  }

  if (mode === "notify") {
    const alreadyAnnounced = config.update?.last?.outcome === "available" && config.update.last.version === result.latest;
    const notified = alreadyAnnounced ? false : await notifyOnce(deps, `Keli ${result.latest} is available (running ${result.current}). Run \`keli update --install\` when convenient.`);
    await recordUpdateOutcome(
      stateDir,
      { at: now.toISOString(), outcome: "available", version: result.latest },
      { lastCheckAt: now.toISOString() },
    );
    return { mode, checked: true, outcome: "available", latest: result.latest, notified };
  }

  // auto
  const control = await readControl(stateDir);
  const idle = (deps.isIdle ?? idleReport)(deps.db);
  if (isExecutionBlocked(control) || !idle.idle) {
    const detail = isExecutionBlocked(control) ? "execution paused" : idle.reasons.join("; ");
    // Deferred checks are retried next tick rather than next day: do not advance lastCheckAt.
    await recordUpdateOutcome(stateDir, { at: now.toISOString(), outcome: "deferred", version: result.latest, detail });
    return { mode, checked: true, outcome: "deferred", latest: result.latest, detail, notified: false };
  }

  const install = deps.install ?? installUpdate;
  try {
    const installed = await install({ manifestUrl: config.update?.manifestUrl, stateDir });
    const fresh = await readConfig(stateDir);
    if (fresh) await writeConfig({ ...fresh, update: { ...(fresh.update ?? {}), lastCheckAt: now.toISOString() } }, stateDir);
    const notified = await notifyOnce(
      deps,
      `Keli updated to ${installed.version} (from ${installed.previousVersion ?? "unknown"}).${installed.rollbackAvailable ? " Rollback available with `keli update --rollback`." : ""}`,
    );
    return { mode, checked: true, outcome: "installed", latest: installed.version, notified };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const fresh = await readConfig(stateDir);
    if (fresh) await writeConfig({ ...fresh, update: { ...(fresh.update ?? {}), lastCheckAt: now.toISOString() } }, stateDir);
    const notified = await notifyOnce(deps, `Keli update to ${result.latest} failed: ${detail}. The running release is unchanged.`);
    return { mode, checked: true, outcome: "failed", latest: result.latest, detail, notified };
  }
}
