export const CODING_DELEGATES = ["Codex", "OpenCode"] as const;
export type CodingDelegate = (typeof CODING_DELEGATES)[number];

export type Provenance = {
  actor: string;
  source?: string;
  text?: string;
  undo_of?: number;
  restores?: number;
  trusted?: boolean;
};

export type RuleRecord = {
  id: string;
  owner_id: string;
  scope: string;
  type: string;
  key: string;
  value: string;
  revision: number;
  provenance_json: string;
  status: string;
  supersedes_id: string | null;
  created_at: string;
};

export type Rule = {
  id: string;
  ownerId: string;
  scope: string;
  type: string;
  key: string;
  value: string;
  revision: number;
  provenance: Provenance;
  status: string;
};

export type DelegateCandidate = {
  id: string;
  scope: string;
  key: string;
  revision: number;
  delegate: string;
};

export type ActionRecord = {
  id: string;
  run_id: string | null;
  capability: string;
  proposal_digest: string | null;
  start_revision: number | null;
  gate_revision: number | null;
  candidate: string | null;
  status: string;
  reason: string | null;
  created_at: string;
};

export type CorrectionIntent = {
  kind: "revise_delegate";
  projectName: string;
  delegate: CodingDelegate;
  sourceText: string;
};

export type RunOverride = {
  delegate: CodingDelegate;
  sourceText: string;
};

export function toRule(row: RuleRecord): Rule {
  return {
    id: row.id,
    ownerId: row.owner_id,
    scope: row.scope,
    type: row.type,
    key: row.key,
    value: row.value,
    revision: row.revision,
    provenance: JSON.parse(row.provenance_json) as Provenance,
    status: row.status,
  };
}

export function isCodingDelegate(value: string): value is CodingDelegate {
  return (CODING_DELEGATES as readonly string[]).includes(value);
}
