import type { Database } from "bun:sqlite";
import {
  appendChangeJournal,
  getActiveRule,
  getNextRuleRevision,
  getProjectByName,
  insertRuleRevision,
  projectScope,
  supersedeActiveRules,
  validateFence,
} from "../state/repos.ts";
import type { CodingDelegate, Provenance, Rule } from "./types.ts";
import { isCodingDelegate, toRule } from "./types.ts";

type RuleSpec = { type: string; normalize: (value: string) => string | null };

/**
 * Durable, scoped rule keys other than coding.delegate. Values are normalized here so the
 * stored form is canonical and the model never defines what counts as valid.
 */
export const RULE_SPECS: Record<string, RuleSpec> = {
  /** Comma-separated source collection ids that research answers must cite. */
  "research.requiredCollections": {
    type: "research.policy",
    normalize: (value) => {
      const ids = value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[a-z0-9][a-z0-9_-]*$/.test(s));
      return ids.length ? [...new Set(ids)].sort().join(",") : null;
    },
  },
  /** Whether attributed positions require citations ("true" | "false"). */
  "research.citationsRequired": {
    type: "research.policy",
    normalize: (value) => (/^(true|yes|1)$/i.test(value.trim()) ? "true" : /^(false|no|0)$/i.test(value.trim()) ? "false" : null),
  },
  /** Reply language for a scope (BCP-47 primary tag). */
  "conversation.language": {
    type: "conversation.policy",
    normalize: (value) => (/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(value.trim()) ? value.trim() : null),
  },
  /** Notification policy for watches: "material-change" | "always" | "silent". */
  "watch.notify": {
    type: "watch.policy",
    normalize: (value) => (["material-change", "always", "silent"].includes(value.trim()) ? value.trim() : null),
  },
};

export class BehaviorError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "BehaviorError";
  }
}

export class BehaviorService {
  constructor(
    private readonly db: Database,
    private readonly ownerId: string,
  ) {}

  database(): Database {
    return this.db;
  }

  getRule(scope: string, key: string): Rule | null {
    const row = getActiveRule(this.db, scope, key);
    return row ? toRule(row) : null;
  }

  requireRule(scope: string, key: string): Rule {
    const rule = this.getRule(scope, key);
    if (!rule) throw new BehaviorError(`No active rule for ${scope}/${key}`, "missing_rule");
    return rule;
  }

  reviseCodingDelegate(
    projectName: string,
    delegate: CodingDelegate,
    provenance: Provenance,
    fence?: { holder: string; token: number },
  ): Rule {
    if (provenance.trusted === false) {
      throw new BehaviorError("Untrusted content cannot revise behavior", "untrusted");
    }
    if (!isCodingDelegate(delegate)) {
      throw new BehaviorError(`Invalid delegate: ${delegate}`, "invalid_value");
    }
    if (fence && !validateFence(this.db, fence.holder, fence.token)) {
      throw new BehaviorError("Stale writer rejected by fencing token", "stale_writer");
    }

    const project = getProjectByName(this.db, projectName);
    if (!project) {
      throw new BehaviorError(`Unknown project: ${projectName}`, "unknown_project");
    }

    const scope = projectScope(project.id);
    const key = "coding.delegate";
    const existing = getActiveRule(this.db, scope, key);
    const ruleId = existing?.id ?? `${project.id}-coding-delegate`;
    const revision = getNextRuleRevision(this.db);

    return this.db.transaction(() => {
      supersedeActiveRules(this.db, scope, key);
      const rule = insertRuleRevision(this.db, {
        id: ruleId,
        ownerId: this.ownerId,
        scope,
        type: "coding.delegate",
        key,
        value: delegate,
        revision,
        provenance: { ...provenance, actor: provenance.actor ?? "owner" },
        supersedesId: existing?.id ?? null,
      });
      appendChangeJournal(this.db, {
        entityType: "rule",
        entityId: ruleId,
        revision,
        actor: provenance.actor ?? "owner",
        sourceRef: provenance.source ?? provenance.text ?? "cli",
        payload: { scope, key, value: delegate },
      });
      return toRule(rule);
    }).immediate();
  }

