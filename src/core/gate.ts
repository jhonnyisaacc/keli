import type { Database } from "bun:sqlite";
import type { BehaviorService } from "./behavior.ts";
import type { CodingDelegate, DelegateCandidate, Rule } from "./types.ts";

export type DelegateExecutorResult = {
  delegate: string;
  usedFallback?: boolean;
  error?: string;
  output?: unknown;
};

export type DelegateExecutor = (
  prepared: ProposalRequest,
) => Promise<DelegateExecutorResult>;

const CANDIDATE_KEYS = ["delegate", "id", "key", "revision", "scope"] as const;

export type ProposalRequest = {
  id: string;
  request: string;
  scope: string;
  key: string;
  value: string;
  revision: number;
  advisoryContext?: {
    notes?: Array<{ title: string; body: string }>;
    skills?: Array<{ id: string; content: string }>;
  };
};

export type ProviderUsage = {
  estimatedTokens?: number;
  reportedIn?: number;
  reportedCached?: number;
  reportedOut?: number;
  costCents?: number | null;
};

export type ProviderResponse = {
  id: string;
  candidate?: DelegateCandidate;
  error?: string;
  usage?: ProviderUsage;
};

export class GateService {
  constructor(
    private readonly db: Database,
    private readonly behavior: BehaviorService,
  ) {}

  prepare(request: string, scope: string, key: string, runId?: string): ProposalRequest {
    const rule = this.behavior.requireRule(scope, key);
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    this.db.run(
      `INSERT INTO actions(id, run_id, scope, capability, proposal_digest, start_revision, gate_revision, candidate, status, reason, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, NULL, NULL, 'prepared', NULL, ?)`,
      [id, runId ?? null, rule.scope, key, rule.revision, created_at],
    );
    return {
      id,
      request,
      scope: rule.scope,
      key: rule.key,
      value: rule.value,
      revision: rule.revision,
    };
  }

  finish(
    id: string,
    candidate: DelegateCandidate | null | undefined,
    error?: string,
    effectiveDelegate?: string,
  ) {
    return this.db.transaction(() => {
      const action = this.db.query("SELECT * FROM actions WHERE id = ?").get(id) as {
        id: string;
        status: string;
        start_revision: number;
        scope: string;
      } | null;

      if (!action || action.status !== "prepared") {
        throw new Error("Unknown or terminal action");
      }

      const rule = this.behavior.requireRule(action.scope, "coding.delegate");

      const valid =
        !error && this.validateCandidate(id, candidate, rule, effectiveDelegate);
      const status = error ? "engine_error" : valid ? "executed" : "blocked";
      const reason = error
        ? error.startsWith("auth:") || error.startsWith("quota:")
          ? `provider ${error}`
          : error
        : valid
          ? "authoritative rule matched"
          : "candidate rejected by Bun gate";

      if (valid && candidate) {
        this.db.run(
          "INSERT INTO effects(action_id, delegate, revision, recorded_at) VALUES (?, ?, ?, ?)",
          [
            id,
            effectiveDelegate ?? rule.value,
            rule.revision,
            new Date().toISOString(),
          ],
        );
      }

      this.db.run(
        `UPDATE actions SET gate_revision = ?, candidate = ?, status = ?, reason = ?
         WHERE id = ?`,
        [
          rule.revision,
          JSON.stringify(candidate ?? null),
          status,
          reason,
          id,
        ],
      );

      return this.db.query("SELECT * FROM actions WHERE id = ?").get(id);
    }).immediate();
  }

  validateCandidate(
    actionId: string,
    candidate: DelegateCandidate | null | undefined,
    rule: Rule,
    effectiveDelegate?: string,
  ): boolean {
    if (!candidate || typeof candidate !== "object") return false;
    const keys = Object.keys(candidate).sort();
    if (keys.join(",") !== CANDIDATE_KEYS.join(",")) return false;
    if ("status" in (candidate as object)) return false;
    const expectedDelegate = effectiveDelegate ?? rule.value;
    return (
      candidate.id === actionId &&
      candidate.scope === rule.scope &&
      candidate.key === rule.key &&
      candidate.revision === rule.revision &&
      candidate.delegate === expectedDelegate
    );
  }

  async actWithDelegate(
    request: string,
    scope: string,
    key: string,
    execute: DelegateExecutor,
    hooks?: { effectiveDelegate?: string },
  ) {
    const prepared = this.prepare(request, scope, key);
    let execution: DelegateExecutorResult;
    try {
      execution = await execute(prepared);
    } catch (e) {
      const action = this.finish(prepared.id, null, String(e), hooks?.effectiveDelegate);
      return {
        id: prepared.id,
        error: String(e),
        action,
        prepared,
        delegateExecution: undefined,
      };
    }

    if (execution.error) {
      const action = this.finish(
        prepared.id,
        null,
        execution.error,
        execution.delegate,
      );
      return {
        id: prepared.id,
        error: execution.error,
        action,
        prepared,
        delegateExecution: execution,
      };
    }

    const rule = this.behavior.requireRule(scope, key);
    const candidate: DelegateCandidate = {
      id: prepared.id,
      scope: rule.scope,
      key: rule.key,
      revision: rule.revision,
      delegate: execution.delegate,
    };
    const action = this.finish(
      prepared.id,
      candidate,
      undefined,
      hooks?.effectiveDelegate ?? execution.delegate,
    );
    return {
      id: prepared.id,
      candidate,
      action,
      prepared,
      delegateExecution: execution,
    };
  }

  async act(
    request: string,
    scope: string,
    key: string,
    propose: (req: ProposalRequest) => Promise<ProviderResponse>,
    hooks?: { afterCandidate?: () => void; effectiveDelegate?: string },
  ) {
    const prepared = this.prepare(request, scope, key);
    let response: ProviderResponse;
    try {
      response = await propose(prepared);
    } catch (e) {
      response = { id: prepared.id, error: String(e) };
    }
    hooks?.afterCandidate?.();
    const action = this.finish(
      prepared.id,
      response.candidate,
      response.error,
      hooks?.effectiveDelegate,
    );
    return { ...response, action, prepared };
  }

  listEffects() {
    return this.db.query("SELECT * FROM effects ORDER BY recorded_at").all();
  }

  listActions() {
    return this.db.query("SELECT * FROM actions ORDER BY created_at").all();
  }
}
