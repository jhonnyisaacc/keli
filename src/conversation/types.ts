import type { Attribution, Citation, SourceEvidence } from "../core/evidence.ts";

export type TurnOrigin = {
  transport: "cli" | "discord" | "telegram" | "job" | "watch" | "test";
  /** Route external id (Discord: `thread:<id>` or channel id; Telegram: `chat[:topic]`). */
  externalId?: string;
  channelId?: string;
  threadId?: string;
  /** Upstream message id; used to derive idempotent turn ids. */
  messageId?: string;
};

export type TurnContext = {
  ownerId: string;
  projectId: string;
  projectName: string;
  scope: string;
  conversationId: string;
  origin: TurnOrigin;
  runId?: string;
  jobId?: string;
};

export type ModelDecision =
  | { type: "tool_call"; capability: string; input: Record<string, unknown>; reason?: string }
  | { type: "answer"; text: string; citations?: Citation[]; attributions?: Attribution[] }
  | { type: "missing_evidence"; text: string; searched?: string[]; needed?: string[] }
  | { type: "clarify"; question: string };

export type TurnOutcomeKind =
  | "answer"
  | "missing_evidence"
  | "clarify"
  | "correction"
  | "blocked"
  | "error";

export type TurnOutcome = {
  evidence?: Record<string, SourceEvidence>;
  kind: TurnOutcomeKind;
  text: string;
  citations?: Citation[];
  attributions?: Attribution[];
  steps: number;
  toolCalls: number;
  runId?: string;
  conversationId: string;
  turnIds: string[];
  costUnknown: boolean;
  rule?: { scope: string; key: string; value: string; revision: number };
  /** True when the reply was served from a previously completed turn for the same source message. */
  replayed?: boolean;
};
