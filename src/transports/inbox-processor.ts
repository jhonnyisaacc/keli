import type { Database } from "bun:sqlite";
import { listUnprocessedInbox, markInboxProcessed } from "./inbox.ts";
import { resolveTransportRoute } from "./routes.ts";

export type InboxProcessResult = {
  scanned: number;
  processed: number;
  skipped: number;
};

function routeExternalId(transport: string, payload: Record<string, unknown>): string | null {
  if (transport === "discord") {
    const channelId = payload.channelId ?? payload.channel_id;
    return channelId ? String(channelId) : null;
  }
  if (transport === "telegram") {
    const chatId = payload.chatId ?? payload.chat_id;
    if (!chatId) return null;
    const topicId = payload.topicId ?? payload.topic_id;
    return topicId ? `${String(chatId)}:${String(topicId)}` : String(chatId);
  }
  return null;
}

export function processTransportInbox(db: Database, limit = 50): InboxProcessResult {
  const pending = listUnprocessedInbox(db, undefined, limit);
  let processed = 0;
  let skipped = 0;

  for (const message of pending) {
    const externalId = routeExternalId(message.transport, message.payload);
    if (!externalId) {
      skipped += 1;
      continue;
    }

    const route = resolveTransportRoute(db, message.transport, externalId);
    if (!route && !message.scope) {
      skipped += 1;
      continue;
    }

    if (route && !message.scope) {
      db.run("UPDATE transport_inbox SET scope = ? WHERE id = ?", [route.scope, message.id]);
    }

    markInboxProcessed(db, message.id);
    processed += 1;
  }

  return { scanned: pending.length, processed, skipped };
}
