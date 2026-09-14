import type { CapabilityResult } from "../capabilities/types.ts";
import type { NetworkPolicy } from "../execution/network-policy.ts";
import { assertAllowedHost } from "../execution/network-policy.ts";
import { KeliError } from "../core/errors.ts";
import { boundedTextArtifact } from "../execution/artifacts.ts";

const MAX_RESPONSE_BYTES = 256_000;

export async function httpFetch(
  input: { url: string; method?: string },
  policy: NetworkPolicy,
): Promise<CapabilityResult> {
  try {
    const parsed = assertAllowedHost(policy, input.url);
    const method = (input.method ?? "GET").toUpperCase();
    const response = await fetch(parsed.toString(), { method, redirect: "manual" });
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_RESPONSE_BYTES) {
      throw new KeliError(
        `Response exceeds ${MAX_RESPONSE_BYTES} bytes`,
        "quota_exceeded",
      );
    }
    const text = new TextDecoder().decode(body);
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const artifact = boundedTextArtifact(parsed.toString(), text, contentType);
    return {
      capabilityId: "http.fetch",
      ok: response.ok,
      output: {
        url: artifact.url,
        status: response.status,
        bytes: artifact.bytes,
        body: artifact.text,
        contentType: artifact.contentType,
        sha256: artifact.sha256,
      },
      artifacts: artifact.artifacts,
      error: response.ok
        ? undefined
        : {
            code: "engine_error",
            message: `HTTP ${response.status}`,
            retryable: response.status >= 500,
          },
    };
  } catch (e) {
    return capabilityError("http.fetch", e);
  }
}

function capabilityError(capabilityId: string, error: unknown): CapabilityResult {
  const keli = error instanceof KeliError ? error : null;
  return {
    capabilityId,
    ok: false,
    error: {
      code: keli?.code ?? "unknown",
      message: keli?.message ?? String(error),
      retryable: keli?.retryable ?? false,
    },
  };
}
