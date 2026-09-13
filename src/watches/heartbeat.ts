import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import type { ConversationLoop } from "../conversation/loop.ts";
import type { TurnContext, TurnOutcome } from "../conversation/types.ts";
import type { BehaviorService } from "../core/behavior.ts";
import type { CapabilityGate } from "../core/capability-gate.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { coalescedDueOccurrence, parseSchedule } from "../jobs/schedule.ts";
import { upsertConversation } from "../memory/conversations.ts";
import { isExecutionBlocked, readControl } from "../ops/control.ts";
import type { SourceReader } from "../sources/reader.ts";
import { getProjectById } from "../state/repos.ts";
import {
  appendWatchEvent,
  listWatches,
  recordWatchAttempt,
  recordWatchFailure,
  recordWatchSuccess,
  setWatchStatus,
} from "./store.ts";
import type { WatchNotifyPolicy, WatchRecord } from "./types.ts";

export type WatchNotification = {
  watch: WatchRecord;
  kind: "changed" | "missing_evidence" | "failed" | "paused";
  text: string;
  outcome?: TurnOutcome;
};

export type HeartbeatDeps = {
  ownerId: string;
  stateDir: string;
  behavior: BehaviorService;
  loop: ConversationLoop;
  sources?: SourceReader;
  /** Needed for `url` watches; the fetch runs through the gate under network policy. */
  capabilityGate?: CapabilityGate;
  policy?: ResourcePolicy;
  networkHosts?: string[];
  /** Delivers one notification; failures are recorded on the watch, never retried in-tick. */
  notify?: (notification: WatchNotification) => Promise<void>;
};

export type WatchTickOutcome = {
  watchId: string;
  name: string;
  result: "not-due" | "unchanged" | "researched" | "already-researched" | "failed" | "paused" | "skipped";
  fingerprint?: string;
  outcomeKind?: TurnOutcome["kind"];
  notified?: boolean;
  error?: string;
};

export type HeartbeatResult = {
  scanned: number;
  due: number;
  modelWakes: number;
  notifications: number;
  outcomes: WatchTickOutcome[];
};

type Fingerprint = { hash: string; summary: Record<string, unknown> };

async function fingerprintFor(watch: WatchRecord, deps: HeartbeatDeps): Promise<Fingerprint> {
  if (watch.kind === "source-collection") {
    if (!deps.sources) throw new Error("no source reader configured");
    const fp = deps.sources.fingerprint(watch.trigger.target);
    return { hash: fp.hash, summary: { documents: fp.documents, latestPublishedAt: fp.latestPublishedAt } };
  }
  if (!deps.capabilityGate || !deps.policy) throw new Error("url watches need a capability gate");
  const { result } = await deps.capabilityGate.run(
    { capabilityId: "http.fetch", input: { url: watch.trigger.target }, resources: [] },
    deps.policy,
    watch.scope,
    undefined,
    { networkHosts: deps.networkHosts, budgetBytesMax: 262_144 },
  );
  if (!result.ok) throw new Error(result.error?.message ?? "http.fetch failed");
  const body = String((result.output as { body?: string }).body ?? "");
  return { hash: createHash("sha256").update(body).digest("hex"), summary: { bytes: body.length } };
}

function isDue(watch: WatchRecord, now: Date): boolean {
  const schedule = parseSchedule(watch.trigger.schedule);
  const anchor = watch.lastAttemptAt ? new Date(watch.lastAttemptAt) : new Date(watch.createdAt);
  if (!watch.lastAttemptAt) return true;
  return coalescedDueOccurrence(schedule, anchor, now) !== null;
}

function notifyPolicy(watch: WatchRecord, behavior: BehaviorService): WatchNotifyPolicy {
  const rule = behavior.getRule(watch.scope, "watch.notify")?.value as WatchNotifyPolicy | undefined;
  return watch.notify.policy ?? rule ?? "material-change";
}

function turnContextFor(db: Database, watch: WatchRecord, ownerId: string): TurnContext {
  const projectId = watch.scope.replace(/^project:/, "");
  const project = getProjectById(db, projectId);
  const conversation = upsertConversation(db, { scope: watch.scope, transport: "watch", externalId: watch.id });
  return {
    ownerId,
    projectId,
    projectName: project?.name ?? projectId,
    scope: watch.scope,
    conversationId: conversation.id,
    origin: {
      transport: "watch",
      externalId: watch.id,
      channelId: watch.notify.channelId,
      threadId: watch.notify.threadId,
    },
  };
}

function researchPrompt(watch: WatchRecord, fingerprint: Fingerprint, previous?: string): string {
  const required = watch.evidence.requiredCollections?.length
    ? ` Cite the collections: ${watch.evidence.requiredCollections.join(", ")}.`
    : "";
  const change = previous ? "The watched source changed since the last check." : "This is the first observation of the watched source.";
  return `${change} Watch "${watch.name}" (${watch.kind}: ${watch.trigger.target}; ${JSON.stringify(fingerprint.summary)}). ${watch.evidence.question}${required} State what changed, what it supports or contradicts, the assumptions involved, and what would invalidate the conclusion. Do not recommend executing any trade or action.`;
}

