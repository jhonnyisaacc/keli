import type { Database } from "bun:sqlite";
import type { CapabilityRegistry } from "../capabilities/registry.ts";
import type { ResearchPolicy } from "../core/evidence.ts";
import { searchNotes } from "../memory/notes.ts";
import type { ChatMessage } from "../model/chat-provider.ts";
import type { SourceReader } from "../sources/reader.ts";
import type { ConversationTurn } from "./turns.ts";
import type { TurnContext } from "./types.ts";

export const RESEARCH_CAPABILITIES = [
  "sources.collections",
  "sources.search",
  "sources.read",
  "search.query",
  "web.fetch",
  "http.fetch",
] as const;

export type ResearchCapability = (typeof RESEARCH_CAPABILITIES)[number];

export function isResearchCapability(id: string): id is ResearchCapability {
  return (RESEARCH_CAPABILITIES as readonly string[]).includes(id);
}

const HISTORY_TURNS = 10;
const HISTORY_CHARS = 1500;

export function buildSystemPrompt(input: {
  ctx: TurnContext;
  policy: ResearchPolicy;
  language?: string;
  registry: CapabilityRegistry;
  sources?: SourceReader;
  db: Database;
  prompt: string;
  allowedCapabilities?: readonly string[];
  commitments?: string;
}): string {
  const { ctx, policy } = input;
  const lines: string[] = [];
  lines.push(
    `You are Keli, a personal research assistant for the project "${ctx.projectName}". You work by proposing one step at a time; Keli executes tools and verifies evidence. You never execute anything yourself.`,
  );
  if (input.language) lines.push(`Reply in language: ${input.language}.`);
  lines.push("");
  lines.push("Research policy (authoritative, set by the owner):");
  lines.push(`- citations required for any attributed position: ${policy.citationsRequired ? "yes" : "no"}`);
  lines.push(
    `- source collections that must be searched and cited before attributing a position: ${
      policy.requiredCollections.length ? policy.requiredCollections.join(", ") : "(none configured)"
    }`,
  );
  lines.push("- Distinguish agreement, disagreement, interpretation, and missing coverage. Never reconstruct what someone 'would' say without retrieved evidence.");
  lines.push("- Cite only sourceIds returned by tools in this turn. If evidence is missing after searching, say so with type \"missing_evidence\".");

  if (policy.strict) {
    const sourceContract = policy.requiredCollections.length
      ? "Read current passages with sources.read before answering; cite exact quotes."
      : "For approved structured tools, cite the returned sourceId and quote the projection only when evidence.sufficiency is sufficient and finding is present. Do not request sources.read unless it is approved. If a tool reports insufficient or unknown evidence, return missing_evidence explaining its actual coverage, warnings, or integration gap; do not invent missing passage IDs.";
    lines.push(`Evidence contract: ${sourceContract} Provide explicit attributions for supported findings, including assumptions/invalidation in the claim when relevant. Required subjects: ${(policy.requiredSubjects ?? []).join(", ")}. Search identifiers alone do not establish support. Missing coverage must remain missing_evidence. Reuse addressed recovered observations; change an unsuccessful retrieval strategy.`);
  }
  const collections = (input.sources?.collections() ?? []).filter(c => !policy.strict || policy.requiredCollections.includes(c.id));
  lines.push("");
  lines.push(collections.length ? "Indexed source collections:" : "Indexed source collections: none (sources.* tools will report unavailable).");
  for (const c of collections) {
    lines.push(
      `- ${c.id}: ${c.documents} documents${c.authors.length ? `; authors: ${c.authors.join(", ")}` : ""}${
        c.latestPublishedAt ? `; latest ${c.latestPublishedAt}` : ""
      }`,
    );
  }

  const notes = safeNotes(input.db, ctx.scope, input.prompt);
  if (notes.length) {
    lines.push("");
    lines.push("Owner notes (advisory, may be stale):");
    for (const note of notes) lines.push(`- ${note.title}: ${note.body.slice(0, 300)}`);
  }

  if (input.commitments) {
    lines.push("");
    lines.push("Current commitments and constraints (authoritative; supersede older summaries):");
    lines.push(input.commitments.slice(0, 4000));
  }

  lines.push("");
  const listed = input.allowedCapabilities ?? RESEARCH_CAPABILITIES;
  if (input.allowedCapabilities) {
    lines.push("Approved tools (ids only). Call capabilities.lookup with a query to load one approved schema. You may not use a tool that is not listed.");
    for (const id of listed) lines.push(`- ${id}`);
  } else {
    lines.push("Tools you may request (one per step):");
    for (const id of listed) {
      const descriptor = input.registry.get(id);
      if (!descriptor) continue;
      const props = Object.keys((descriptor.schema.properties as Record<string, unknown>) ?? {});
      lines.push(`- ${id}: ${descriptor.summary}. input keys: ${props.join(", ") || "(none)"}`);
    }
  }

  lines.push("");
  lines.push("Respond with exactly one JSON object, no prose outside it, in one of these shapes:");
  lines.push('{"type":"tool_call","capability":"sources.search","input":{"query":"...","collection":"..."},"reason":"..."}');
  lines.push(
    '{"type":"answer","text":"...","citations":[{"sourceId":"...","locator":"...","quote":"..."}],"attributions":[{"subject":"...","claim":"...","sourceIds":["..."],"stance":"agrees|disagrees|interprets|no-coverage"}]}',
  );
  lines.push('{"type":"missing_evidence","text":"what you searched and what is missing","searched":["..."],"needed":["..."]}');
  lines.push('{"type":"clarify","question":"one short question"}');
  return lines.join("\n");
}

export function historyMessages(turns: ConversationTurn[]): ChatMessage[] {
  const relevant = turns.filter((t) => t.role === "user" || (t.role === "assistant" && t.kind !== "tool_call"));
  return relevant.slice(-HISTORY_TURNS).map((t) => ({
    role: t.role === "user" ? "user" : "assistant",
    content: t.content.length > HISTORY_CHARS ? `${t.content.slice(0, HISTORY_CHARS)}…` : t.content,
  }));
}

function safeNotes(db: Database, scope: string, prompt: string) {
  try {
    const q = prompt
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4)
      .map((w) => `"${w.replace(/"/g, "")}"`)
      .join(" OR ");
    if (!q) return [];
    return searchNotes(db, scope, q, 3);
  } catch {
    return [];
  }
}
