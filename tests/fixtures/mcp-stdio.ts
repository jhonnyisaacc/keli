#!/usr/bin/env bun
/** Fixture MCP stdio server. Not a live MCP implementation. */
export {};

async function serveMcp() {
  const decoder = new TextDecoder();
  let buffer = "";
  const write = (obj: unknown) => process.stdout.write(`${JSON.stringify(obj)}\n`);
  for await (const chunk of Bun.stdin.stream()) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { method?: string; id?: number; params?: { arguments?: { text?: string } } };
      if (msg.method === "initialize") {
        write({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "0" } } });
      } else if (msg.method === "tools/list") {
        write({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "echo" }] } });
      } else if (msg.method === "tools/call") {
        write({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: String(msg.params?.arguments?.text ?? "ok") }] } });
      } else if (msg.id != null) {
        write({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unknown" } });
      }
    }
  }
}

await serveMcp();
