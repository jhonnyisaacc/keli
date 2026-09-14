import { readFile } from "node:fs/promises";
import type { CapabilityResult } from "../capabilities/types.ts";
import type { ResourcePolicy } from "../execution/policy.ts";
import { assertReadable } from "../execution/policy.ts";
import { KeliError } from "../core/errors.ts";
import { MAX_ARTIFACT_BYTES, sha256Hex } from "../execution/artifacts.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { defaultCredentialSource } from "../credentials/source.ts";
import { tryResolveIntegration } from "../integrations/resolve.ts";
import type { KeliConfig } from "../state/config.ts";

export type SpeechOptions = {
  config?: KeliConfig | null;
  fixtureUrl?: string;
  credential?: string;
  signal?: AbortSignal;
  cwd?: string;
};

export async function speechTranscribe(
  input: { path: string; model?: string },
  policy: ResourcePolicy,
  options: SpeechOptions = {},
): Promise<CapabilityResult> {
  try {
    if (options.signal?.aborted) throw new KeliError("Transcription cancelled", "cancelled");
    const resolved = assertReadable(policy, input.path, options.cwd);
    const bytes = Buffer.from(await readFile(resolved));
    if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
      throw new KeliError(`Audio exceeds ${MAX_ARTIFACT_BYTES} bytes`, "quota_exceeded");
    }
    const sourceHash = sha256Hex(bytes);
    const { base, credential } = await resolveSpeechEndpoint("speech-transcribe", options);
    if (!base) {
      return {
        capabilityId: "speech.transcribe",
        ok: false,
        error: {
          code: "missing_access",
          message: "Speech transcription is not connected. Configure an OpenAI-compatible audio endpoint or a fixture.",
        },
      };
    }
    const url = `${base.replace(/\/$/, "")}/audio/transcriptions`;
    const form = new FormData();
    form.append("file", new Blob([bytes]), resolved.split("/").pop() ?? "audio.wav");
    form.append("model", input.model ?? "whisper-1");
    const response = await fetch(url, {
      method: "POST",
      headers: credential ? { Authorization: `Bearer ${credential}` } : undefined,
      body: form,
      signal: options.signal ?? AbortSignal.timeout(20_000),
    });
    if (response.status === 401 || response.status === 403) {
      throw new KeliError(`Speech authentication failed (HTTP ${response.status})`, "needs_reauth");
    }
    if (!response.ok) throw new KeliError(`Speech HTTP ${response.status}`, "engine_error", response.status >= 500);
    let payload: { text?: string; duration?: number; segments?: Array<{ start: number; end: number; text: string }> };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new KeliError("Speech returned malformed JSON", "invalid_request");
    }
    const text = payload.text ?? "";
    return {
      capabilityId: "speech.transcribe",
      ok: true,
      output: {
        path: resolved,
        sha256: sourceHash,
        text,
        duration: payload.duration,
        ranges: payload.segments ?? [],
        errors: [],
      },
      artifacts: [{ path: resolved, hash: sourceHash }],
    };
  } catch (e) {
    return fail("speech.transcribe", e);
  }
}

export async function speechSynthesize(
  input: { text: string; model?: string; voice?: string },
  options: SpeechOptions = {},
): Promise<CapabilityResult> {
  try {
    if (options.signal?.aborted) throw new KeliError("Synthesis cancelled", "cancelled");
    const { base, credential } = await resolveSpeechEndpoint("speech-synthesize", options);
    if (!base) {
      return {
        capabilityId: "speech.synthesize",
        ok: false,
        error: {
          code: "missing_access",
          message: "Speech synthesis is not connected. Configure an OpenAI-compatible audio endpoint or a fixture.",
        },
      };
    }
    const response = await fetch(`${base.replace(/\/$/, "")}/audio/speech`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      },
      body: JSON.stringify({
        model: input.model ?? "tts-1",
        input: input.text,
        voice: input.voice ?? "alloy",
      }),
      signal: options.signal ?? AbortSignal.timeout(20_000),
    });
    if (response.status === 401 || response.status === 403) {
      throw new KeliError(`Speech authentication failed (HTTP ${response.status})`, "needs_reauth");
    }
    if (!response.ok) throw new KeliError(`Speech HTTP ${response.status}`, "engine_error", response.status >= 500);
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.byteLength > MAX_ARTIFACT_BYTES) {
      throw new KeliError(`Audio exceeds ${MAX_ARTIFACT_BYTES} bytes`, "quota_exceeded");
    }
    const hash = sha256Hex(audio);
    return {
      capabilityId: "speech.synthesize",
      ok: true,
      output: {
        sha256: hash,
        bytes: audio.byteLength,
        contentType: response.headers.get("content-type") ?? "audio/mpeg",
        bodyBase64: audio.toString("base64"),
      },
      artifacts: [{ path: "speech.synthesize", hash }],
    };
  } catch (e) {
    return fail("speech.synthesize", e);
  }
}

async function resolveSpeechEndpoint(
  id: "speech-transcribe" | "speech-synthesize",
  options: SpeechOptions,
): Promise<{ base?: string; credential?: string }> {
  const fixture = options.fixtureUrl ?? fixtureUrlFor("speech");
  if (fixture) return { base: fixture, credential: options.credential };
  const resolved = tryResolveIntegration("speech", { config: options.config, explicitId: id });
  const base = resolved?.settings.baseUrl ?? resolved?.fixtureUrl;
  let credential = options.credential;
  if (!credential && resolved?.credentialRef) {
    credential = (await defaultCredentialSource().get(resolved.credentialRef)) ?? undefined;
  }
  return { base, credential };
}

function fail(capabilityId: string, error: unknown): CapabilityResult {
  const keli = error instanceof KeliError ? error : null;
  const message = keli?.message ?? String(error);
  const cancelled = keli?.code === "cancelled" || /aborted|AbortError/i.test(message);
  const timeout = /timeout|TimeoutError/i.test(message);
  return {
    capabilityId,
    ok: false,
    error: {
      code: cancelled ? "cancelled" : timeout ? "timeout" : (keli?.code ?? "unknown"),
      message,
      retryable: keli?.retryable ?? timeout,
    },
  };
}
