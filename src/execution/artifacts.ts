import { createHash } from "node:crypto";
import { KeliError } from "../core/errors.ts";

export const MAX_ARTIFACT_BYTES = 256_000;

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function boundedTextArtifact(
  url: string,
  text: string,
  contentType = "text/plain",
  maxBytes = MAX_ARTIFACT_BYTES,
): {
  url: string;
  contentType: string;
  bytes: number;
  sha256: string;
  text: string;
  artifacts: { path: string; hash: string }[];
} {
  const buf = Buffer.from(text);
  if (buf.byteLength > maxBytes) {
    throw new KeliError(`Response exceeds ${maxBytes} bytes`, "quota_exceeded");
  }
  const sha256 = sha256Hex(buf);
  return {
    url,
    contentType,
    bytes: buf.byteLength,
    sha256,
    text,
    artifacts: [{ path: url, hash: sha256 }],
  };
}
