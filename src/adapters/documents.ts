import { readFile } from "node:fs/promises";
import type { CapabilityResult } from "../capabilities/types.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { assertReadable } from "../execution/policy.ts";
import { KeliError } from "../core/errors.ts";
import { MAX_ARTIFACT_BYTES, sha256Hex } from "../execution/artifacts.ts";
import { resolveBinary, runBoundedProcess } from "../execution/bounded-process.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import type { KeliConfig } from "../state/config.ts";

export type DocumentsExtractOptions = {
  config?: KeliConfig | null;
  fixtureUrl?: string;
  signal?: AbortSignal;
  cwd?: string;
};

/**
 * Extract text from a readable file. Uncompressed PDFs are parsed in-process (no third-party
 * PDF library; license not verified for npm parsers). `pdftotext` and Tesseract are optional
 * owned processes and are never required by CI.
 */
export async function documentsExtract(
  input: { path: string },
  policy: ResourcePolicy,
  options: DocumentsExtractOptions = {},
): Promise<CapabilityResult> {
  return extractFile("documents.extract", input.path, policy, options, "pdf");
}

export async function ocrExtract(
  input: { path: string },
  policy: ResourcePolicy,
  options: DocumentsExtractOptions = {},
): Promise<CapabilityResult> {
  return extractFile("ocr.extract", input.path, policy, options, "ocr");
}

async function extractFile(
  capabilityId: "documents.extract" | "ocr.extract",
  path: string,
  policy: ResourcePolicy,
  options: DocumentsExtractOptions,
  mode: "pdf" | "ocr",
): Promise<CapabilityResult> {
  try {
    if (options.signal?.aborted) throw new KeliError("Extraction cancelled", "cancelled");
    const resolved = assertReadable(policy, path, options.cwd);
    const bytes = Buffer.from(await readFile(resolved));
    if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
      throw new KeliError(`Source exceeds ${MAX_ARTIFACT_BYTES} bytes`, "quota_exceeded");
    }
    const sourceHash = sha256Hex(bytes);
    const fixture = options.fixtureUrl ?? fixtureUrlFor(mode === "ocr" ? "ocr" : "documents");
    if (fixture) {
      return await fixtureExtract(capabilityId, fixture, resolved, sourceHash, bytes, options.signal);
    }

    if (mode === "ocr") {
      return await tesseractExtract("ocr.extract", resolved, sourceHash, bytes, options);
    }
    return await pdfOrTextExtract("documents.extract", resolved, sourceHash, bytes, options);
  } catch (e) {
    return fail(capabilityId, e);
  }
}

async function pdfOrTextExtract(
  capabilityId: "documents.extract",
  path: string,
  sourceHash: string,
  bytes: Buffer,
  options: DocumentsExtractOptions,
): Promise<CapabilityResult> {
  const latin1 = bytes.toString("latin1");
  if (!latin1.startsWith("%PDF")) {
    const text = bytes.toString("utf8");
    return success(capabilityId, path, sourceHash, text, [{ page: 1, text }]);
  }

  const uncompressed = extractUncompressedPdfText(latin1);
  if (uncompressed.trim()) {
    return success(capabilityId, path, sourceHash, uncompressed, [{ page: 1, text: uncompressed }]);
  }

  const bin = resolveBinary(options.config?.integrations?.["documents-pdf"]?.settings?.bin ?? "pdftotext");
  if (!bin) {
    return {
      capabilityId,
      ok: false,
      error: {
        code: "capability_unavailable",
        message: "PDF has no uncompressed text and pdftotext is not installed. Install poppler-utils or use a text PDF fixture.",
      },
    };
  }
  const proc = await runBoundedProcess([bin, "-layout", path, "-"], { signal: options.signal, timeoutMs: 15_000 });
  if (proc.cancelled) throw new KeliError("Extraction cancelled", "cancelled");
  if (proc.timedOut) {
    return { capabilityId, ok: false, error: { code: "timeout", message: "pdftotext exceeded 15000ms" } };
  }
  if (proc.exitCode !== 0) {
    throw new KeliError(proc.stderr.trim() || `pdftotext failed (${proc.exitCode})`, "engine_error");
  }
  return success(capabilityId, path, sourceHash, proc.stdout, [{ page: 1, text: proc.stdout }], { binary: bin });
}