  /**
   * Generic durable rule revision for non-delegate keys (research policy, notification policy).
   * Same authority path as coding.delegate: trusted provenance, fence check, supersede, journal.
   */
  reviseRule(
    input: { scope: string; key: string; value: string },
    provenance: Provenance,
    fence?: { holder: string; token: number },
  ): Rule {
    if (provenance.trusted === false) {
      throw new BehaviorError("Untrusted content cannot revise behavior", "untrusted");
    }
    if (input.key === "coding.delegate") {
      throw new BehaviorError("Use reviseCodingDelegate for coding.delegate", "invalid_value");
    }
    const spec = RULE_SPECS[input.key];
    if (!spec) throw new BehaviorError(`Unknown rule key: ${input.key}`, "invalid_key");
    const value = spec.normalize(input.value);
    if (value == null) throw new BehaviorError(`Invalid value for ${input.key}: ${input.value}`, "invalid_value");
    if (fence && !validateFence(this.db, fence.holder, fence.token)) {
      throw new BehaviorError("Stale writer rejected by fencing token", "stale_writer");
    }
    if (!/^(project:[^\s]+|global)$/.test(input.scope)) {
      throw new BehaviorError(`Invalid scope: ${input.scope}`, "invalid_scope");
    }

    const existing = getActiveRule(this.db, input.scope, input.key);
    const ruleId = existing?.id ?? `${input.scope.replace(/^project:/, "")}-${input.key.replace(/\./g, "-")}`;
    const revision = getNextRuleRevision(this.db);

    return this.db.transaction(() => {
      supersedeActiveRules(this.db, input.scope, input.key);
      const rule = insertRuleRevision(this.db, {
        id: ruleId,
        ownerId: this.ownerId,
        scope: input.scope,
        type: spec.type,
        key: input.key,
        value,
        revision,
        provenance: { ...provenance, actor: provenance.actor ?? "owner" },
        supersedesId: existing?.id ?? null,
      });
      appendChangeJournal(this.db, {
        entityType: "rule",
        entityId: ruleId,
        revision,
        actor: provenance.actor ?? "owner",
        sourceRef: provenance.source ?? provenance.text ?? "cli",
        payload: { scope: input.scope, key: input.key, value },
      });
      return toRule(rule);
    }).immediate();
  }

  undoRule(scope: string, key: string): Rule {
    const current = this.requireRule(scope, key);
    const prior = this.db
      .query(
        "SELECT * FROM rules WHERE id = ? AND revision < ? ORDER BY revision DESC LIMIT 1",
      )
      .get(current.id, current.revision) as Parameters<typeof toRule>[0] | null;

    if (!prior) {
      if (key === "coding.delegate") throw new BehaviorError("No prior revision to undo", "no_prior");
      // First revision of a generic policy rule: undo means "no rule", i.e. back to defaults.
      return this.retireRule(current);
    }

    const provenance: Provenance = {
      actor: "owner",
      undo_of: current.revision,
      restores: prior.revision,
      source: "undo",
    };

    if (key !== "coding.delegate") {
      return this.reviseRule({ scope, key, value: prior.value }, provenance);
    }

    const projectId = scope.replace(/^project:/, "");
    const project = this.db
      .query("SELECT * FROM projects WHERE id = ?")
      .get(projectId) as { name: string } | null;
    const name = project?.name ?? projectId;

    return this.reviseCodingDelegate(name, prior.value as CodingDelegate, provenance);
  }

  /**
   * Retire the active rule for a scope/key without a replacement. Returns the retired rule with
   * status "retired" and an empty value so callers can report that defaults now apply.
   */
  private retireRule(current: Rule): Rule {
    return this.db.transaction(() => {
      supersedeActiveRules(this.db, current.scope, current.key);
      this.db.run("UPDATE rules SET status = 'retired' WHERE id = ? AND revision = ?", [current.id, current.revision]);
      appendChangeJournal(this.db, {
        entityType: "rule",
        entityId: current.id,
        revision: current.revision,
        actor: "owner",
        sourceRef: "undo",
        payload: { scope: current.scope, key: current.key, value: null, retired: true, undo_of: current.revision },
      });
      return { ...current, value: "", status: "retired" };
    }).immediate();
  }

