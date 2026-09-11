import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { storeArtifact } from "../../src/state/artifacts.ts";

describe("artifacts", () => {
  test("stores content-addressed artifact with receipt", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-artifact-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);

    const record = await storeArtifact(db, stateDir, {
      ownerId: "owner-1",
      scope: "project:test",
      type: "test",
      content: "hello artifact",
    });

    expect(record.hash).toHaveLength(64);
    const bytes = await readFile(join(stateDir, "artifacts", record.path));
    expect(new TextDecoder().decode(bytes)).toBe("hello artifact");

    const count = db.query("SELECT COUNT(*) AS n FROM artifacts").get() as { n: number };
    expect(count.n).toBe(1);

    db.close();
    await rm(stateDir, { recursive: true, force: true });
  });
});
