import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrate } from "../../src/state/migrate.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { projectScope } from "../../src/state/repos.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";

describe("0.1-C capability integrations", () => {
  test("http.fetch and web.fetch against allowlisted fixture host", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-01c-http-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    const scope = projectScope("proj-1");
    const gate = new CapabilityGate(db, defaultRegistry, stateDir, "owner-1");
    const policy = { readableRoots: ["/tmp"], writableRoots: ["/tmp"] };
    const fixtures = {
      search: fixture.endpoint,
      browser: fixture.endpoint,
      mcp: fixture.endpoint,
      delegate: fixture.endpoint,
    };

    const http = await gate.run(
      { capabilityId: "http.fetch", input: { url: `${fixture.endpoint}/page` }, resources: [] },
      policy,
      scope,
      undefined,
      { networkHosts: ["127.0.0.1"], fixtures },
    );
    expect(http.result.ok).toBe(true);

    const web = await gate.run(
      { capabilityId: "web.fetch", input: { url: `${fixture.endpoint}/page` }, resources: [] },
      policy,
      scope,
      undefined,
      { networkHosts: ["127.0.0.1"], fixtures },
    );
    expect(web.result.ok).toBe(true);
    expect((web.result.output as { text: string }).text).toContain("Keli fixture");

    db.close();
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });

  test("search, browser, mcp, and delegate fixtures return structured output", async () => {
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-01c-int-"));
    const db = new Database(join(stateDir, "state.sqlite"), { create: true });
    migrate(db);
    const scope = projectScope("proj-1");
    const gate = new CapabilityGate(db, defaultRegistry, stateDir, "owner-1");
    const policy = { readableRoots: ["/tmp"], writableRoots: ["/tmp"] };
    const fixtures = {
      search: fixture.endpoint,
      browser: fixture.endpoint,
      mcp: fixture.endpoint,
      delegate: fixture.endpoint,
    };
    const opts = { networkHosts: ["127.0.0.1"], fixtures };

    const search = await gate.run(
      { capabilityId: "search.query", input: { query: "keli" }, resources: [] },
      policy,
      scope,
      undefined,
      opts,
    );
    expect(search.result.ok).toBe(true);

    const browser = await gate.run(
      {
        capabilityId: "browser.navigate",
        input: { url: `${fixture.endpoint}/page` },
        resources: [],
      },
      policy,
      scope,
      undefined,
      opts,
    );
    expect(browser.result.ok).toBe(true);

    const mcpList = await gate.run(
      { capabilityId: "mcp.tools/list", input: {}, resources: [] },
      policy,
      scope,
      undefined,
      opts,
    );
    expect(mcpList.result.ok).toBe(true);

    const shot = await gate.run(
      { capabilityId: "browser.screenshot", input: { url: `${fixture.endpoint}/page` }, resources: [] },
      policy,
      scope,
      undefined,
      opts,
    );
    expect(shot.result.ok).toBe(true);
    expect((shot.result.output as { kind: string; bodyBase64?: string }).kind).toBe("screenshot");
    expect((shot.result.output as { bodyBase64?: string }).bodyBase64).toBe(Buffer.from("fixture-png").toString("base64"));
    expect(shot.result.artifacts?.[0]?.hash).toBeTruthy();

    const download = await gate.run(
      { capabilityId: "browser.download", input: { url: `${fixture.endpoint}/page` }, resources: [] },
      policy,
      scope,
      undefined,
      opts,
    );
    expect(download.result.ok).toBe(true);
    expect((download.result.output as { kind: string; bodyBase64?: string }).kind).toBe("download");
    expect((download.result.output as { bodyBase64?: string }).bodyBase64).toBe(Buffer.from("fixture-download").toString("base64"));

    const mcpCall = await gate.run(
      {
        capabilityId: "mcp.tools/call",
        input: { name: "echo", arguments: { text: "hi" } },
        resources: [],
      },
      policy,
      scope,
      undefined,
      opts,
    );
    expect(mcpCall.result.ok).toBe(true);

    const delegate = await gate.run(
      {
        capabilityId: "delegate.run",
        input: {
          delegate: "Codex",
          goal: "fix tests",
          workspace: "/tmp/rocket",
          actionId: crypto.randomUUID(),
        },
        resources: [],
      },
      policy,
      scope,
      undefined,
      opts,
    );
    expect(delegate.result.ok).toBe(true);

    db.close();
    fixture.stop();
    await rm(stateDir, { recursive: true, force: true });
  });
});
