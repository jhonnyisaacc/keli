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
import {
  FixtureTelegramBackend,
  type TelegramBackend,
  type TelegramInboundMessage,
} from "./telegram-backend.ts";
import { listTransportRoutes } from "./routes.ts";

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

function backendFrom(backendOrUrl?: TelegramBackend | string): TelegramBackend {
  if (backendOrUrl && typeof backendOrUrl !== "string") return backendOrUrl;
  const url = backendOrUrl ?? fixtureUrlFor("telegram");
  if (!url) {
    throw new KeliError(
      "Telegram transport requires KELI_TELEGRAM_FIXTURE_URL or a configured Telegram backend (keli auth add telegram)",
      "capability_unavailable",
    );
  }
  return new FixtureTelegramBackend(url);
}

export async function sendTelegramMessage(
  db: Database,
  input: TelegramSendInput,
  backendOrUrl?: TelegramBackend | string,
): Promise<TelegramSendResult> {
  const backend = backendFrom(backendOrUrl);
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

  return deliverTelegramOutbox(db, message, backend);
}

export async function deliverTelegramOutbox(
  db: Database,
  message: OutboxMessage,
  backendOrUrl?: TelegramBackend | string,
): Promise<TelegramSendResult> {
  const backend = backendFrom(backendOrUrl);
  const parts = message.destination.replace(/^telegram:/, "").split(":");
  const chatId = parts[0] ?? "";
  const topicId = parts[1] ?? (message.payload.topicId as string | undefined);
  const content = String(message.payload.message ?? "");

  try {
    const receipt = await backend.send({
      chatId,
      topicId,
      content,
      outboxId: message.id,
    });
    markOutboxDelivered(db, message.id, receipt.messageId);
    return { messageId: receipt.messageId, outboxId: message.id, delivered: true };
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

export type TelegramPollResult = {
  routesPolled: number;
  fetched: number;
  recorded: number;
  duplicates: number;
  ignored: number;
  errors: string[];
};

function offsetKey(): string {
  return "telegram:offset";
}

export function readTelegramOffset(db: Database): number | undefined {
  const row = db
    .query("SELECT metadata_json FROM transport_routes WHERE transport = 'telegram' LIMIT 1")
    .get() as { metadata_json: string | null } | null;
  if (!row?.metadata_json) return undefined;
  const meta = JSON.parse(row.metadata_json) as Record<string, unknown>;
  return typeof meta[offsetKey()] === "number" ? (meta[offsetKey()] as number) : undefined;
}

export function writeTelegramOffset(db: Database, offset: number): void {
  const rows = db.query("SELECT id, metadata_json FROM transport_routes WHERE transport = 'telegram'").all() as Array<{
    id: string;
    metadata_json: string | null;
  }>;
  for (const row of rows) {
    const meta = row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : {};
    meta[offsetKey()] = offset;
    db.run("UPDATE transport_routes SET metadata_json = ? WHERE id = ?", [JSON.stringify(meta), row.id]);
  }
}

/**
 * Receiver: getUpdates (Bot API) or fixture /telegram/updates. Records human messages
 * through inbox dedupe. Offset advances only after durable record. Bot messages ignored.
 */
export async function pollTelegramRoutes(
  db: Database,
  backend: TelegramBackend,
  options: { limit?: number; selfId?: string; timeout?: number } = {},
): Promise<TelegramPollResult> {
  const routes = listTransportRoutes(db, "telegram");
  const result: TelegramPollResult = {
    routesPolled: routes.length,
    fetched: 0,
    recorded: 0,
    duplicates: 0,
    ignored: 0,
    errors: [],
  };
  if (routes.length === 0) return result;

  const bound = new Set(routes.map((r) => r.externalId));
  const selfId = options.selfId ?? (await backend.me().then((m) => m.id).catch(() => undefined));
  const offset = readTelegramOffset(db);

  let updates: TelegramInboundMessage[];
  try {
    updates = await backend.fetchUpdates({
      offset,
      limit: options.limit,
      timeout: options.timeout,
    });
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
    return result;
  }

  let maxOffset = offset ?? 0;
  for (const message of updates) {
    result.fetched += 1;
    const numeric = Number(message.updateId);
    if (Number.isFinite(numeric) && numeric >= maxOffset) maxOffset = numeric + 1;

    if (message.authorIsBot || (selfId && message.authorId === selfId) || !message.content.trim()) {
      result.ignored += 1;
      continue;
    }

    const routeId = message.topicId ? `${message.chatId}:${message.topicId}` : message.chatId;
    const route = routes.find((r) => r.externalId === routeId || r.externalId === message.chatId);
    if (!route && bound.size > 0) {
      result.ignored += 1;
      continue;
    }

    const recorded = recordTelegramUpdate(db, {
      updateId: message.updateId,
      chatId: message.chatId,
      topicId: message.topicId,
      scope: route?.scope,
      payload: {
        text: message.content,
        authorId: message.authorId,
        timestamp: message.timestamp,
      },
    });
    if (recorded.duplicate) result.duplicates += 1;
    else result.recorded += 1;
  }
  if (updates.length > 0) writeTelegramOffset(db, maxOffset);
  return result;
}
