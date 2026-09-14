import { KeliError } from "../core/errors.ts";
import { fixtureUrlFor } from "../integrations/env.ts";

export type TelegramInboundMessage = {
  updateId: string;
  chatId: string;
  topicId?: string;
  authorId: string;
  authorIsBot: boolean;
  content: string;
  timestamp: string;
};

export type TelegramSendRequest = {
  chatId: string;
  topicId?: string;
  content: string;
  outboxId: string;
};

/**
 * Transport seam. Receipts and inbound records only; inbox/outbox truth stays in SQLite.
 * Fixture preserves the existing Keli HTTP shape. REST ADOPTs Telegram Bot API
 * getMe / sendMessage / getUpdates (https://core.telegram.org/bots/api).
 */
export interface TelegramBackend {
  readonly name: "fixture" | "rest";
  send(input: TelegramSendRequest): Promise<{ messageId: string }>;
  fetchUpdates(input: { offset?: number; limit?: number; timeout?: number }): Promise<TelegramInboundMessage[]>;
  me(): Promise<{ id: string; username?: string }>;
}

export class FixtureTelegramBackend implements TelegramBackend {
  readonly name = "fixture" as const;
  constructor(private readonly baseUrl: string) {}

  async send(input: TelegramSendRequest): Promise<{ messageId: string }> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/telegram/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: input.chatId,
        topicId: input.topicId,
        content: input.content,
        outboxId: input.outboxId,
      }),
    });
    if (!response.ok) throw new KeliError(`Telegram fixture HTTP ${response.status}`, "engine_error");
    const payload = (await response.json()) as { messageId: string };
    return { messageId: payload.messageId };
  }

  async fetchUpdates(input: { offset?: number; limit?: number }): Promise<TelegramInboundMessage[]> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/telegram/updates`);
    if (input.offset != null) url.searchParams.set("offset", String(input.offset));
    if (input.limit) url.searchParams.set("limit", String(input.limit));
    const response = await fetch(url);
    if (!response.ok) throw new KeliError(`Telegram fixture HTTP ${response.status}`, "engine_error");
    const payload = (await response.json()) as { updates: TelegramInboundMessage[] };
    return payload.updates ?? [];
  }

  async me(): Promise<{ id: string; username?: string }> {
    return { id: "fixture-bot", username: "keli-fixture" };
  }
}

type BotApiOk<T> = { ok: true; result: T };
type BotApiErr = { ok: false; description?: string; error_code?: number };
type BotApiMessage = {
  message_id: number;
  date: number;
  text?: string;
  message_thread_id?: number;
  chat: { id: number };
  from?: { id: number; is_bot?: boolean };
};
type BotApiUpdate = { update_id: number; message?: BotApiMessage; edited_message?: BotApiMessage };
type BotApiUser = { id: number; username?: string; is_bot?: boolean };

export const TELEGRAM_API_BASE = "https://api.telegram.org";

/** Telegram Bot API over `fetch`; long-poll getUpdates. No grammY, no python-telegram-bot. */
export class RestTelegramBackend implements TelegramBackend {
  readonly name = "rest" as const;

  constructor(
    private readonly token: string,
    private readonly baseUrl = TELEGRAM_API_BASE,
    private readonly timeoutMs = 35_000,
  ) {}

  private methodUrl(method: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}/bot${this.token}/${method}`;
  }

  private async request<T>(method: string, init: RequestInit = {}, timeoutMs = this.timeoutMs): Promise<T> {
    const response = await fetch(this.methodUrl(method), {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 401 || response.status === 403) {
      throw new KeliError(`Telegram authentication failed (HTTP ${response.status})`, "needs_reauth");
    }
    if (response.status === 429) {
      throw new KeliError("Telegram rate limited", "engine_error", true);
    }
    let body: BotApiOk<T> | BotApiErr;
    try {
      body = (await response.json()) as BotApiOk<T> | BotApiErr;
    } catch {
      throw new KeliError(`Telegram HTTP ${response.status}`, "engine_error", response.status >= 500);
    }
    if (!body.ok) {
      const code = "error_code" in body ? body.error_code : response.status;
      if (code === 401 || code === 403) {
        throw new KeliError(`Telegram authentication failed (${body.description ?? code})`, "needs_reauth");
      }
      throw new KeliError(body.description ?? `Telegram error ${code}`, "engine_error", (code ?? 0) >= 500);
    }
    return body.result;
  }

  async send(input: TelegramSendRequest): Promise<{ messageId: string }> {
    const payload: Record<string, unknown> = {
      chat_id: input.chatId,
      text: input.content.slice(0, 4096),
    };
    if (input.topicId) payload.message_thread_id = Number(input.topicId);
    const message = await this.request<BotApiMessage>("sendMessage", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { messageId: String(message.message_id) };
  }

  async fetchUpdates(input: { offset?: number; limit?: number; timeout?: number }): Promise<TelegramInboundMessage[]> {
    const timeout = input.timeout ?? 0;
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(input.limit ?? 50, 100)));
    if (input.offset != null) params.set("offset", String(input.offset));
    if (timeout > 0) params.set("timeout", String(timeout));
    const rows = await this.request<BotApiUpdate[]>(
      `getUpdates?${params}`,
      { method: "GET" },
      timeout > 0 ? (timeout + 10) * 1000 : this.timeoutMs,
    );
    return rows.flatMap((row) => inboundFromUpdate(row)).filter((m): m is TelegramInboundMessage => m != null);
  }

  async me(): Promise<{ id: string; username?: string }> {
    const user = await this.request<BotApiUser>("getMe", { method: "GET" });
    return { id: String(user.id), username: user.username };
  }
}

function inboundFromUpdate(row: BotApiUpdate): TelegramInboundMessage | null {
  const message = row.message ?? row.edited_message;
  if (!message?.text?.trim()) return null;
  return {
    updateId: String(row.update_id),
    chatId: String(message.chat.id),
    topicId: message.message_thread_id != null ? String(message.message_thread_id) : undefined,
    authorId: message.from ? String(message.from.id) : "unknown",
    authorIsBot: Boolean(message.from?.is_bot),
    content: message.text,
    timestamp: new Date((message.date ?? 0) * 1000).toISOString(),
  };
}

export function telegramBackendFromUrl(url: string): FixtureTelegramBackend {
  return new FixtureTelegramBackend(url);
}

export function defaultTelegramFixture(): TelegramBackend | undefined {
  const url = fixtureUrlFor("telegram");
  return url ? new FixtureTelegramBackend(url) : undefined;
}
