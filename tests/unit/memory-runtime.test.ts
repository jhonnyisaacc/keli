import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { appendTurn } from "../../src/conversation/turns.ts";
import { upsertConversation, listConversations } from "../../src/memory/conversations.ts";
import { writeCheckpoint, getLatestCheckpoint } from "../../src/memory/checkpoints.ts";
import { compactMemory } from "../../src/memory/retention.ts";
import { readPreservationCursor } from "../../src/preservation/cursor.ts";
import { ensureArtifactDir } from "../../src/state/artifacts.ts";
import { addNote } from "../../src/memory/notes.ts";
import { pinSkillVersion } from "../../src/skills/store.ts";
import { maybeRecordSkillUse } from "../../src/skills/activation.ts";

describe("memory and skill runtime", () => {
  test("conversations upsert by transport route", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    upsertConversation(env.db, {
      scope,
      transport: "discord",
      externalId: "chan-1",
      summary: "hello",
    });
    upsertConversation(env.db, {
      scope,
      transport: "discord",
      externalId: "chan-1",
      summary: "updated",
    });
    const listed = listConversations(env.db);
    expect(listed.filter((c) => c.externalId === "chan-1")).toHaveLength(1);
    expect(listed[0]?.summary).toBe("updated");
    env.close();
  });

  test("checkpoints persist working state", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    writeCheckpoint(env.db, {
      scope,
      runId: "run-1",
      goal: "files.read",
      state: { done: ["files.read"], pending: [], evidence: ["abc"] },
    });
    const latest = getLatestCheckpoint(env.db, scope);
    expect(latest?.goal).toBe("files.read");
    expect(latest?.state.done).toEqual(["files.read"]);
    env.close();
  });

  test("two comparable uses activate a draft skill", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    pinSkillVersion(env.db, {
      id: "deploy",
      version: 1,
      scope,
      source: "owner",
      content: "deploy checklist",
      activationStatus: "draft",
    });
    maybeRecordSkillUse(env.db, scope, "please run deploy", 2);
    const afterOne = maybeRecordSkillUse(env.db, scope, "please run deploy", 2);
    expect(afterOne?.activationStatus).toBe("active");
    expect(afterOne?.comparableUses).toBe(2);
    env.close();
  });

  test("compact archives then advances cursor", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    addNote(env.db, {
      id: crypto.randomUUID(),
      scope,
      title: "old",
      body: "ancient",
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    const result = await compactMemory(env.db, env.stateDir, env.ownerId, { rawDays: 1 });
    expect(result.archived).toBeGreaterThanOrEqual(1);
    env.close();
  });

  test("compaction verifies the archive, includes conversation turns, and is idempotent", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    addNote(env.db, {
      id: crypto.randomUUID(),
      scope,
      title: "old",
      body: "ancient",
      createdAt: "2000-01-01T00:00:00.000Z",
    });
    const conversation = upsertConversation(env.db, { scope, transport: "discord", externalId: "thread:old" });
    env.db.run("UPDATE conversations SET created_at = '2000-01-01T00:00:00.000Z' WHERE id = ?", [conversation.id]);
    appendTurn(env.db, {
      conversationId: conversation.id,
      scope,
      role: "user",
      kind: "message",
      content: "what did Eric teach about grace?",
      sourceRef: "discord:1",
    });
    appendTurn(env.db, {
      conversationId: conversation.id,
      scope,
      role: "assistant",
      kind: "answer",
      content: "Grace enables obedience.",
      sourceRef: "discord:1",
    });

    const first = await compactMemory(env.db, env.stateDir, env.ownerId, { rawDays: 1 });
    expect(first.archived).toBe(2);
    expect(first.verified).toBe(2);
    expect(first.failures).toEqual([]);
    expect(first.cursorAdvanced).toBe(true);
    expect(readPreservationCursor(env.db).lastJournalId).toBe(first.cursorJournalId!);

    // The archived conversation artifact carries its full turn history.
    const artifact = env.db
      .query("SELECT path, hash FROM artifacts WHERE type = 'memory:conversation'")
      .get() as { path: string; hash: string };
    const bytes = await Bun.file(join(await ensureArtifactDir(env.stateDir), artifact.path)).arrayBuffer();
    const archived = JSON.parse(new TextDecoder().decode(bytes)) as { id: string; turns: Array<{ content: string }> };
    expect(archived.id).toBe(conversation.id);
    expect(archived.turns.map((t) => t.content)).toEqual(["what did Eric teach about grace?", "Grace enables obedience."]);
    expect(createHash("sha256").update(new Uint8Array(bytes)).digest("hex")).toBe(artifact.hash);

    // Second pass: nothing new to archive, previously archived rows are reported, no duplicates.
    const second = await compactMemory(env.db, env.stateDir, env.ownerId, { rawDays: 1 });
    expect(second.archived).toBe(0);
    expect(second.alreadyArchived).toBe(2);
    expect((env.db.query("SELECT COUNT(*) AS n FROM artifacts WHERE type LIKE 'memory:%'").get() as { n: number }).n).toBe(2);

    // Rows still marked archived exactly once.
    const archivedRows = env.db
      .query("SELECT COUNT(*) AS n FROM conversations WHERE archived_at IS NOT NULL")
      .get() as { n: number };
    expect(archivedRows.n).toBe(1);
    env.close();
  });
});