  /** Active rules for one scope whose key starts with the prefix (e.g. `research.`). */
  listRulesByPrefix(scope: string, prefix: string): Rule[] {
    return this.db
      .query("SELECT * FROM rules WHERE scope = ? AND key LIKE ? AND status = 'active' ORDER BY key")
      .all(scope, `${prefix}%`)
      .map((row) => toRule(row as Parameters<typeof toRule>[0]));
  }

  listActiveRules(): Rule[] {
    return this.db
      .query("SELECT * FROM rules WHERE status = 'active' ORDER BY scope, key")
      .all()
      .map((row) => toRule(row as Parameters<typeof toRule>[0]));
  }
}

// Research occurrence truth is committed here, alongside scoped behavior authority.
import { createRun, getRun, cancelRun } from "./run-control.ts";
import { checkEvidence, type ResearchPolicy } from "./evidence.ts";
import type { TurnOutcome } from "../conversation/types.ts";
import { getWatch, appendWatchEvent } from "../watches/store.ts";
import type { WatchRecord } from "../watches/types.ts";
import { investigationOf, type InvestigationAttempt } from "../watches/occurrences.ts";
import { getResearchOccurrence, listResearchOccurrences, type ResearchOccurrence } from "../watches/occurrences.ts";
import { enqueueOutbox } from "../transports/outbox.ts";

/** Single-host ownership: never replace a worker whose process is still alive.
 * PID reuse fails closed; all database writes also require the unique claim token.
 * Research tools are read-only. No lease expiry is used to permit overlapping effects.
 */
function processAlive(pid: number | null): boolean {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return (e as { code?: string }).code !== "ESRCH"; }
}
export class ResearchResponsibilityService {
  constructor(private db: Database, private ownerId: string) {}

  claim(watch: WatchRecord, fingerprint: string, policyKey: string, dependencyKey: string, policy: ResearchPolicy): ResearchOccurrence | null {
    return this.db.transaction(() => {
      const current = getWatch(this.db, watch.id);
      if (!current || current.ownerId !== this.ownerId || current.status !== "active" || current.version !== watch.version) return null;
      const rows = listResearchOccurrences(this.db, watch.id);
      if (rows.some(o => o.token && processAlive(o.pid))) return null;
      for (const o of rows.filter(o => (o.version !== watch.version || o.policy_key !== policyKey) && !["verified", "failed", "cancelled"].includes(o.status))) {
        cancelRun(this.db, o.run_id);
        this.db.run("UPDATE watch_occurrences SET status='cancelled', token=NULL, pid=NULL WHERE id=?", [o.id]);
      }
      let o = rows.find(o => o.version === watch.version && o.policy_key === policyKey && ["active", "waiting_for_evidence", "waiting_for_user"].includes(o.status));
      if (o && o.status === "waiting_for_user" && !o.input_ref) return null;
      if (o && o.status === "waiting_for_evidence" && o.dependency_key === dependencyKey && !o.input_ref) return null;
      if (!o) {
        o = rows.find(o => o.version === watch.version && o.policy_key === policyKey && (o.fingerprint === fingerprint || o.observed_fingerprint === fingerprint));
        if (o) return null;
        const runId = createRun(this.db, watch.scope, undefined, {
          requestsMax: watch.budget.requestsMax ?? 20, tokensMax: watch.budget.tokensMax ?? 50000,
          toolCallsMax: watch.budget.toolCallsMax ?? 20, monetaryBudgetCents: watch.budget.monetaryBudgetCents,
        });
        const id = crypto.randomUUID(), at = new Date().toISOString();
        this.db.run(`INSERT INTO watch_occurrences(id,watch_id,version,fingerprint,observed_fingerprint,policy_key,status,run_id,dependency_key,contract_json,created_at,updated_at)
          VALUES(?,?,?,?,?,?,'active',?,?,?,?,?)`, [id, watch.id, watch.version, fingerprint, fingerprint, policyKey, runId, dependencyKey, JSON.stringify({ watch, policy }), at, at]);
        o = getResearchOccurrence(this.db, id)!;
      }
      if (getRun(this.db, o.run_id)?.status === "cancelled") {
        this.db.run("UPDATE watch_occurrences SET status='cancelled', token=NULL, pid=NULL WHERE id=?", [o.id]);
        return null;
      }
      const generation = o.generation + (o.status.startsWith("waiting_") ? 1 : 0);
      const token = crypto.randomUUID();
      this.db.run("UPDATE watch_occurrences SET status='active', token=?, pid=?, generation=?, dependency_key=?, observed_fingerprint=?, updated_at=? WHERE id=?", [token, process.pid, generation, dependencyKey, fingerprint, new Date().toISOString(), o.id]);
      this.db.run("UPDATE runs SET status='active' WHERE id=? AND status != 'cancelled'", [o.run_id]);
      return getResearchOccurrence(this.db, o.id)!;
    }).immediate();
  }

