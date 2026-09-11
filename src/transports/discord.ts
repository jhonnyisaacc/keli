import type { Database } from "bun:sqlite";
import { KeliError } from "../core/errors.ts";
import {
  enqueueOutbox,
  markOutboxDelivered,
  markOutboxFailed,
  type OutboxMessage,
} from "./outbox.ts";
import { recordInboxMessage } from "./inbox.ts";

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

export async function sendDiscordMessage(
  db: Database,
  input: DiscordSendInput,
  fixtureUrl?: string,
): Promise<DiscordSendResult> {
  const url = fixtureUrl ?? process.env.KELI_DISCORD_FIXTURE_URL;
  if (!url) {
    throw new KeliError(
      "Discord transport requires KELI_DISCORD_FIXTURE_URL or configured discord.js backend",
      "capability_unavailable",
    );
  }

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

  return deliverDiscordOutbox(db, message, url);
}

export async function deliverDiscordOutbox(
  db: Database,
  message: OutboxMessage,
  fixtureUrl: string,
): Promise<DiscordSendResult> {
  const channelId = message.destination.replace(/^discord:/, "");
  const content = String(message.payload.message ?? "");
  const threadId = message.payload.threadId as string | undefined;

  try {
    const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/discord/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channelId,
        threadId,
        content,
        outboxId: message.id,
      }),
    });

    if (!response.ok) {
      throw new KeliError(`Discord fixture HTTP ${response.status}`, "engine_error");
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