async function deliver(deps: HeartbeatDeps, db: Database, notification: WatchNotification): Promise<boolean> {
  if (!deps.notify) return false;
  try {
    await deps.notify(notification);
    appendWatchEvent(db, notification.watch.id, "notified", { kind: notification.kind, chars: notification.text.length });
    return true;
  } catch (e) {
    recordWatchFailure(db, notification.watch.id, new Date().toISOString(), `notify: ${e instanceof Error ? e.message : String(e)}`);
    appendWatchEvent(db, notification.watch.id, "failed", { stage: "notify", error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

/**
 * One heartbeat tick. For each due active watch: compute a cheap fingerprint; if unchanged,
 * record success and stop (zero model calls). If changed, run one research turn keyed by the
 * fingerprint so a restart never repeats it, then notify once according to policy. Attempt and
 * last-success state is persisted so stalls are visible; repeated failures pause the watch.
 */
export async function tickWatches(db: Database, deps: HeartbeatDeps, now = new Date()): Promise<HeartbeatResult> {
  const result: HeartbeatResult = { scanned: 0, due: 0, modelWakes: 0, notifications: 0, outcomes: [] };
  const control = await readControl(deps.stateDir);
  if (isExecutionBlocked(control)) return result;

  const watches = listWatches(db, { status: "active" });
  result.scanned = watches.length;

  for (const watch of watches) {
    if (!isDue(watch, now)) {
      result.outcomes.push({ watchId: watch.id, name: watch.name, result: "not-due" });
      continue;
    }
    result.due += 1;
    const at = now.toISOString();
    recordWatchAttempt(db, watch.id, at);

    let fingerprint: Fingerprint;
    try {
      fingerprint = await fingerprintFor(watch, deps);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordWatchFailure(db, watch.id, at, error);
      appendWatchEvent(db, watch.id, "failed", { stage: "fingerprint", error });
      const failures = watch.attempts + 1;
      if (failures >= (watch.budget.maxConsecutiveFailures ?? 3)) {
        setWatchStatus(db, watch.id, "paused", { reason: "consecutive failures", failures });
        const notified = await deliver(deps, db, {
          watch,
          kind: "paused",
          text: `Watch "${watch.name}" paused after ${failures} consecutive failures. Last error: ${error}`,
        });
        if (notified) result.notifications += 1;
        result.outcomes.push({ watchId: watch.id, name: watch.name, result: "paused", error, notified });
      } else {
        result.outcomes.push({ watchId: watch.id, name: watch.name, result: "failed", error });
      }
      continue;
    }

    if (fingerprint.hash === watch.lastFingerprint) {
      recordWatchSuccess(db, watch.id, at, fingerprint.hash);
      appendWatchEvent(db, watch.id, "unchanged", { fingerprint: fingerprint.hash.slice(0, 12) });
      result.outcomes.push({ watchId: watch.id, name: watch.name, result: "unchanged", fingerprint: fingerprint.hash });
      continue;
    }

    appendWatchEvent(db, watch.id, "changed", { fingerprint: fingerprint.hash.slice(0, 12), previous: watch.lastFingerprint?.slice(0, 12), ...fingerprint.summary });
    const ctx = turnContextFor(db, watch, deps.ownerId);
    const sourceRef = `watch:${watch.id}:${fingerprint.hash}`;
    let outcome: TurnOutcome;
    try {
      outcome = await deps.loop.runTurn(ctx, researchPrompt(watch, fingerprint, watch.lastFingerprint), {
        sourceRef,
        policy: { requiredCollections: watch.evidence.requiredCollections, citationsRequired: watch.evidence.citationsRequired },
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordWatchFailure(db, watch.id, at, error);
      appendWatchEvent(db, watch.id, "failed", { stage: "research", error });
      result.outcomes.push({ watchId: watch.id, name: watch.name, result: "failed", fingerprint: fingerprint.hash, error });
      continue;
    }
    const replayed = outcome.replayed === true;
    if (!replayed) result.modelWakes += 1;
    appendWatchEvent(db, watch.id, "researched", { kind: outcome.kind, steps: outcome.steps, toolCalls: outcome.toolCalls, replayed });

    const policy = notifyPolicy(watch, deps.behavior);
    let notified = false;
    if (outcome.kind === "answer") {
      recordWatchSuccess(db, watch.id, at, fingerprint.hash);
      if (policy !== "silent" && !replayed) {
        notified = await deliver(deps, db, { watch, kind: "changed", text: `Watch "${watch.name}": ${outcome.text}`, outcome });
      }
    } else if (outcome.kind === "missing_evidence" || outcome.kind === "clarify") {
      // Evidence is missing or the question was ambiguous: the fingerprint counts as observed
      // (so the same change is not re-researched), but the owner is told once what is needed.
      recordWatchSuccess(db, watch.id, at, fingerprint.hash);
      if (policy !== "silent" && !replayed) {
        notified = await deliver(deps, db, { watch, kind: "missing_evidence", text: `Watch "${watch.name}" needs input: ${outcome.text}`, outcome });
      }
    } else {
      recordWatchFailure(db, watch.id, at, outcome.text);
      if (policy === "always" && !replayed) {
        notified = await deliver(deps, db, { watch, kind: "failed", text: `Watch "${watch.name}" failed: ${outcome.text}`, outcome });
      }
    }
    if (notified) result.notifications += 1;
    result.outcomes.push({
      watchId: watch.id,
      name: watch.name,
      result: replayed ? "already-researched" : "researched",
      fingerprint: fingerprint.hash,
      outcomeKind: outcome.kind,
      notified,
    });
  }

  return result;
}
