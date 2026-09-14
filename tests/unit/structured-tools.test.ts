import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { createRun, cancelRun } from "../../src/core/run-control.ts";
import { dispatchCapability } from "../../src/execution/dispatch.ts";
import { defaultNetworkPolicy } from "../../src/execution/dispatch-context.ts";
import { migrate } from "../../src/state/migrate.ts";
import { resolveArgs } from "../../src/tools/cli-adapter.ts";
import { resolveRocketProfile } from "../../src/tools/profiles.ts";
import { projectResearchResult } from "../../src/tools/research-result.ts";
import type { KeliConfig } from "../../src/state/config.ts";

const fixture = fileURLToPath(new URL("../fixtures/structured-tool-cli.ts", import.meta.url));

function config(workflows = ["research", "positions", "macro", "health", "sleep"]): KeliConfig {
  return {
    version: 2,
    ownerId: "owner",
    defaultProjectId: "p",
    tools: {
      rocket: {
        bin: process.execPath,
        args: [fixture, "{workflow}", "--json"],
        workflows,
        revision: "fixture",
        timeoutMs: 2000,
      },
    },
  };
}

function ctx(configValue: KeliConfig, run?: { db: Database; runId: string; cancelEpoch: number }) {
  return {
    policy: { readableRoots: [tmpdir()], writableRoots: [tmpdir()] },
    network: defaultNetworkPolicy(),
    config: configValue,
    run,
  };
}

describe("structured CLI tools", () => {
  test("tools.rocket is registered without expanding authority", () => {
    const cap = defaultRegistry.get("tools.rocket");
    expect(cap?.actionClass).toBe("read");
    expect(cap?.schema.required).toEqual(["workflow"]);
  });

  test("missing executable is an explicit integration gap", async () => {
    const result = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "tools.rocket", input: { workflow: "research" }, resources: [] },
      ctx({ version: 2, ownerId: "o", defaultProjectId: "p" }),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("integration_gap");
    expect(result.error?.message).toContain("ROCKET_BIN");
  });

  test("model cannot supply argv beyond the declared workflow", () => {
    const profile = resolveRocketProfile(config());
    expect(() => resolveArgs(profile, { workflow: "research; rm -rf /" })).toThrow();
    expect(() => resolveArgs(profile, { workflow: "research", extra: ["--eval"] })).not.toThrow();
    expect(resolveArgs(profile, { workflow: "research" })).toEqual([fixture, "research", "--json"]);
    expect(resolveArgs(resolveRocketProfile(), { workflow: "research" })).toEqual(["research", "--json"]);
  });

  test("undeclared workflow is denied", async () => {
    const result = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "tools.rocket", input: { workflow: "swap" }, resources: [] },
      ctx(config()),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("capability_denied");
  });

  test("maps command success, acquisition health, evidence, and finding separately", async () => {
    const healthy = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "tools.rocket", input: { workflow: "positions" }, resources: [] },
      ctx(config()),
    );
    expect(healthy.ok).toBe(true);
    const out = healthy.output as Record<string, unknown>;
    const execution = out.execution as Record<string, unknown>;
    const acquisition = out.acquisition as Record<string, unknown>;
    const evidence = out.evidence as Record<string, unknown>;
    expect(execution.ok).toBe(true);
    expect(acquisition.status).toBe("healthy");
    expect(evidence.sufficiency).toBe("sufficient");
    expect(out.finding).toEqual({ thesis: "hold", workflow: "positions" });
    expect(out.projection).toMatchObject({
      executionOk: true,
      acquisition: "healthy",
      evidenceSufficiency: "sufficient",
      hasFinding: true,
    });
    expect(out).not.toHaveProperty("responsibility");
    expect(out).not.toHaveProperty("notification");
  });

  test("no finding after a healthy command does not count as sufficient evidence", async () => {
    const none = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "tools.rocket", input: { workflow: "macro" }, resources: [] },
      ctx(config()),
    );
    const evidence = (none.output as { evidence: { sufficiency: string }; finding: unknown }).evidence;
    expect(none.ok).toBe(true);
    expect(evidence.sufficiency).toBe("insufficient");
    expect((none.output as { finding: unknown }).finding).toBeNull();
  });

  test("unhealthy acquisition stays distinct from command failure", async () => {
    const result = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "tools.rocket", input: { workflow: "health" }, resources: [] },
      ctx(config()),
    );
    expect(result.ok).toBe(true);
    const out = result.output as { execution: { ok: boolean }; acquisition: { status: string }; evidence: { sufficiency: string } };
    expect(out.execution.ok).toBe(true);
    expect(out.acquisition.status).toBe("unavailable");
    expect(out.evidence.sufficiency).toBe("insufficient");
  });

  test("timeout kills the owned process", async () => {
    const result = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "tools.rocket", input: { workflow: "sleep" }, resources: [] },
      ctx({
        version: 2,
        ownerId: "o",
        defaultProjectId: "p",
        tools: { rocket: { bin: process.execPath, args: [fixture, "{workflow}", "--json"], workflows: ["sleep"], timeoutMs: 80 } },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("timeout");
    expect((result.output as { execution: { timedOut: boolean } }).execution.timedOut).toBe(true);
  });

  test("cancellation kills the owned process", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keli-tool-cancel-"));
    const db = new Database(join(dir, "state.sqlite"));
    migrate(db);
    const runId = createRun(db, "project:p");
    try {
      const pending = dispatchCapability(
        defaultRegistry,
        { capabilityId: "tools.rocket", input: { workflow: "sleep" }, resources: [] },
        ctx(
          { version: 2, ownerId: "o", defaultProjectId: "p", tools: { rocket: { bin: process.execPath, args: [fixture, "{workflow}", "--json"], workflows: ["sleep"], timeoutMs: 2000 } } },
          { db, runId, cancelEpoch: 0 },
        ),
      );
      await Bun.sleep(40);
      cancelRun(db, runId);
      const result = await pending;
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("cancelled");
    } finally {
      db.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("capabilities.lookup returns only allowlisted schemas", async () => {
    const denied = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "capabilities.lookup", input: { query: "files" }, resources: [] },
      { ...ctx(config()), allowedCapabilities: ["capabilities.lookup", "tools.rocket"] },
    );
    expect(denied.ok).toBe(true);
    expect((denied.output as { capabilities: Array<{ id: string }> }).capabilities).toEqual([]);

    const found = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "capabilities.lookup", input: { query: "rocket" }, resources: [] },
      { ...ctx(config()), allowedCapabilities: ["capabilities.lookup", "tools.rocket"] },
    );
    const caps = (found.output as { capabilities: Array<{ id: string; schema: { required?: string[] } }> }).capabilities;
    expect(caps.map(c => c.id)).toEqual(["tools.rocket"]);
    expect(caps[0]!.schema.required).toEqual(["workflow"]);
  });

  test("unknown research fields stay unknown rather than invented", () => {
    const mapped = projectResearchResult(
      { operational: { ok: true }, acquisition: { status: "healthy" }, research: { finding: null } },
      { ok: true, exitCode: 0, timedOut: false, cancelled: false, truncated: false, durationMs: 1 },
    );
    expect(mapped.evidence.sufficiency).toBe("insufficient");
    expect(mapped.evidence.freshness).toBeUndefined();
    expect(mapped.finding).toBeNull();
  });
});
