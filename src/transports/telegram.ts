import type { Database } from "bun:sqlite";
import { KeliError } from "../core/errors.ts";
import {
  enqueueOutbox,
  markOutboxDelivered,
  markOutboxFailed,
  type OutboxMessage,
} from "./outbox.ts";
import { recordInboxMessage } from "./inbox.ts";
import { fixtureUrlFor } from "../integrations/env.ts";

export type TelegramSendInput = {
  chatId: string;
  message: string;
  scope: string;
  topicId?: string;
};

export type TelegramSendResult = {
  messageId: string;
  outboxId: string;
  delivered: boolean;
};

function telegramDestination(chatId: string, topicId?: string): string {
  return topicId ? `telegram:${chatId}:${topicId}` : `telegram:${chatId}`;
}

export async function sendTelegramMessage(
  db: Database,
  input: TelegramSendInput,
  fixtureUrl?: string,
): Promise<TelegramSendResult> {
  const url = fixtureUrl ?? fixtureUrlFor("telegram");
  if (!url) {
    throw new KeliError(
      "Telegram transport requires KELI_TELEGRAM_FIXTURE_URL or configured grammY backend",
      "capability_unavailable",
    );
  }

  const outboxId = crypto.randomUUID();
  const message = enqueueOutbox(db, {
    id: outboxId,
    scope: input.scope,
    destination: telegramDestination(input.chatId, input.topicId),
    payload: {
      message: input.message,
      topicId: input.topicId ?? null,
    },
  });

  return deliverTelegramOutbox(db, message, url);
}

export async function deliverTelegramOutbox(
  db: Database,
  message: OutboxMessage,
  fixtureUrl: string,
): Promise<TelegramSendResult> {
  const parts = message.destination.replace(/^telegram:/, "").split(":");
  const chatId = parts[0] ?? "";
  const topicId = parts[1] ?? (message.payload.topicId as string | undefined);
  const content = String(message.payload.message ?? "");

  try {
    const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/telegram/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId,
        topicId,
        content,
        outboxId: message.id,
      }),
    });

    if (!response.ok) {
      throw new KeliError(`Telegram fixture HTTP ${response.status}`, "engine_error");
    }

    const payload = (await response.json()) as { messageId: string };
    markOutboxDelivered(db, message.id, payload.messageId);
    return { messageId: payload.messageId, outboxId: message.id, delivered: true };
  } catch (e) {
    const reason = e instanceof KeliError ? e.message : String(e);
    markOutboxFailed(db, message.id, reason);
    if (e instanceof KeliError) throw e;
    throw new KeliError(reason, "engine_error");
  }
}

export function recordTelegramUpdate(
  db: Database,
  input: {
    updateId: string;
    chatId: string;
    scope?: string;
    topicId?: string;
    payload: Record<string, unknown>;
  },
): { duplicate: boolean; inboxId?: string } {
  const record = recordInboxMessage(db, {
    transport: "telegram",
    dedupeKey: input.updateId,
    payload: {
      ...input.payload,
      chatId: input.chatId,
      topicId: input.topicId ?? null,
    },
    scope: input.scope,
  });
  if (!record) return { duplicate: true };
  return { duplicate: false, inboxId: record.id };
}
