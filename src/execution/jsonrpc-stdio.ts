import { spawn, type Subprocess } from "bun";
import { KeliError } from "../core/errors.ts";

export type JsonRpcMessage = {
  jsonrpc?: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

/**
 * Newline-delimited JSON-RPC 2.0 over a owned child stdio pair.
 * Used for MCP stdio and Codex app-server. The child cannot write Keli state.
 */
export class JsonRpcStdioClient {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (msg: JsonRpcMessage) => void; reject: (e: Error) => void }>();
  private readonly notifications: JsonRpcMessage[] = [];
  private buffer = "";
  private closed = false;
  private waiters: Array<(msg: JsonRpcMessage) => boolean> = [];

  constructor(private readonly proc: Subprocess<"pipe", "pipe", "pipe">) {
    this.readLoop();
  }

  static spawn(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string>; abort?: AbortSignal }): JsonRpcStdioClient {
    const proc = spawn([command, ...args], {
      cwd: options?.cwd,
      env: options?.env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const client = new JsonRpcStdioClient(proc);
    options?.abort?.addEventListener("abort", () => void client.close(), { once: true });
    return client;
  }

  private async readLoop(): Promise<void> {
    const reader = this.proc.stdout.getReader();
    const decoder = new TextDecoder();
    try {
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        this.buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = this.buffer.indexOf("\n")) >= 0) {
          const line = this.buffer.slice(0, idx).trim();
          this.buffer = this.buffer.slice(idx + 1);
          if (!line) continue;
          let msg: JsonRpcMessage;
          try {
            msg = JSON.parse(line) as JsonRpcMessage;
          } catch {
            continue;
          }
          const id = typeof msg.id === "number" ? msg.id : undefined;
          if (id != null && this.pending.has(id)) {
            this.pending.get(id)!.resolve(msg);
            this.pending.delete(id);
          } else if (msg.method) {
            this.notifications.push(msg);
            this.waiters = this.waiters.filter((fn) => !fn(msg));
          }
        }
      }
    } finally {
      this.failAll(new KeliError("JSON-RPC stdio closed", "engine_error"));
    }
  }

  async request(method: string, params?: unknown, timeoutMs = 20_000): Promise<JsonRpcMessage> {
    if (this.closed) throw new KeliError("JSON-RPC client closed", "engine_error");
    const id = this.nextId++;
    const payload: JsonRpcMessage = { jsonrpc: "2.0", id, method, params };
    const stdin = this.proc.stdin;
    if (stdin === undefined || typeof stdin === "number") {
      throw new KeliError("JSON-RPC stdin unavailable", "engine_error");
    }
    stdin.write(`${JSON.stringify(payload)}\n`);
    return await new Promise<JsonRpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new KeliError(`JSON-RPC timeout: ${method}`, "engine_error", true));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
    });
  }

  async waitNotification(method: string, timeoutMs = 60_000): Promise<JsonRpcMessage> {
    const existing = this.notifications.find((n) => n.method === method);
    if (existing) return existing;
    return await new Promise<JsonRpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => reject(new KeliError(`JSON-RPC notify timeout: ${method}`, "engine_error", true)), timeoutMs);
      this.waiters.push((msg) => {
        if (msg.method !== method) return false;
        clearTimeout(timer);
        resolve(msg);
        return true;
      });
    });
  }

  notify(method: string, params?: unknown): void {
    const stdin = this.proc.stdin;
    if (stdin === undefined || typeof stdin === "number") return;
    stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  private failAll(error: Error): void {
    for (const [, p] of this.pending) p.reject(error);
    this.pending.clear();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.failAll(new KeliError("JSON-RPC client closed", "cancelled"));
    try {
      this.proc.kill();
    } catch {
      /* already exited */
    }
    await this.proc.exited.catch(() => undefined);
  }
}
