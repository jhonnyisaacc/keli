import { describe, expect, test } from "bun:test";
import { createTestEnv, projectScope } from "../helpers/setup.ts";
import { addNote, searchNotes } from "../../src/memory/notes.ts";
import {
  honchoStore,
  honchoQuery,
  honchoDelete,
  isHonchoAvailable,
} from "../../src/adapters/honcho.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { listProviders, resolveProvider } from "../../src/model/provider-registry.ts";
import { HttpModelProvider } from "../../src/model/http-provider.ts";
import { FixtureModelProvider } from "../../src/model/provider.ts";

describe("0.1-F memory, Honcho, providers, browser", () => {
  test("local notes FTS search is advisory", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    addNote(env.db, {
      id: crypto.randomUUID(),
      scope,
      title: "deploy checklist",
      body: "verify staging before prod",
    });
    const hits = searchNotes(env.db, scope, "staging");
    expect(hits.length).toBe(1);
    env.close();
  });

  test("note search treats punctuation and FTS operators as literal text", async () => {
    const env = await createTestEnv();
    const scope = projectScope(env.rocketId);
    addNote(env.db, {
      id: "n-punct",
      scope,
      title: "Checklist",
      body: "zebra-marmalade sentinel for release: row 7",
    });
    // Hyphens, colons, quotes, and operator words used to reach FTS5 raw and throw.
    expect(searchNotes(env.db, scope, "zebra-marmalade").length).toBe(1);
    expect(searchNotes(env.db, scope, 'release: "row 7"').length).toBe(1);
    expect(searchNotes(env.db, scope, "sentinel AND missing-term").length).toBe(0);
    expect(searchNotes(env.db, scope, "   ").length).toBe(0);
    env.close();
  });

  test("Honcho absent when disabled (A29)", () => {
    const prev = process.env.KELI_HONCHO_ENABLED;
    delete process.env.KELI_HONCHO_ENABLED;
    expect(isHonchoAvailable({ enabled: false })).toBe(false);
    if (prev) process.env.KELI_HONCHO_ENABLED = prev;
  });

  test("Honcho fixture outage and delete", async () => {
    const fixture = startIntegrationFixture();
    const config = { enabled: true, fixtureUrl: fixture.endpoint };
    process.env.KELI_FIXTURE_HONCHO_OUTAGE = "1";
    const outage = await honchoStore({ scope: "test", key: "k", content: "v" }, config);
    expect(outage.ok).toBe(false);
    delete process.env.KELI_FIXTURE_HONCHO_OUTAGE;

    await honchoStore({ scope: "test", key: "k", content: "v" }, config);
    const query = await honchoQuery({ scope: "test", query: "k" }, config);
    expect(query.ok).toBe(true);
    await honchoDelete("test", "k", config);
    const after = await honchoQuery({ scope: "test", query: "k" }, config);
    expect(after.records?.length ?? 0).toBe(0);
    fixture.stop();
  });

  test("named later providers stay unavailable", () => {
    const providers = listProviders();
    const claude = providers.find((p) => p.id === "claude-code");
    expect(claude?.available).toBe(false);
    expect(claude?.reason).toContain("unavailable");
  });

  test("browser.session uses credential ref without leaking secret", async () => {
    const fixture = startIntegrationFixture();
    const env = await createTestEnv();
    const gate = new CapabilityGate(env.db, defaultRegistry, env.stateDir, env.ownerId);
    const scope = projectScope(env.rocketId);
    const { result } = await gate.run(
      {
        capabilityId: "browser.session",
        input: { url: `${fixture.endpoint}/page` },
        resources: [],
      },
      { readableRoots: ["/tmp"], writableRoots: [] },
      scope,
      undefined,
      {
        fixtures: { browser: fixture.endpoint },
        networkHosts: ["127.0.0.1"],
      },
    );
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.output)).not.toContain("password");
    fixture.stop();
    env.close();
  });

  test("A05 Grok fixture override via HTTP provider", async () => {
    const fixture = startIntegrationFixture();
    const prev = process.env.KELI_GROK_FIXTURE_URL;
    process.env.KELI_GROK_FIXTURE_URL = fixture.endpoint;
    const provider = new HttpModelProvider(fixture.endpoint, "grok-fixture");
    const response = await provider.propose({
      id: crypto.randomUUID(),
      request: "perform",
      scope: "project:test",
      key: "coding.delegate",
      value: "Codex",
      revision: 1,
    });
    expect(response.candidate?.delegate).toBe("Codex");
    expect(response.error).toBeUndefined();
    if (prev) process.env.KELI_GROK_FIXTURE_URL = prev;
    else delete process.env.KELI_GROK_FIXTURE_URL;
    fixture.stop();
  });

  test("fixture provider still default in tests", () => {
    const fixture = listProviders().find((p) => p.id === "fixture");
    expect(fixture).toBeTruthy();
    expect(new FixtureModelProvider("http://127.0.0.1:1/v1")).toBeTruthy();
  });

  test("resolveProvider uses first available when fixture is unset", () => {
    const prevFixture = process.env.KELI_FIXTURE_URL;
    const prevProvider = process.env.KELI_PROVIDER_URL;
    const prevId = process.env.KELI_PROVIDER_ID;
    delete process.env.KELI_FIXTURE_URL;
    delete process.env.KELI_PROVIDER_ID;
    process.env.KELI_PROVIDER_URL = "http://127.0.0.1:9";
    const provider = resolveProvider();
    expect(provider.constructor.name).toBe("HttpModelProvider");
    if (prevFixture) process.env.KELI_FIXTURE_URL = prevFixture;
    else delete process.env.KELI_FIXTURE_URL;
    if (prevProvider) process.env.KELI_PROVIDER_URL = prevProvider;
    else delete process.env.KELI_PROVIDER_URL;
    if (prevId) process.env.KELI_PROVIDER_ID = prevId;
    else delete process.env.KELI_PROVIDER_ID;
  });
});
