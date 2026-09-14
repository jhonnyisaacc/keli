import type { ActionClass } from "../capabilities/types.ts";

/** Declared structured CLI tool. The model never supplies the executable or raw argv. */
export type StructuredToolProfile = {
  id: string;
  version: string;
  summary: string;
  actionClass: ActionClass;
  executable: string;
  /** Argument templates. Only `{name}` placeholders from the declared input schema may be filled. */
  args: string[];
  workflows: string[];
  timeoutMs: number;
  maxOutputBytes: number;
  stateEnvVar?: string;
  stateDir?: string;
  testedRevision?: string;
};

export type ToolExecutionStatus = {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  truncated: boolean;
  durationMs: number;
};

export type AcquisitionStatus = "healthy" | "unavailable" | "unknown";
export type EvidenceSufficiency = "sufficient" | "insufficient" | "unknown";

/**
 * Keli evidence projection of a domain `ResearchResult`.
 * Command success, acquisition health, evidence sufficiency, and a domain finding
 * are separate. Responsibility fulfillment and notification are never set here.
 */
export type StructuredToolEvidence = {
  execution: ToolExecutionStatus;
  acquisition: { status: AcquisitionStatus; detail?: string };
  evidence: {
    sufficiency: EvidenceSufficiency;
    coverage?: unknown;
    freshness?: unknown;
    effectiveTime?: unknown;
  };
  finding: unknown;
  integrationGap?: string;
};

export type StructuredToolOutput = StructuredToolEvidence & {
  sourceId: string;
  workflow: string;
  profileId: string;
  testedRevision?: string;
  projection: Record<string, unknown>;
  raw?: unknown;
};
