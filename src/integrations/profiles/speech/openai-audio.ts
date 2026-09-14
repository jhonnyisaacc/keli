import { registerIntegration } from "../../registry.ts";
import { httpRoundTrip, notConfigured } from "../../round-trip.ts";
import { statusOf } from "../../status.ts";
import type { IntegrationProfile } from "../../types.ts";

function speechProfile(id: "speech-transcribe" | "speech-synthesize", displayName: string): IntegrationProfile {
  return {
    id,
    kind: "speech",
    displayName,
    aliases: id === "speech-transcribe" ? ["stt"] : ["tts"],
    auth: { type: "api-key" },
    settings: [
      { key: "baseUrl", label: "OpenAI-compatible audio base URL" },
      { key: "api-key", label: "API key", secret: true },
    ],
    fixtureKey: "speech",
    reuse: {
      upstream: "OpenAI Audio API (transcriptions / speech)",
      pin: "protocol",
      license: "n/a",
      prdIds: ["I9"],
    },
    async probe(ctx) {
      const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
      return statusOf({
        id,
        kind: "speech",
        displayName,
        configured: Boolean(url),
        credentialState: ctx.credentialRef ? "resolvable" : url ? "n/a" : "missing",
        reachable: Boolean(url),
        reason: url ? "speech endpoint configured" : "optional; configure OpenAI-compatible audio or a fixture",
        howToConfigure: "keli setup (Speech) or KELI_FIXTURE_SPEECH",
      });
    },
    async roundTrip(ctx) {
      const url = ctx.fixtureUrl ?? ctx.settings.baseUrl;
      if (!url) return notConfigured("Speech endpoint is not connected");
      if (!ctx.credential && !ctx.fixtureUrl) {
        return notConfigured("Speech credentials are not live retrieval until a bounded audio request succeeds");
      }
      const path = id === "speech-transcribe" ? "/audio/transcriptions" : "/audio/speech";
      return httpRoundTrip({
        url: `${url.replace(/\/$/, "")}${path}`,
        method: "POST",
        headers: ctx.credential ? { Authorization: `Bearer ${ctx.credential}` } : undefined,
        body: id === "speech-transcribe" ? { model: "whisper-1" } : { model: "tts-1", input: "keli-probe", voice: "alloy" },
        timeoutMs: ctx.timeoutMs,
      });
    },
  };
}

registerIntegration(speechProfile("speech-transcribe", "Speech transcription"));
registerIntegration(speechProfile("speech-synthesize", "Speech synthesis"));
