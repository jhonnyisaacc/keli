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
  FixtureDiscordBackend,
  type DiscordBackend,
  type DiscordInboundMessage,
} from "./discord-backend.ts";
import { listTransportRoutes } from "./routes.ts";

export type DiscordSendInput = {
  channelId: string;
  message: string;
  scope: string;
  threadId?: string;
};

export type DiscordSendResult = {
  messageId: string;
  outboxId: string;
  delivered: boolean;
};

function backendFrom(backendOrUrl?: DiscordBackend | string): DiscordBackend {
  if (backendOrUrl && typeof backendOrUrl !== "string") return backendOrUrl;
  const url = backendOrUrl ?? fixtureUrlFor("discord");
  if (!url) {
    throw new KeliError(
      "Discord transport requires KELI_DISCORD_FIXTURE_URL or a configured Discord backend (keli auth add discord)",
      "capability_unavailable",
    );
  }
  return new FixtureDiscordBackend(url);
}

/** Exact conversation identity: a thread is its own route; a channel message stays on the channel. */
export function discordRouteExternalId(channelId: string, threadId?: string): string {
  return threadId ? `thread:${threadId}` : channelId;
}

export async function sendDiscordMessage(
  db: Database,
  input: DiscordSendInput,
  backendOrUrl?: DiscordBackend | string,
): Promise<DiscordSendResult> {
  const backend = backendFrom(backendOrUrl);
  const outboxId = crypto.randomUUID();
  const message = enqueueOutbox(db, {
    id: outboxId,
    scope: input.scope,
    destination: `discord:${input.channelId}`,
    payload: {
      message: input.message,
      threadId: input.threadId ?? null,
    },
  });

  return deliverDiscordOutbox(db, message, backend);
}

export async function deliverDiscordOutbox(
  db: Database,
  message: OutboxMessage,
  backendOrUrl: DiscordBackend | string,
): Promise<DiscordSendResult> {
  const backend = backendFrom(backendOrUrl);
  const channelId = message.destination.replace(/^discord:/, "");
  const content = String(message.payload.message ?? "");
  const threadId = (message.payload.threadId as string | null | undefined) ?? undefined;

  try {
    const receipt = await backend.send({ channelId, threadId, content, outboxId: message.id });
    markOutboxDelivered(db, message.id, receipt.messageId);
    return { messageId: receipt.messageId, outboxId: message.id, delivered: true };
  } catch (e) {
    const reason = e instanceof KeliError ? e.message : String(e);
    markOutboxFailed(db, message.id, reason);
    if (e instanceof KeliError) throw e;
    throw new KeliError(reason, "engine_error");
  }
}

export function recordDiscordUpdate(
  db: Database,
  input: {
    updateId: string;
    channelId: string;
    scope?: string;
    threadId?: string;
    payload?: Record<string, unknown>;
  },
): { duplicate: boolean; inboxId?: string } {
  const record = recordInboxMessage(db, {
    transport: "discord",
    dedupeKey: input.updateId,
    payload: {
      channelId: input.channelId,
      threadId: input.threadId ?? null,
      ...(input.payload ?? {}),
    },
    scope: input.scope,
  });
  if (!record) return { duplicate: true };
  return { duplicate: false, inboxId: record.id };
}

/** @deprecated Use recordDiscordUpdate + processTransportInbox */
export function ingestDiscordUpdate(
  db: Database,
  input: {
    updateId: string;
    scope: string;
    payload: Record<string, unknown>;
  },
): { duplicate: boolean; inboxId?: string } {
  const channelId = String(input.payload.channelId ?? "unknown");
  return recordDiscordUpdate(db, {
    updateId: input.updateId,
    channelId,
    scope: input.scope,
    payload: input.payload,
  });
}

export type DiscordPollResult = {
  routesPolled: number;
  fetched: number;
  recorded: number;
  duplicates: number;
  ignored: number;
  errors: string[];
};

function cursorKey(externalId: string): string {
  return `discord:cursor:${externalId}`;
}

export function readDiscordCursor(db: Database, externalId: string): string | undefined {
  const row = db
    .query("SELECT metadata_json FROM transport_routes WHERE transport = 'discord' AND external_id = ?")
    .get(externalId) as { metadata_json: string | null } | null;
  if (!row?.metadata_json) return undefined;
  const meta = JSON.parse(row.metadata_json) as Record<string, unknown>;
  return typeof meta[cursorKey(externalId)] === "string" ? (meta[cursorKey(externalId)] as string) : undefined;
}

export function writeDiscordCursor(db: Database, externalId: string, messageId: string): void {
  const row = db
    .query("SELECT metadata_json FROM transport_routes WHERE transport = 'discord' AND external_id = ?")
    .get(externalId) as { metadata_json: string | null } | null;
  const meta = row?.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : {};
  meta[cursorKey(externalId)] = messageId;
  db.run("UPDATE transport_routes SET metadata_json = ? WHERE transport = 'discord' AND external_id = ?", [
    JSON.stringify(meta),
    externalId,
  ]);
}

/**
 * REST/fixture receiver: polls every bound Discord route (channels and `thread:` ids), records
 * inbound human messages through inbox deduplication, and advances a per-route cursor only after
 * the message is durably recorded. Bot-authored messages (including Keli's own) are ignored.
 */
export async function pollDiscordRoutes(
  db: Database,
  backend: DiscordBackend,
  options: { limit?: number; selfId?: string } = {},
): Promise<DiscordPollResult> {
  const routes = listTransportRoutes(db, "discord");
  const result: DiscordPollResult = { routesPolled: 0, fetched: 0, recorded: 0, duplicates: 0, ignored: 0, errors: [] };
  const selfId = options.selfId ?? (await backend.me().then((m) => m.id).catch(() => undefined));

  for (const route of routes) {
    const isThread = route.externalId.startsWith("thread:");
    const channelId = isThread ? route.externalId.slice("thread:".length) : route.externalId;
    result.routesPolled += 1;
    let messages: DiscordInboundMessage[];
    try {
      messages = await backend.fetchMessages({ channelId, after: readDiscordCursor(db, route.externalId), limit: options.limit });
    } catch (e) {
      result.errors.push(`${route.externalId}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    for (const message of messages) {
      result.fetched += 1;
      if (message.authorIsBot || (selfId && message.authorId === selfId) || !message.content.trim()) {
        result.ignored += 1;
        writeDiscordCursor(db, route.externalId, message.id);
        continue;
      }
      const recorded = recordDiscordUpdate(db, {
        updateId: message.id,
        channelId: isThread ? (message.parentChannelId ?? channelId) : channelId,
        threadId: isThread ? channelId : undefined,
        scope: route.scope,
        payload: {
          text: message.content,
          authorId: message.authorId,
          timestamp: message.timestamp,
          routeExternalId: route.externalId,
        },
      });
      if (recorded.duplicate) result.duplicates += 1;
      else result.recorded += 1;
      writeDiscordCursor(db, route.externalId, message.id);
    }
  }
  return result;
}
