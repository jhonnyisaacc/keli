import type { Attribution, Citation } from "../core/evidence.ts";
import type { ModelDecision } from "./types.ts";

export type DecisionParse = { decision: ModelDecision } | { error: string };

function stripFences(content: string): string {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence ? fence[1]! : trimmed;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function citations(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c!.sourceId === "string")
    .map((c) => ({
      sourceId: c.sourceId as string,
      locator: asString(c.locator),
      quote: asString(c.quote)?.slice(0, 600),
    }));
}

function attributions(value: unknown): Attribution[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((a) => (a && typeof a === "object" ? (a as Record<string, unknown>) : null))
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a!.subject === "string" && typeof a!.claim === "string")
    .map((a) => ({
      subject: a.subject as string,
      claim: a.claim as string,
      sourceIds: asStringArray(a.sourceIds),
      stance: ["agrees", "disagrees", "interprets", "no-coverage"].includes(String(a.stance))
        ? (a.stance as Attribution["stance"])
        : undefined,
    }));
}

/** Parses and validates the model's single JSON decision; anything else is a typed invalid_request. */
export function parseDecision(content: string): DecisionParse {
  let raw: unknown;
  try {
    raw = JSON.parse(stripFences(content));
  } catch {
    return { error: "invalid_request: decision is not a JSON object" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "invalid_request: decision must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;
  switch (obj.type) {
    case "tool_call": {
      const capability = asString(obj.capability);
      if (!capability) return { error: "invalid_request: tool_call without capability" };
      const input = obj.input && typeof obj.input === "object" && !Array.isArray(obj.input) ? (obj.input as Record<string, unknown>) : {};
      return { decision: { type: "tool_call", capability, input, reason: asString(obj.reason) } };
    }
    case "answer": {
      const text = asString(obj.text);
      if (!text) return { error: "invalid_request: answer without text" };
      return { decision: { type: "answer", text, citations: citations(obj.citations), attributions: attributions(obj.attributions) } };
    }
    case "missing_evidence": {
      const text = asString(obj.text) ?? "Evidence is missing.";
      return { decision: { type: "missing_evidence", text, searched: asStringArray(obj.searched), needed: asStringArray(obj.needed) } };
    }
    case "clarify": {
      const question = asString(obj.question);
      if (!question) return { error: "invalid_request: clarify without question" };
      return { decision: { type: "clarify", question } };
    }
    default:
      return { error: `invalid_request: unknown decision type ${String(obj.type)}` };
  }
}
