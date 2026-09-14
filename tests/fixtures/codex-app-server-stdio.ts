#!/usr/bin/env bun
/** Fixture Codex app-server: JSON-RPC over stdio. Not a live Codex binary. */
export {};

async function serveCodex() {
  const decoder = new TextDecoder();
  let buffer = "";
  const write = (obj: unknown) => {
    process.stdout.write(`${JSON.stringify(obj)}\n`);
  };
  for await (const chunk of Bun.stdin.stream()) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { method?: string; id?: number; params?: { threadId?: string } };
      if (msg.method === "initialize") {
        write({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "1" } });
      } else if (msg.method === "thread/start") {
        write({ jsonrpc: "2.0", id: msg.id, result: { thread: { id: "thr_fixture" } } });
      } else if (msg.method === "turn/start") {
        write({ jsonrpc: "2.0", id: msg.id, result: { turn: { id: "turn_fixture", status: "completed" } } });
      } else if (msg.id != null) {
        write({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unknown" } });
      }
    }
  }
}

await serveCodex();
