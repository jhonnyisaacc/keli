import { KeliError } from "../core/errors.ts";
import { fixtureUrlFor } from "../integrations/env.ts";

export type DiscordInboundMessage = {
  id: string;
  /** Channel the message was posted in (a thread id when posted inside a thread). */
  channelId: string;
  /** Parent channel when `channelId` is a thread; undefined for top-level channels. */
  parentChannelId?: string;
  authorId: string;
  authorIsBot: boolean;
  content: string;
  timestamp: string;
};

export type DiscordSendRequest = {
  channelId: string;
  threadId?: string;
  content: string;
  outboxId: string;
};

/**
 * Transport seam. Both implementations return only receipts and inbound records; outbox and
 * inbox truth stays in SQLite via the caller.
 */
export interface DiscordBackend {
  readonly name: "fixture" | "rest";
  send(input: DiscordSendRequest): Promise<{ messageId: string }>;
  fetchMessages(input: { channelId: string; after?: string; limit?: number }): Promise<DiscordInboundMessage[]>;
  me(): Promise<{ id: string; username?: string }>;
}

export class FixtureDiscordBackend implements DiscordBackend {
  readonly name = "fixture" as const;
  constructor(private readonly baseUrl: string) {}

  async send(input: DiscordSendRequest): Promise<{ messageId: string }> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/discord/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new KeliError(`Discord fixture HTTP ${response.status}`, "engine_error");
    const payload = (await response.json()) as { messageId: string };
    return { messageId: payload.messageId };
  }

  async fetchMessages(input: { channelId: string; after?: string; limit?: number }): Promise<DiscordInboundMessage[]> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/discord/messages`);
    url.searchParams.set("channelId", input.channelId);
    if (input.after) url.searchParams.set("after", input.after);
    if (input.limit) url.searchParams.set("limit", String(input.limit));
    const response = await fetch(url);
    if (!response.ok) throw new KeliError(`Discord fixture HTTP ${response.status}`, "engine_error");
    const payload = (await response.json()) as { messages: DiscordInboundMessage[] };
    return payload.messages ?? [];
  }

  async me(): Promise<{ id: string; username?: string }> {
    return { id: "fixture-bot", username: "keli-fixture" };
  }
}

type RestMessage = {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
  author: { id: string; bot?: boolean };
};

/** Discord REST v10 over `fetch`; no gateway, no discord.js. Polling receiver for bound routes. */
export class RestDiscordBackend implements DiscordBackend {
  readonly name = "rest" as const;
  private readonly channelParents = new Map<string, string | undefined>();

  constructor(
    private readonly token: string,
    private readonly baseUrl = "https://discord.com/api/v10",
    private readonly timeoutMs = 10_000,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${this.token}`,
        "content-type": "application/json",
        "user-agent": "DiscordBot (https://github.com/keli, 0.1)",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.status === 401 || response.status === 403) {
      throw new KeliError(`Discord authentication failed (HTTP ${response.status})`, "needs_reauth");
    }
    if (response.status === 429) {
      throw new KeliError("Discord rate limited", "engine_error", true);
    }
    if (!response.ok) {
      throw new KeliError(`Discord HTTP ${response.status}`, "engine_error", response.status >= 500);
    }
    return (await response.json()) as T;
  }

  async send(input: DiscordSendRequest): Promise<{ messageId: string }> {
    const target = input.threadId ?? input.channelId;
    const message = await this.request<{ id: string }>(`/channels/${target}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: input.content.slice(0, 2000), nonce: input.outboxId.replace(/-/g, "").slice(0, 25) }),
    });
    return { messageId: message.id };
  }

  async fetchMessages(input: { channelId: string; after?: string; limit?: number }): Promise<DiscordInboundMessage[]> {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(input.limit ?? 50, 100)));
    if (input.after) params.set("after", input.after);
    const rows = await this.request<RestMessage[]>(`/channels/${input.channelId}/messages?${params}`);
    if (!this.channelParents.has(input.channelId)) {
      try {
        const channel = await this.request<{ parent_id?: string | null; type: number }>(`/channels/${input.channelId}`);
        this.channelParents.set(input.channelId, channel.parent_id ?? undefined);
      } catch {
        this.channelParents.set(input.channelId, undefined);
      }
    }
    const parent = this.channelParents.get(input.channelId);
    return rows
      .map((m) => ({
        id: m.id,
        channelId: m.channel_id,
        parentChannelId: parent,
        authorId: m.author.id,
        authorIsBot: Boolean(m.author.bot),
        content: m.content,
        timestamp: m.timestamp,
      }))
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  }

  async me(): Promise<{ id: string; username?: string }> {
    return this.request<{ id: string; username?: string }>("/users/@me");
  }
}

export function fixtureDiscordBackendFromEnv(fixtureUrl?: string): FixtureDiscordBackend | null {
  const url = fixtureUrl ?? fixtureUrlFor("discord");
  return url ? new FixtureDiscordBackend(url) : null;
}
