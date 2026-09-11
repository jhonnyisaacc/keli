import type { Database } from "bun:sqlite";
import { listPendingOutbox } from "./outbox.ts";
import { deliverDiscordOutbox } from "./discord.ts";
import { deliverTelegramOutbox } from "./telegram.ts";

export type OutboxReconcileResult = {
  scanned: number;
  retried: number;
  delivered: number;
  skipped: number;
  failed: number;
};

export async function reconcileOutbox(db: Database): Promise<OutboxReconcileResult> {
  const pending = listPendingOutbox(db);
  const discordUrl = process.env.KELI_DISCORD_FIXTURE_URL;
  const telegramUrl = process.env.KELI_TELEGRAM_FIXTURE_URL;
  let retried = 0;
  let delivered = 0;
  let skipped = 0;
  let failed = 0;

  for (const message of pending) {
    if (message.destination.startsWith("discord:")) {
      if (!discordUrl) {
        skipped += 1;
        continue;
      }
      retried += 1;
      try {
        await deliverDiscordOutbox(db, message, discordUrl);
        delivered += 1;
      } catch {
        failed += 1;
      }
      continue;
    }

    if (message.destination.startsWith("telegram:")) {
      if (!telegramUrl) {
        skipped += 1;
        continue;
      }
      retried += 1;
      try {
        await deliverTelegramOutbox(db, message, telegramUrl);
        delivered += 1;
      } catch {
        failed += 1;
      }
      continue;
    }

    skipped += 1;
  }

  return { scanned: pending.length, retried, delivered, skipped, failed };
}

export function pendingOutboxCount(db: Database): number {
  const row = db
    .query("SELECT COUNT(*) AS n FROM outbox_messages WHERE status = 'pending'")
    .get() as { n: number };
  return row.n;
}
