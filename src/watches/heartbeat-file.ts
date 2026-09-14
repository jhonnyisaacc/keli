import type { Database } from "bun:sqlite";
import { KeliError } from "../core/errors.ts";
import { upsertWatch } from "./store.ts";
import type { WatchDefinition, WatchKind, WatchNotifyPolicy, WatchRecord } from "./types.ts";

/**
 * HEARTBEAT.md is an authoring surface, not a runtime loop. Each `## <name>` section with
 * `key: value` bullets compiles into one watch *proposal*; nothing runs until the owner
 * approves it. Re-importing an unchanged file is a no-op; a changed section bumps the watch
 * version and returns it to proposed.
 *
 * ```md
 * ## cava
 * - kind: source-collection
 * - target: cava
 * - every: 6h
 * - question: Did Cava publish a new market thesis? What does it imply for BTC and SPY?
 * - requires: cava, market-notes
 * - notify: material-change
 * - channel: 123456 / thread: 987654
 * ```
 */
export type HeartbeatSection = { name: string; fields: Record<string, string>; line: number };

export type HeartbeatParse = {
  proposals: WatchDefinition[];
  problems: Array<{ section: string; line: number; message: string }>;
};

export function parseHeartbeatSections(text: string): HeartbeatSection[] {
  const sections: HeartbeatSection[] = [];
  let current: HeartbeatSection | null = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const heading = /^##\s+(.+?)\s*$/.exec(raw);
    if (heading) {
      current = { name: heading[1]!.trim(), fields: {}, line: index + 1 };
      sections.push(current);
      return;
    }
    if (!current) return;
    const field = /^\s*[-*]\s*([A-Za-z][A-Za-z0-9_ -]*?)\s*:\s*(.+?)\s*$/.exec(raw);
    if (field) current.fields[field[1]!.trim().toLowerCase()] = field[2]!.trim();
  });
  return sections;
}

function scheduleFrom(fields: Record<string, string>): string | null {
  const every = fields.every ?? fields.schedule;
  if (!every) return null;
  if (/^(every:|daily:)/i.test(every)) return every;
  const m = /^(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hrs|hour|hours)$/i.exec(every);
  if (m) {
    const unit = m[2]!.toLowerCase()[0];
    return `every:${m[1]}${unit}`;
  }
  const daily = /^(\d{2}):(\d{2})$/.exec(every);
  if (daily) return `daily:${daily[1]}:${daily[2]}`;
  return null;
}

export function compileHeartbeat(text: string): HeartbeatParse {
  const proposals: WatchDefinition[] = [];
  const problems: HeartbeatParse["problems"] = [];
  for (const section of parseHeartbeatSections(text)) {
    const f = section.fields;
    const kind = (f.kind ?? (f.url ? "url" : f.collection || f.target ? "source-collection" : "")) as WatchKind | "";
    const target = f.target ?? f.collection ?? f.url ?? (kind === "responsibility" ? section.name : "");
    const schedule = scheduleFrom(f) ?? (kind === "responsibility" && (f.notify === "daily-brief" || !f.every) ? "daily:09:00" : null);
    const question = f.question ?? f.ask ?? f.objective;
    if (!kind || !target || !schedule || !question) {
      const missing = [!kind && "kind", !target && "target", !schedule && "every", !question && "question"].filter(Boolean);
      problems.push({ section: section.name, line: section.line, message: `missing ${missing.join(", ")}` });
      continue;
    }
    const requires = (f.requires ?? f.cite ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const notify = (f.notify ?? "material-change") as WatchNotifyPolicy;
    if (!["material-change", "always", "silent", "daily-brief"].includes(notify)) {
      problems.push({ section: section.name, line: section.line, message: `unknown notify policy ${notify}` });
      continue;
    }
    const budget: WatchDefinition["budget"] = {};
    if (f["max-requests"]) budget.requestsMax = Number(f["max-requests"]);
    if (f["max-tokens"]) budget.tokensMax = Number(f["max-tokens"]);
    if (f["max-tools"]) budget.toolCallsMax = Number(f["max-tools"]);
    if (f["max-cents"]) budget.monetaryBudgetCents = Number(f["max-cents"]);
    if (f["max-failures"]) budget.maxConsecutiveFailures = Number(f["max-failures"]);
    proposals.push({
      name: section.name,
      kind,
      trigger: { schedule, target },
      budget,
      evidence: {
        question,
        autonomy: f.autonomy === "yes" || kind === "responsibility",
        requiredSubjects: f.subjects?.split(",").map(s => s.trim()).filter(Boolean),
        requiredCollections: requires.length ? requires : undefined,
        citationsRequired: f.citations ? f.citations !== "no" : undefined,
        objective: f.objective,
        constraints: f.constraints,
        completion: f.completion,
        capabilities: ((ids) => ids.length ? ids : undefined)((f.capabilities ?? "").split(/[,\s]+/).map(s => s.trim()).filter(Boolean)),
        review: f.review === "event" || f.review === "scheduled" || f.review === "event+scheduled" ? f.review : kind === "responsibility" ? "scheduled" : undefined,
        hypotheses: f.hypotheses,
        nextReview: f["next-review"],
      },
      notify: { policy: notify, transport: f.channel || f.thread ? "discord" : undefined, channelId: f.channel, threadId: f.thread },
    });
  }
  return { proposals, problems };
}

export type HeartbeatImportResult = {
  created: WatchRecord[];
  updated: WatchRecord[];
  unchanged: WatchRecord[];
  problems: HeartbeatParse["problems"];
};

/** Imports every section as a proposal. Nothing becomes active here; approval is a separate, explicit step. */
export async function importHeartbeatFile(
  db: Database,
  input: { ownerId: string; scope: string; path: string },
): Promise<HeartbeatImportResult> {
  const file = Bun.file(input.path);
  if (!(await file.exists())) throw new KeliError(`HEARTBEAT file not found: ${input.path}`, "invalid_request");
  const parsed = compileHeartbeat(await file.text());
  const result: HeartbeatImportResult = { created: [], updated: [], unchanged: [], problems: parsed.problems };
  for (const definition of parsed.proposals) {
    try {
      const { watch, created, changed } = upsertWatch(db, {
        ownerId: input.ownerId,
        scope: input.scope,
        definition,
        sourceRef: `file:${input.path}#${definition.name}`,
      });
      if (created) result.created.push(watch);
      else if (changed) result.updated.push(watch);
      else result.unchanged.push(watch);
    } catch (e) {
      result.problems.push({ section: definition.name, line: 0, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