  assertActive(o: ResearchOccurrence): void {
    const row = getResearchOccurrence(this.db, o.id), watch = getWatch(this.db, o.watch_id);
    if (!row || row.token !== o.token || row.status !== "active" || !watch || watch.status !== "active" || watch.version !== o.version || watch.ownerId !== this.ownerId || getRun(this.db, o.run_id)?.status === "cancelled") {
      throw new BehaviorError("Research ownership or approval changed", "cancelled");
    }
  }

  phase(o: ResearchOccurrence, phase: string): void {
    this.assertActive(o);
    this.db.run("UPDATE watch_occurrences SET phase=?, updated_at=? WHERE id=? AND token=?", [phase, new Date().toISOString(), o.id, o.token]);
  }

  recordAttempt(o: ResearchOccurrence, attempt: InvestigationAttempt): void {
    this.assertActive(o);
    const current = getResearchOccurrence(this.db, o.id);
    if (!current) throw new BehaviorError("Research occurrence disappeared", "cancelled");
    const state = investigationOf(current);
    state.attempts = [...state.attempts, attempt].slice(-32);
    this.db.run("UPDATE watch_occurrences SET investigation_json=?, updated_at=? WHERE id=? AND token=?", [JSON.stringify(state), new Date().toISOString(), o.id, o.token]);
  }

  /** Owner input is data, not authorization. Exact watch+scope and input-id dedupe are required. */
  supplyInput(watchId: string, scope: string, text: string, ref: string): boolean {
    return this.db.transaction(() => {
      const watch = getWatch(this.db, watchId);
      if (!watch || watch.ownerId !== this.ownerId || watch.scope !== scope || watch.status !== "active") return false;
      if (this.db.query("SELECT id FROM watch_events WHERE watch_id=? AND json_extract(detail_json, '$.inputRef')=? LIMIT 1").get(watchId, ref)) return false;
      const o = listResearchOccurrences(this.db, watchId).find(o => o.version === watch.version && o.status.startsWith("waiting_"));
      if (!o || o.input_ref === ref || !text.trim()) return false;
      appendWatchEvent(this.db, watchId, "updated", { inputRef: ref, occurrenceId: o.id });
      this.db.run("UPDATE watch_occurrences SET input_text=?, input_ref=? WHERE id=?", [text.slice(0, 4000), ref, o.id]);
      return true;
    }).immediate();
  }