async function tesseractExtract(
  capabilityId: "ocr.extract",
  path: string,
  sourceHash: string,
  bytes: Buffer,
  options: DocumentsExtractOptions,
): Promise<CapabilityResult> {
  const bin = resolveBinary(options.config?.integrations?.["ocr-tesseract"]?.settings?.bin ?? "tesseract");
  if (!bin) {
    return {
      capabilityId,
      ok: false,
      error: {
        code: "capability_unavailable",
        message: "Tesseract is not installed. OCR is optional; CI does not require it.",
      },
    };
  }
  const proc = await runBoundedProcess([bin, path, "stdout"], { signal: options.signal, timeoutMs: 20_000 });
  if (proc.cancelled) throw new KeliError("Extraction cancelled", "cancelled");
  if (proc.timedOut) {
    return { capabilityId, ok: false, error: { code: "timeout", message: "tesseract exceeded 20000ms" } };
  }
  if (proc.exitCode !== 0) {
    throw new KeliError(proc.stderr.trim() || `tesseract failed (${proc.exitCode})`, "engine_error");
  }
  return success(capabilityId, path, sourceHash, proc.stdout, [{ page: 1, text: proc.stdout }], {
    binary: bin,
    bytes: bytes.byteLength,
  });
}

async function fixtureExtract(
  capabilityId: string,
  fixtureUrl: string,
  path: string,
  sourceHash: string,
  bytes: Buffer,
  signal?: AbortSignal,
): Promise<CapabilityResult> {
  const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/extract`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, capabilityId, sha256: sourceHash, bytes: bytes.byteLength }),
    signal: signal ?? AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new KeliError(`Extract fixture HTTP ${response.status}`, "engine_error", response.status >= 500);
  let payload: { text?: string; pages?: Array<{ page: number; text: string }>; confidence?: number; error?: string };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new KeliError("Extract fixture returned malformed JSON", "invalid_request");
  }
  if (payload.error) throw new KeliError(payload.error, "engine_error");
  const text = payload.text ?? payload.pages?.map((p) => p.text).join("\n") ?? "";
  return success(capabilityId, path, sourceHash, text, payload.pages ?? [{ page: 1, text }], {
    confidence: payload.confidence,
  });
}

/** Owned extractor for uncompressed PDF literal strings. Not a general PDF library. */
export function extractUncompressedPdfText(latin1: string): string {
  const chunks: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(latin1))) {
    const body = match[1] ?? "";
    const stringRe = /\((?:\\.|[^\\)])*\)/g;
    let s: RegExpExecArray | null;
    while ((s = stringRe.exec(body))) {
      chunks.push(unescapePdfString(s[0].slice(1, -1)));
    }
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

function unescapePdfString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1");
}

function success(
  capabilityId: string,
  path: string,
  sourceHash: string,
  text: string,
  ranges: Array<{ page: number; text: string }>,
  extra: Record<string, unknown> = {},
): CapabilityResult {
  return {
    capabilityId,
    ok: true,
    output: {
      path,
      sha256: sourceHash,
      text,
      pages: ranges,
      errors: [],
      ...extra,
    },
    artifacts: [{ path, hash: sourceHash }],
  };
}

function fail(capabilityId: string, error: unknown): CapabilityResult {
  const keli = error instanceof KeliError ? error : null;
  const message = keli?.message ?? String(error);
  const cancelled = keli?.code === "cancelled" || /aborted|AbortError/i.test(message);
  return {
    capabilityId,
    ok: false,
    error: {
      code: cancelled ? "cancelled" : (keli?.code ?? "unknown"),
      message,
      retryable: keli?.retryable ?? false,
    },
  };
}
