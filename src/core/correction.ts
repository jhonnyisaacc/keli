import type { CorrectionIntent, RunOverride } from "./types.ts";
import { isCodingDelegate } from "./types.ts";

const REVISE_PATTERN =
  /^(.+?)\s+changes?\s+use\s+(Codex|OpenCode)\s*$/i;

const RUN_OVERRIDE_PATTERN =
  /^use\s+(Codex|OpenCode)\s+(?:only\s+)?this\s+time\s*$/i;

const ACTION_PATTERN = /perform|next|coding action/i;

/** Detect durable correction vs run override vs action request. */
export function parsePrompt(text: string): {
  kind: "correction" | "override" | "action" | "unknown";
  correction?: CorrectionIntent;
  override?: RunOverride;
} {
  const trimmed = text.trim();

  const revise = REVISE_PATTERN.exec(trimmed);
  if (revise) {
    const delegate = revise[2];
    if (!isCodingDelegate(delegate)) return { kind: "unknown" };
    return {
      kind: "correction",
      correction: {
        kind: "revise_delegate",
        projectName: revise[1].trim(),
        delegate: capitalizeDelegate(delegate),
        sourceText: trimmed,
      },
    };
  }

  const override = RUN_OVERRIDE_PATTERN.exec(trimmed);
  if (override) {
    const delegate = override[1];
    if (!isCodingDelegate(delegate)) return { kind: "unknown" };
    return {
      kind: "override",
      override: {
        delegate: capitalizeDelegate(delegate),
        sourceText: trimmed,
      },
    };
  }

  if (ACTION_PATTERN.test(trimmed)) {
    return { kind: "action" };
  }

  return { kind: "unknown" };
}

function capitalizeDelegate(value: string): "Codex" | "OpenCode" {
  if (value.toLowerCase() === "codex") return "Codex";
  if (value.toLowerCase() === "opencode") return "OpenCode";
  throw new Error(`Invalid delegate: ${value}`);
}

/** Ambiguous corrections must ask before any durable change (A07). */
export function isAmbiguousCorrection(text: string): boolean {
  const t = text.trim();
  if (/changes?\s+use\s*$/i.test(t)) return true;
  if (/changes?\s+use\s+(something|maybe|perhaps|\?)/i.test(t)) return true;
  if (/^(rocket|other|[\w-]+)\s+changes?\s*$/i.test(t) && !/use\s+(Codex|OpenCode)/i.test(t)) {
    return true;
  }
  if (/changes?\s+use\s+\w+$/i.test(t) && !isCodingDelegate(t.split(/\s+/).pop()!)) {
    return true;
  }
  return false;
}

/** Quoted or injected instructions must not become durable rules. */
export function isUntrustedInstruction(text: string): boolean {
  const t = text.trim();
  if (t.startsWith('"') && t.endsWith('"')) return true;
  if (t.startsWith("'") && t.endsWith("'")) return true;
  if (/^>\s/.test(t)) return true;
  if (/ignore previous|system:|you are now/i.test(t)) return true;
  return false;
}
