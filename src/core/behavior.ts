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

  undoRule(scope: string, key: string): Rule {
    const current = this.requireRule(scope, key);
    const prior = this.db
      .query(
        "SELECT * FROM rules WHERE id = ? AND revision < ? ORDER BY revision DESC LIMIT 1",
      )
      .get(current.id, current.revision) as Parameters<typeof toRule>[0] | null;

    if (!prior) {
      throw new BehaviorError("No prior revision to undo", "no_prior");
    }

    const projectId = scope.replace(/^project:/, "");
    const project = this.db
      .query("SELECT * FROM projects WHERE id = ?")
      .get(projectId) as { name: string } | null;
    const name = project?.name ?? projectId;

    return this.reviseCodingDelegate(name, prior.value as CodingDelegate, {
      actor: "owner",
      undo_of: current.revision,
      restores: prior.revision,
      source: "undo",
    });
  }

  listActiveRules(): Rule[] {
    return this.db
      .query("SELECT * FROM rules WHERE status = 'active' ORDER BY scope, key")
      .all()
      .map((row) => toRule(row as Parameters<typeof toRule>[0]));
  }
}
