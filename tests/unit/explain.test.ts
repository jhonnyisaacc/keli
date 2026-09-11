import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject, projectScope } from "../../src/state/repos.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { explainSelection } from "../../src/core/explain.ts";

describe("explain", () => {
  test("cites rule revision and source", () => {
    const db = new Database(":memory:");
    migrate(db);
    const ownerId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    createOwner(db, ownerId);
    createProject(db, projectId, ownerId, "Rocket", ["/tmp"]);
    const behavior = new BehaviorService(db, ownerId);
    behavior.reviseCodingDelegate("Rocket", "Codex", {
      actor: "owner",
      source: "test",
      trusted: true,
    });
    const scope = projectScope(projectId);
    const explanation = explainSelection(behavior, scope, "coding.delegate");
    expect(explanation.selectedValue).toBe("Codex");
    expect(explanation.revision).toBe(1);
    expect(explanation.rationale).toContain("revision 1");
    db.close();
  });
});
