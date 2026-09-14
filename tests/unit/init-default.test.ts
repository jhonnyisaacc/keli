import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializeState } from "../../src/state/init.ts";
import { DEFAULT_PROJECT_NAME } from "../../src/state/defaults.ts";
import { openDatabase } from "../../src/state/db.ts";
import { getProjectById } from "../../src/state/repos.ts";

describe("init project name", () => {
  test("new installs default to personal, not Rocket", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-init-default-"));
    const result = await initializeState(stateDir);
    expect(result.created).toBe(true);
    expect(result.projectName).toBe(DEFAULT_PROJECT_NAME);
    expect(result.projectName).not.toBe("Rocket");
    const db = await openDatabase(stateDir);
    const project = getProjectById(db, result.projectId);
    db.close();
    expect(project?.name).toBe("personal");
    await rm(stateDir, { recursive: true, force: true });
  });

  test("explicit name is stored; re-init preserves it", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-init-named-"));
    await initializeState(stateDir, { projectName: "emunah" });
    const again = await initializeState(stateDir, { projectName: "ignored" });
    expect(again.created).toBe(false);
    expect(again.projectName).toBe("emunah");
    await rm(stateDir, { recursive: true, force: true });
  });
});
