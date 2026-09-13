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
