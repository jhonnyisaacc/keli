/**
 * Deterministic research-policy corrections. These are the only phrasings that become durable
 * rules; anything else is a question for the model, never a behavior change (A07).
 */
export type ResearchCorrection =
  | { kind: "requiredCollections"; projectName: string; collections: string[]; sourceText: string }
  | { kind: "citationsRequired"; projectName: string; value: boolean; sourceText: string }
  | { kind: "undo"; key: "research.requiredCollections" | "research.citationsRequired"; sourceText: string }
  | { kind: "ambiguous"; question: string };

const REQUIRED_PATTERN =
  /^(.+?)\s+(?:research|answers?|respuestas?)\s+(?:must|should|always|debe[n]?|siempre)\s+(?:cite|check|search|consult|citar|revisar|buscar|consultar)\s+(.+)$/i;
const CITATIONS_PATTERN = /^(.+?)\s+(?:answers?|research|respuestas?)\s+(?:require|need|requieren?|necesitan?)\s+(no\s+)?(?:citations?|citas?|evidence|evidencia)\s*$/i;
const UNDO_PATTERN = /^undo\s+(research\.requiredCollections|research\.citationsRequired)\s*$/i;

export function parseResearchCorrection(text: string): ResearchCorrection | null {
  const trimmed = text.trim();
  const undo = UNDO_PATTERN.exec(trimmed);
  if (undo) {
    return {
      kind: "undo",
      key: undo[1]!.toLowerCase() === "research.requiredcollections" ? "research.requiredCollections" : "research.citationsRequired",
      sourceText: trimmed,
    };
  }

  const citations = CITATIONS_PATTERN.exec(trimmed);
  if (citations) {
    return { kind: "citationsRequired", projectName: citations[1]!.trim(), value: !citations[2], sourceText: trimmed };
  }

  const required = REQUIRED_PATTERN.exec(trimmed);
  if (required) {
    const collections = required[2]!
      .replace(/\b(before|first|primero|antes)\b.*$/i, "")
      .split(/,|\band\b|\by\b|\+/i)
      .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""))
      .filter(Boolean);
    if (!collections.length) {
      return { kind: "ambiguous", question: `Which source collections must ${required[1]!.trim()} research cite?` };
    }
    return { kind: "requiredCollections", projectName: required[1]!.trim(), collections, sourceText: trimmed };
  }
  return null;
}
