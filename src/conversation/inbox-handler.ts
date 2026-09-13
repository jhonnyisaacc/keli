import type { Database } from "bun:sqlite";
import type { ConversationRecord } from "../memory/conversations.ts";
import { getProjectById } from "../state/repos.ts";
import type { DiscordBackend } from "../transports/discord-backend.ts";
import { pollDiscordRoutes, sendDiscordMessage, type DiscordPollResult } from "../transports/discord.ts";
import type { InboxRecord } from "../transports/inbox.ts";
import { processTransportInbox, type InboxHandler, type InboxProcessResult, type InboxReplier } from "../transports/inbox-processor.ts";
import type { TransportRoute } from "../transports/routes.ts";
import type { ConversationLoop } from "./loop.ts";
import type { TurnContext, TurnOrigin } from "./types.ts";

const DISCORD_MAX_CHARS = 1900;

function projectFromScope(db: Database, scope: string): { id: string; name: string } {
  const id = scope.replace(/^project:/, "");
  const project = getProjectById(db, id);
  return { id, name: project?.name ?? id };
}

function originFor(message: InboxRecord, route: TransportRoute): TurnOrigin {
  const payload = message.payload;
  const transport = message.transport === "discord" || message.transport === "telegram" ? message.transport : "test";
  const channelId = payload.channelId ?? payload.channel_id ?? payload.chatId ?? payload.chat_id;
  const threadId = payload.threadId ?? payload.thread_id ?? payload.topicId ?? payload.topic_id;
  return {
    transport,
    externalId: route.externalId,
    channelId: channelId == null ? undefined : String(channelId),
    threadId: threadId == null ? undefined : String(threadId),
    messageId: message.dedupeKey,
  };
}

/** Builds the turn context for an inbound transport message bound to its exact route. */
export function turnContextFor(
  db: Database,
  ownerId: string,
  message: InboxRecord,
  route: TransportRoute,
  conversation: ConversationRecord,
): TurnContext {
  const project = projectFromScope(db, route.scope);
  return {
    ownerId,
    projectId: project.id,
    projectName: project.name,
    scope: route.scope,
    conversationId: conversation.id,
    origin: originFor(message, route),
  };
}

/**
 * Inbox handler that runs one conversation turn per inbound human message. The turn's source
 * reference is the transport message id, so re-processing the same inbound message after a
 * restart returns the stored reply instead of running the model again.
 */
export function conversationInboxHandler(db: Database, ownerId: string, loop: ConversationLoop): InboxHandler {
  return async (message, route, conversation) => {
    const text = String(message.payload.text ?? message.payload.content ?? message.payload.message ?? "");
    const ctx = turnContextFor(db, ownerId, message, route, conversation);
    const outcome = await loop.runTurn(ctx, text, { sourceRef: `${message.transport}:${message.dedupeKey}` });
    return { reply: formatReply(outcome.kind, outcome.text) };
  };
}

export function formatReply(kind: string, text: string): string {
  const prefix =
    kind === "missing_evidence" ? "Missing evidence. " : kind === "clarify" ? "" : kind === "error" ? "Something failed. " : kind === "blocked" ? "Not applied. " : "";
  const body = `${prefix}${text}`;
  return body.length > DISCORD_MAX_CHARS ? `${body.slice(0, DISCORD_MAX_CHARS - 1)}…` : body;
}

/** Replies on the exact channel/thread the message came from; delivery receipts stay in the outbox. */
export function discordReplier(db: Database, backend: DiscordBackend): InboxReplier {
  return async (message, route, text) => {
    const payload = message.payload;
    const threadId = payload.threadId ?? payload.thread_id;
    const channelId = payload.channelId ?? payload.channel_id;
    await sendDiscordMessage(
      db,
      {
        channelId: String(channelId ?? route.externalId.replace(/^thread:/, "")),
        threadId: threadId == null ? undefined : String(threadId),
        message: text,
        scope: route.scope,
      },
      backend,
    );
  };
}

export type DiscordCycleResult = { poll: DiscordPollResult; inbox: InboxProcessResult };

/** One receive → converse → reply cycle for every bound Discord route. Safe to run repeatedly. */
export async function runDiscordCycle(
  db: Database,
  input: { ownerId: string; backend: DiscordBackend; loop: ConversationLoop; limit?: number },
): Promise<DiscordCycleResult> {
  const poll = await pollDiscordRoutes(db, input.backend, { limit: input.limit });
  const inbox = await processTransportInbox(db, {
    limit: input.limit,
    handler: conversationInboxHandler(db, input.ownerId, input.loop),
    reply: discordReplier(db, input.backend),
  });
  return { poll, inbox };
}
