import { existsSync } from "node:fs";
import { KeliError } from "../core/errors.ts";

export type BoundedProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  truncated: boolean;
  durationMs: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 256_000;

export function resolveBinary(nameOrPath: string): string | undefined {
  if (nameOrPath.includes("/") || nameOrPath.startsWith(".")) {
    return existsSync(nameOrPath) ? nameOrPath : undefined;
  }
  const found = Bun.which(nameOrPath);
  return found ?? undefined;
}

export async function runBoundedProcess(
  argv: string[],
  options: {
    timeoutMs?: number;
    maxOutputBytes?: number;
    signal?: AbortSignal;
    cwd?: string;
  } = {},
): Promise<BoundedProcessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_BYTES;
  if (options.signal?.aborted) {
    throw new KeliError("Process cancelled before start", "cancelled");
  }

  const proc = Bun.spawn(argv, {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const started = performance.now();
  let timedOut = false;
  let cancelled = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  const onAbort = () => {
    cancelled = true;
    proc.kill();
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const [stdout, stderr] = await Promise.all([
      readLimited(proc.stdout, maxOutputBytes),
      readLimited(proc.stderr, Math.min(16_384, maxOutputBytes)),
    ]);
    const exitCode = await proc.exited;
    return {
      stdout: stdout.text,
      stderr: stderr.text,
      exitCode,
      timedOut,
      cancelled,
      truncated: stdout.truncated || stderr.truncated,
      durationMs: Math.round(performance.now() - started),
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    if (proc.exitCode === null && proc.signalCode === null) proc.kill();
  }
}

async function readLimited(
  stream: ReadableStream<Uint8Array> | undefined,
  max: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!stream) return { text: "", truncated: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (size + value.byteLength > max) {
      chunks.push(value.subarray(0, Math.max(0, max - size)));
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}
