import type { Rule } from "./types.ts";

export type Citation = {
  sourceId: string;
  /** Optional locator inside the source (heading, timestamp, verse). */
  locator?: string;
  quote?: string;
};

export type Attribution = {
  /** Who is said to hold the position (an author, a channel, a tradition). */
  subject: string;
  claim: string;
  /** Citation source ids supporting this attribution. */
  sourceIds: string[];
  /** How the answer characterizes the relation between compared subjects. */
  stance?: "agrees" | "disagrees" | "interprets" | "no-coverage";
};

export type AnswerDraft = {
  text: string;
  citations: Citation[];
  attributions: Attribution[];
};

export type ResearchPolicy = {
  requiredCollections: string[];
  citationsRequired: boolean;
};

export type EvidenceVerdict = {
  ok: boolean;
  reasons: string[];
  missingCollections: string[];
  unknownSourceIds: string[];
  unsupportedAttributions: string[];
};

export const DEFAULT_RESEARCH_POLICY: ResearchPolicy = { requiredCollections: [], citationsRequired: true };

export function policyFromRules(rules: Rule[]): ResearchPolicy {
  const policy: ResearchPolicy = { ...DEFAULT_RESEARCH_POLICY };
  for (const rule of rules) {
    if (rule.key === "research.requiredCollections") {
      policy.requiredCollections = rule.value.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (rule.key === "research.citationsRequired") {
      policy.citationsRequired = rule.value === "true";
    }
  }
  return policy;
}

/**
 * Deterministic evidence check. `knownSources` is the set of source ids actually returned by
 * gated tool calls during this turn, so a citation cannot point at something the model never
 * retrieved. Attributed positions must carry at least one known citation; every required
 * collection must be represented by at least one known citation.
 */
export function checkEvidence(
  draft: AnswerDraft,
  policy: ResearchPolicy,
  knownSources: Map<string, { collection: string }>,
): EvidenceVerdict {
  const reasons: string[] = [];
  const unknownSourceIds = draft.citations.map((c) => c.sourceId).filter((id) => !knownSources.has(id));
  const knownCitations = draft.citations.filter((c) => knownSources.has(c.sourceId));
  const citedCollections = new Set(knownCitations.map((c) => knownSources.get(c.sourceId)!.collection));

  if (unknownSourceIds.length) {
    reasons.push(`citations reference sources not retrieved this turn: ${unknownSourceIds.join(", ")}`);
  }

  const unsupportedAttributions: string[] = [];
  if (policy.citationsRequired) {
    for (const attribution of draft.attributions) {
      if (attribution.stance === "no-coverage") continue;
      const supported = attribution.sourceIds.some((id) => knownSources.has(id));
      if (!supported) unsupportedAttributions.push(attribution.subject);
    }
    if (unsupportedAttributions.length) {
      reasons.push(`attributed positions without retrieved evidence: ${[...new Set(unsupportedAttributions)].join(", ")}`);
    }
  }

  const missingCollections = policy.requiredCollections.filter((c) => !citedCollections.has(c));
  if (missingCollections.length) {
    reasons.push(`required collections not cited: ${missingCollections.join(", ")}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    missingCollections,
    unknownSourceIds,
    unsupportedAttributions,
  };
}
