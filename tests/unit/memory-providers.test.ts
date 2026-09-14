import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope, reopenDb } from "../helpers/setup.ts";
import { createMemoryProvider, importHonchoAdvisory } from "../../src/memory/provider.ts";
import { addNote } from "../../src/memory/notes.ts";
import { upsertConversation } from "../../src/memory/conversations.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { honchoProfile } from "../../src/integrations/profiles/memory/honcho.ts";

describe("memory providers", () => {
  test("local import, search, read, and retain return advisory evidence", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const memory = createMemoryProvider(env.db);
    const [imported] = await memory.import({
      scope,
      records: [{ title: "deploy checklist", body: "verify staging before prod", sourceRef: "owner" }],
    });
    expect(imported?.advisory).toBe(true);
    expect(imported?.kind).toBe("note");

    const hits = await memory.search({ scope, query: "staging" });
    expect(hits.some((h) => h.id === imported?.id && h.text.includes("staging"))).toBe(true);

    const read = await memory.read({ id: imported!.id, scope });
    expect(read?.text).toContain("verify staging");

    const until = new Date(Date.now() + 86_400_000).toISOString();
    const retained = await memory.retain({ id: imported!.id, retainedUntil: until });
    expect(retained?.id).toBe(imported?.id);
    const row = env.db.query("SELECT retained_until FROM notes WHERE id = ?").get(imported!.id) as { retained_until: string };
    expect(row.retained_until).toBe(until);
    env.close();
  });

  test("notes survive reopen on the same sqlite file", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const id = crypto.randomUUID();
    addNote(env.db, { id, scope, title: "persist", body: "survives restart" });
    env.db.close();

    const reopened = reopenDb(env.stateDir);
    const memory = createMemoryProvider(reopened);
    const read = await memory.read({ id, scope });
    expect(read?.text).toBe("survives restart");
    expect(read?.advisory).toBe(true);
    reopened.close();
    env.fixture.stop();
  });

  test("advisory notes cannot override canonical corrections", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    env.behavior.reviseRule({ scope, key: "research.citationsRequired", value: "true" }, {
      actor: "owner",
      trusted: true,
      source: "test",
    });
    const memory = createMemoryProvider(env.db);
    await memory.import({
      scope,
      records: [{ title: "stale summary", body: "citations are not required anymore" }],
    });
    const hits = await memory.search({ scope, query: "citations" });
    expect(hits[0]?.advisory).toBe(true);
    expect(env.behavior.getRule(scope, "research.citationsRequired")?.value).toBe("true");
    env.close();
  });

  test("conversation summaries are searchable and remain advisory", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    upsertConversation(env.db, { scope, transport: "discord", externalId: "chan-mem", summary: "discussed staging rollback" });
    const memory = createMemoryProvider(env.db);
    const hits = await memory.search({ scope, query: "rollback" });
    expect(hits.some((h) => h.kind === "conversation" && h.advisory)).toBe(true);
    env.close();
  });

  test("Honcho credentials without a fixture are not successful retrieval", async () => {
    const missing = await importHonchoAdvisory(
      { scope: "proj", key: "k", content: "secret-value" },
      { enabled: true, fixtureUrl: undefined },
    );
    expect(missing.ok).toBe(false);
    expect(missing.error?.code).toBe("missing_access");

    const probe = await honchoProfile.roundTrip!({
      settings: { baseUrl: "https://honcho.example" },
      credential: "live-looking-key",
    });
    expect(probe.ok).toBe(false);
    expect(probe.failure).toBe("not-configured");
    expect(JSON.stringify(probe)).not.toContain("live-looking-key");
  });

  test("Honcho fixture hits are advisory and do not write notes", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    const fixture = startIntegrationFixture();
    const honcho = { enabled: true, fixtureUrl: fixture.endpoint };
    const stored = await importHonchoAdvisory({ scope, key: "hint", content: "honcho-only hint" }, honcho);
    expect(stored.ok).toBe(true);

    const memory = createMemoryProvider(env.db, { honcho });
    const hits = await memory.search({ scope, query: "hint" });
    expect(hits.some((h) => h.kind === "honcho" && h.text.includes("honcho-only hint") && h.advisory)).toBe(true);
    expect(env.db.query("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).toEqual({ n: 0 });
    fixture.stop();
    env.close();
  });
});
