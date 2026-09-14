import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

/** Terminal editing without echoing secret characters or adding them to shell history. */
export async function promptSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error("Use an interactive terminal or the provider's credential environment variable");
  process.stdout.write(prompt);
  const silent = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const rl = createInterface({ input: process.stdin, output: silent, terminal: true, historySize: 0 });
  const abort = new AbortController();
  rl.on("SIGINT", () => abort.abort());
  try { return await rl.question("", { signal: abort.signal }); }
  finally { rl.close(); silent.end(); process.stdout.write("\n"); }
}
