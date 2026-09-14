/**
 * Compiled watch records. A watch is what SOUL/HEARTBEAT prose becomes once the owner approves
 * it: a scoped trigger with a budget, an evidence requirement, and a notification policy. The
 * heartbeat processes due watches; it never rereads a personality file looking for work.
 */
export type WatchKind = "source-collection" | "url";

export type WatchStatus = "proposed" | "active" | "paused" | "retired";

export type WatchTrigger = {
  /** `every:<n>s|m|h` or `daily:HH:MM` (same grammar as jobs). */
  schedule: string;
  /** For `source-collection`: the indexed collection id. For `url`: the URL to fingerprint. */
  target: string;
};

export type WatchBudget = {
  requestsMax?: number;
  tokensMax?: number;
  toolCallsMax?: number;
  monetaryBudgetCents?: number;
  /** Consecutive failures before the watch pauses itself. */
  maxConsecutiveFailures?: number;
};

export type WatchEvidence = {
  /** Opt-in evidence-driven continuation; source-collection watches only. */
  autonomy?: boolean;
  requiredSubjects?: string[];
  /** Question the research turn answers when the fingerprint changes. */
  question: string;
  /** Collections that must be cited in the answer; merged with the scope's research policy. */
  requiredCollections?: string[];
  citationsRequired?: boolean;
};

export type WatchNotifyPolicy = "material-change" | "always" | "silent";

export type WatchNotify = {
  policy: WatchNotifyPolicy;
  transport?: "discord";
  channelId?: string;
  threadId?: string;
};

export type WatchRecord = {
  id: string;
  ownerId: string;
  scope: string;
  name: string;
  kind: WatchKind;
  version: number;
  status: WatchStatus;
  trigger: WatchTrigger;
  budget: WatchBudget;
  evidence: WatchEvidence;
  notify: WatchNotify;
  /** Where the definition came from (e.g. `file:HEARTBEAT.md#cava`). */
  sourceRef?: string;
  lastFingerprint?: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type WatchEventKind =
  | "proposed"
  | "approved"
  | "paused"
  | "retired"
  | "updated"
  | "unchanged"
  | "changed"
  | "researched"
  | "notified"
  | "failed"
  | "skipped";

export type WatchEvent = {
  id: string;
  watchId: string;
  kind: WatchEventKind;
  detail?: Record<string, unknown>;
  createdAt: string;
};

export type WatchDefinition = {
  name: string;
  kind: WatchKind;
  trigger: WatchTrigger;
  budget?: WatchBudget;
  evidence: WatchEvidence;
  notify?: Partial<WatchNotify>;
};
