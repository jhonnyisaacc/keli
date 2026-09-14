import { ResearchResponsibilityService } from "../core/behavior.ts";
import { getWatch } from "../watches/store.ts";
import type { Database } from "bun:sqlite";
import type { ConversationRecord } from "../memory/conversations.ts";
import { getProjectById } from "../state/repos.ts";
import type { DiscordBackend } from "../transports/discord-backend.ts";
import { pollDiscordRoutes, sendDiscordMessage, type DiscordPollResult } from "../transports/discord.ts";
import { pollTelegramRoutes, sendTelegramMessage, type TelegramPollResult } from "../transports/telegram.ts";
import type { TelegramBackend } from "../transports/telegram-backend.ts";
import type { InboxRecord } from "../transports/inbox.ts";
import { processTransportInbox, type InboxHandler, type InboxProcessResult, type InboxReplier } from "../transports/inbox-processor.ts";
import type { TransportRoute } from "../transports/routes.ts";
import { consumePairing, pairingAccepts, type PairingChallenge } from "../transports/pairing.ts";
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
    mode: "ordinary",
  };
}

/**
 * Inbox handler that runs one conversation turn per inbound human message. The turn's source
 * reference is the transport message id, so re-processing the same inbound message after a
 * restart returns the stored reply instead of running the model again.
 */
export function conversationInboxHandler(
  db: Database,
  ownerId: string,
  loop: ConversationLoop,
  ownerUserId?: string,
  pairing?: { challenge?: PairingChallenge; onVerified?: (next: PairingChallenge) => void | Promise<void> },
): InboxHandler {
  return async (message, route, conversation) => {
    const text = String(message.payload.text ?? message.payload.content ?? message.payload.message ?? "");
    const actorId = String(message.payload.authorId ?? message.payload.author_id ?? "");
    if (
      pairing?.challenge &&
      pairingAccepts(pairing.challenge, text, { transport: message.transport, externalId: route.externalId })
    ) {
      const next = consumePairing(pairing.challenge, actorId || ownerId);
      await pairing.onVerified?.(next);
      return { reply: "Pairing confirmed. This identity can approve personal actions on this route." };
    }
    const supplied = /^\/watch-input\s+(watch-[a-f0-9]+)\s+([\s\S]+)$/.exec(text);
    if (supplied) {
      const watch = getWatch(db, supplied[1]!);
      const sameRoute = watch && (watch.notify.threadId ? `thread:${watch.notify.threadId}` : watch.notify.channelId) === route.externalId;
      if (!ownerUserId || message.payload.authorId !== ownerUserId || !sameRoute) return { reply: "Watch input requires the configured owner on the watch's exact route." };
      const suppliedOk = new ResearchResponsibilityService(db, ownerId).supplyInput(supplied[1]!, route.scope, supplied[2]!, `${message.transport}:${message.dedupeKey}`);
      return { reply: suppliedOk ? "Input recorded; the next watch tick resumes within its remaining budget." : "No matching waiting occurrence." };
    }
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
  input: {
    ownerId: string;
    backend: DiscordBackend;
    loop: ConversationLoop;
    ownerUserId?: string;
    limit?: number;
    pairing?: { challenge?: PairingChallenge; onVerified?: (next: PairingChallenge) => void | Promise<void> };
  },
): Promise<DiscordCycleResult> {
  const poll = await pollDiscordRoutes(db, input.backend, { limit: input.limit });
  const inbox = await processTransportInbox(db, {
    limit: input.limit,
    handler: conversationInboxHandler(db, input.ownerId, input.loop, input.ownerUserId, input.pairing),
    reply: discordReplier(db, input.backend),
  });
  return { poll, inbox };
}

export function telegramReplier(db: Database, backend: TelegramBackend): InboxReplier {
  return async (message, route, text) => {
    const payload = message.payload;
    const topicId = payload.topicId ?? payload.topic_id;
    const chatId = payload.chatId ?? payload.chat_id;
    await sendTelegramMessage(
      db,
      {
        chatId: String(chatId ?? route.externalId.split(":")[0]),
        topicId: topicId == null ? undefined : String(topicId),
        message: text,
        scope: route.scope,
      },
      backend,
    );
  };
}

export type TelegramCycleResult = { poll: TelegramPollResult; inbox: InboxProcessResult };

export async function runTelegramCycle(
  db: Database,
  input: {
    ownerId: string;
    backend: TelegramBackend;
    loop: ConversationLoop;
    ownerUserId?: string;
    limit?: number;
    pairing?: { challenge?: PairingChallenge; onVerified?: (next: PairingChallenge) => void | Promise<void> };
  },
): Promise<TelegramCycleResult> {
  const poll = await pollTelegramRoutes(db, input.backend, { limit: input.limit });
  const inbox = await processTransportInbox(db, {
    limit: input.limit,
    handler: conversationInboxHandler(db, input.ownerId, input.loop, input.ownerUserId, input.pairing),
    reply: telegramReplier(db, input.backend),
  });
  return { poll, inbox };
}
