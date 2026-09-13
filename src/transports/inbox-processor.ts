import type { Database } from "bun:sqlite";
import { upsertConversation, type ConversationRecord } from "../memory/conversations.ts";
import { listUnprocessedInbox, markInboxProcessed, type InboxRecord } from "./inbox.ts";
import { resolveTransportRoute, type TransportRoute } from "./routes.ts";

export type InboxProcessResult = {
  scanned: number;
  processed: number;
  skipped: number;
  replied: number;
  failed: number;
};

export type InboxHandlerResult = { reply?: string } | void;

/** Runs one conversation turn for an inbound human message; returns optional reply text. */
export type InboxHandler = (
  message: InboxRecord,
  route: TransportRoute,
  conversation: ConversationRecord,
) => Promise<InboxHandlerResult>;

/** Delivers a reply to the conversation's exact origin (channel or thread). */
export type InboxReplier = (message: InboxRecord, route: TransportRoute, text: string) => Promise<void>;

export type InboxProcessOptions = {
  limit?: number;
  handler?: InboxHandler;
  reply?: InboxReplier;
};

type RouteIdentity = { routeLookup: string[]; conversationExternalId: string };

function routeIdentity(transport: string, payload: Record<string, unknown>): RouteIdentity | null {
  if (transport === "discord") {
    const channelId = payload.channelId ?? payload.channel_id;
    const threadId = payload.threadId ?? payload.thread_id;
    if (!channelId && !threadId) return null;
    if (threadId) {
      return {
        routeLookup: [`thread:${String(threadId)}`, ...(channelId ? [String(channelId)] : [])],
        conversationExternalId: `thread:${String(threadId)}`,
      };
    }
    return { routeLookup: [String(channelId)], conversationExternalId: String(channelId) };
  }
  if (transport === "telegram") {
    const chatId = payload.chatId ?? payload.chat_id;
    if (!chatId) return null;
    const topicId = payload.topicId ?? payload.topic_id;
    const id = topicId ? `${String(chatId)}:${String(topicId)}` : String(chatId);
    return { routeLookup: [id, String(chatId)], conversationExternalId: id };
  }
  return null;
}

function messageText(payload: Record<string, unknown>): string | null {
  const text = payload.text ?? payload.content ?? payload.message;
  return typeof text === "string" && text.trim() ? text : null;
}

function annotateInbox(db: Database, id: string, patch: Record<string, unknown>): void {
  const row = db.query("SELECT payload_json FROM transport_inbox WHERE id = ?").get(id) as { payload_json: string } | null;
  if (!row) return;
  const payload = { ...(JSON.parse(row.payload_json) as Record<string, unknown>), ...patch };
  db.run("UPDATE transport_inbox SET payload_json = ? WHERE id = ?", [JSON.stringify(payload), id]);
}

/**
 * Processes unprocessed inbox messages. Without a handler this only binds scope (legacy
 * behavior). With a handler, each human message runs one conversation turn bound to its exact
 * channel/thread identity; replies go out through the outbox. A message is marked processed
 * only after the handler completes; handler failures are recorded on the message so stalls are
 * visible instead of silent.
 */
export async function processTransportInbox(
  db: Database,
  optionsOrLimit: number | InboxProcessOptions = 50,
): Promise<InboxProcessResult> {
  const options: InboxProcessOptions = typeof optionsOrLimit === "number" ? { limit: optionsOrLimit } : optionsOrLimit;
  const pending = listUnprocessedInbox(db, undefined, options.limit ?? 50);
  const result: InboxProcessResult = { scanned: pending.length, processed: 0, skipped: 0, replied: 0, failed: 0 };

  for (const message of pending) {
    const identity = routeIdentity(message.transport, message.payload);
    if (!identity) {
      result.skipped += 1;
      continue;
    }

    let route: TransportRoute | null = null;
    for (const externalId of identity.routeLookup) {
      route = resolveTransportRoute(db, message.transport, externalId);
      if (route) break;
    }
    if (!route && !message.scope) {
      result.skipped += 1;
      continue;
    }
    const scope = route?.scope ?? message.scope!;
    if (!message.scope) db.run("UPDATE transport_inbox SET scope = ? WHERE id = ?", [scope, message.id]);

    if (!options.handler) {
      markInboxProcessed(db, message.id);
      result.processed += 1;
      continue;
    }

    const text = messageText(message.payload);
    if (!text) {
      markInboxProcessed(db, message.id);
      result.processed += 1;
      continue;
    }

    const conversation = upsertConversation(db, {
      scope,
      transport: message.transport,
      externalId: identity.conversationExternalId,
      routeId: route?.id,
    });
    const effectiveRoute: TransportRoute =
      route ?? { id: "", transport: message.transport, externalId: identity.conversationExternalId, scope, createdAt: message.createdAt };

    try {
      const outcome = await options.handler(message, effectiveRoute, conversation);
      if (outcome?.reply && options.reply) {
        try {
          await options.reply(message, effectiveRoute, outcome.reply);
          result.replied += 1;
        } catch (e) {
          annotateInbox(db, message.id, { replyError: e instanceof Error ? e.message : String(e) });
          result.failed += 1;
        }
      }
      markInboxProcessed(db, message.id);
      result.processed += 1;
    } catch (e) {
      annotateInbox(db, message.id, { processError: e instanceof Error ? e.message : String(e), processFailedAt: new Date().toISOString() });
      markInboxProcessed(db, message.id);
      result.failed += 1;
    }
  }

  return result;
}