  finish(o: ResearchOccurrence, outcome: TurnOutcome, policy: ResearchPolicy): { status: string; outboxId?: string } {
    return this.db.transaction(() => {
      this.assertActive(o);
      const watch = getWatch(this.db, o.watch_id)!;
      let status: ResearchOccurrence["status"] = outcome.kind === "answer" ? "verified" : outcome.kind === "clarify" ? "waiting_for_user" : outcome.kind === "missing_evidence" ? "waiting_for_evidence" : "failed";
      if (status === "verified") {
        const known = new Map(Object.entries(outcome.evidence ?? {}));
        for (const [id, evidence] of known) {
          if (id.startsWith("tool:")) {
            if (!evidence.hash || !evidence.text?.trim()) known.delete(id);
            continue;
          }
          const row = this.db.query("SELECT hash FROM source_documents WHERE id=?").get(id) as { hash: string } | null;
          if (!row || row.hash !== evidence.hash) known.delete(id);
        }
        const verdict = checkEvidence({ text: outcome.text, citations: outcome.citations ?? [], attributions: outcome.attributions ?? [] }, { ...policy, strict: true }, known);
        const hashedTool = [...known.entries()].some(([id, evidence]) => id.startsWith("tool:") && Boolean(evidence.hash));
        const citedHashed = (outcome.citations ?? []).some(c => Boolean(known.get(c.sourceId)?.hash));
        if (!verdict.ok || ((policy.requiredCollections?.length ?? 0) === 0 && !hashedTool && !citedHashed)) {
          status = "waiting_for_evidence";
          outcome = { ...outcome, kind: "missing_evidence", text: verdict.ok ? "responsibility completion requires a sufficient tool receipt or current citation" : verdict.reasons.join("; ") };
        }
      }
      const previous = listResearchOccurrences(this.db, watch.id).find(p => p.id !== o.id && p.version === o.version && p.policy_key === o.policy_key && p.status === "verified");
      const prior = previous?.result_json ? JSON.parse(previous.result_json) as TurnOutcome : undefined;
      // Compare explicitly supported findings, excluding narrative wording and source-count churn.
      const thesis = (r: TurnOutcome) => JSON.stringify((r.attributions ?? []).map(a => [a.subject.trim().toLowerCase(), a.claim.trim().toLowerCase(), a.stance ?? "interprets"]).sort());
      const support = (r: TurnOutcome) => JSON.stringify((r.citations ?? []).map(c => [c.sourceId, r.evidence?.[c.sourceId]?.hash, c.quote]).sort());
      const material = !prior || (thesis(prior) !== thesis(outcome) && support(prior) !== support(outcome));
      const old = listResearchOccurrences(this.db, watch.id).find(p => p.id === o.id);
      const previousWait = old?.result_json ? (JSON.parse(old.result_json) as TurnOutcome).kind : undefined;
      const notify = watch.notify.policy !== "silent" && (status === "verified" ? watch.notify.policy === "always" || watch.notify.policy === "daily-brief" || material : status.startsWith("waiting_") ? previousWait !== outcome.kind : true);
      let outboxId: string | undefined;
      if (notify) {
        outboxId = `research:${o.id}:${o.generation}:${status}`;
        enqueueOutbox(this.db, { id: outboxId, scope: watch.scope, destination: watch.notify.channelId ? `discord:${watch.notify.channelId}` : "local:watch", payload: {
          watchId: watch.id, version: watch.version, occurrenceId: o.id, kind: status === "verified" ? "changed" : status.startsWith("waiting_") ? "missing_evidence" : "failed",
          message: `Watch "${watch.name}" [${o.id}]: ${outcome.text.slice(0, 1200)}${outcome.citations?.length ? `\nSources: ${outcome.citations.map(c => c.sourceId).join(", ").slice(0, 500)}` : ""}`, threadId: watch.notify.threadId ?? null,
        } });
      }
      this.db.run("UPDATE watch_occurrences SET status=?, phase=?, result_json=?, token=NULL, pid=NULL, input_ref=NULL, input_text=NULL, updated_at=? WHERE id=?", [status, status === "verified" ? "verify" : "inspect", JSON.stringify(outcome), new Date().toISOString(), o.id]);
      this.db.run("UPDATE runs SET status=? WHERE id=? AND status != 'cancelled'", [status.startsWith("waiting_") ? "waiting" : status === "verified" ? "completed" : "failed", o.run_id]);
      return { status, outboxId };
    }).immediate();
  }

  release(o: ResearchOccurrence): void {
    // Interrupted read-only work can recover from persisted turns with the same budget.
    this.db.run("UPDATE watch_occurrences SET token=NULL,pid=NULL WHERE id=? AND token=?", [o.id, o.token]);
  }
}
