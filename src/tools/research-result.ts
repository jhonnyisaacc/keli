import type {
  AcquisitionStatus,
  EvidenceSufficiency,
  StructuredToolEvidence,
  ToolExecutionStatus,
} from "./types.ts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickStatus(value: unknown, allowed: readonly string[]): string | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

/**
 * Map Rocket-style `ResearchResult` JSON without treating command success as
 * research sufficiency or a completed responsibility.
 */
export function projectResearchResult(raw: unknown, execution: ToolExecutionStatus): StructuredToolEvidence {
  const root = asRecord(raw);
  const operational = asRecord(root?.operational) ?? asRecord(root?.health);
  const acquisition = asRecord(root?.acquisition);
  const research = asRecord(root?.research);

  let acquisitionStatus: AcquisitionStatus = "unknown";
  let acquisitionDetail: string | undefined;
  const declaredAcquisition = pickStatus(acquisition?.status, ["healthy", "unavailable", "unknown"]);
  if (declaredAcquisition) acquisitionStatus = declaredAcquisition as AcquisitionStatus;
  else if (operational && operational.ok === false) acquisitionStatus = "unavailable";
  else if (typeof root?.ok === "boolean" && root.ok === false && !research) acquisitionStatus = "unavailable";
  else if (execution.ok && (operational?.ok === true || acquisition?.ok === true)) acquisitionStatus = "healthy";
  else if (execution.ok && raw && typeof raw === "object") acquisitionStatus = "unknown";

  if (typeof acquisition?.error === "string") acquisitionDetail = acquisition.error;
  else if (typeof operational?.error === "string") acquisitionDetail = operational.error;
  else if (typeof root?.error === "string" && !research) acquisitionDetail = root.error;

  let sufficiency: EvidenceSufficiency = "unknown";
  const declared = pickStatus(research?.sufficient, ["sufficient", "insufficient", "unknown"])
    ?? (research?.sufficient === true ? "sufficient" : research?.sufficient === false ? "insufficient" : undefined);
  if (declared) sufficiency = declared as EvidenceSufficiency;
  else if (research && research.finding == null && research.sufficient == null) sufficiency = "insufficient";

  const finding = research?.finding !== undefined ? research.finding : root?.finding !== undefined ? root.finding : null;

  return {
    execution,
    acquisition: { status: acquisitionStatus, ...(acquisitionDetail ? { detail: acquisitionDetail } : {}) },
    evidence: {
      sufficiency,
      coverage: research?.coverage ?? acquisition?.coverage ?? root?.coverage,
      freshness: research?.freshness ?? acquisition?.freshness ?? root?.freshness,
      effectiveTime: research?.effectiveTime ?? acquisition?.effectiveTime ?? root?.effectiveTime,
    },
    finding,
  };
}

export function compactProjection(evidence: StructuredToolEvidence, workflow: string, profileId: string): Record<string, unknown> {
  return {
    workflow,
    profileId,
    executionOk: evidence.execution.ok,
    timedOut: evidence.execution.timedOut,
    cancelled: evidence.execution.cancelled,
    acquisition: evidence.acquisition.status,
    evidenceSufficiency: evidence.evidence.sufficiency,
    hasFinding: evidence.finding != null,
    finding: evidence.finding,
    integrationGap: evidence.integrationGap,
    coverage: evidence.evidence.coverage ?? null,
    freshness: evidence.evidence.freshness ?? null,
    effectiveTime: evidence.evidence.effectiveTime ?? null,
  };
}
