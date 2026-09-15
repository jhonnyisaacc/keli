/**
 * Cross-domain acceptance scenarios. Labelled: scripted provider + fixture CLI, not live
 * Rocket or a live model. All three use the same responsibility controller.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { ConversationLoop } from "../../src/conversation/loop.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { CapabilityGate } from "../../src/core/capability-gate.ts";
import { getRun } from "../../src/core/run-control.ts";
import { indexCollection } from "../../src/sources/index.ts";
import { createSourceReader } from "../../src/sources/reader.ts";
import type { KeliConfig } from "../../src/state/config.ts";
import { migrate } from "../../src/state/migrate.ts";
import { createOwner, createProject } from "../../src/state/repos.ts";
import { tickWatches } from "../../src/watches/heartbeat.ts";
import { investigationOf, listResearchOccurrences } from "../../src/watches/occurrences.ts";
import { upsertWatch } from "../../src/watches/store.ts";
import { ScriptedChatModel, scriptedFactory, type ScriptedStep } from "../fixtures/scripted-model.ts";
import type { WatchDefinition } from "../../src/watches/types.ts";

const fixture = fileURLToPath(new URL("../fixtures/structured-tool-cli.ts", import.meta.url));
const scope = "project:p";
const WORKFLOWS = ["research", "positions", "macro", "macro-shift", "health", "diag-wrong", "logs"];

let dir: string, db: Database, behavior: BehaviorService, gate: CapabilityGate;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "keli-scenarios-"));
  db = new Database(join(dir, "state.sqlite"));
  migrate(db);
  createOwner(db, "owner");
  createProject(db, "p", "owner", "research", [dir]);
  behavior = new BehaviorService(db, "owner");
  gate = new CapabilityGate(db, defaultRegistry, dir, "owner");
});
afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

function config(): KeliConfig {
  return {
    version: 2,
    ownerId: "owner",
    defaultProjectId: "p",
    tools: {
      rocket: {
        bin: process.execPath,
        args: [fixture, "{workflow}", "--json"],
        workflows: WORKFLOWS,
        revision: "fixture",
        timeoutMs: 2000,
      },
    },
  };
}

/** Before every scripted tick in this file (2026-09-15..17). Wall-clock create times make `every:1s` due-ness fail. */
const SCENARIO_CREATED_AT = "2026-09-01T00:00:00.000Z";

function activate(definition: WatchDefinition) {
  return upsertWatch(db, {
    ownerId: "owner",
    scope,
    status: "active",
    definition,
    createdAt: SCENARIO_CREATED_AT,
  }).watch;
}

function loop(steps: ScriptedStep[]) {
  const model = new ScriptedChatModel(steps);
  return {
    model,
    loop: new ConversationLoop({
      db,
      behavior,
      capabilityGate: gate,
      registry: defaultRegistry,
      policy: { readableRoots: [dir], writableRoots: [dir] },
      sources: createSourceReader(db),
      model: scriptedFactory(model),
      config: config(),
      options: { retryBaseMs: 0 },
    }),
  };
}

async function tick(at: string, steps: ScriptedStep[]) {
  const l = loop(steps);
  const result = await tickWatches(db, {
    ownerId: "owner",
    stateDir: dir,
    behavior,
    loop: l.loop,
    sources: createSourceReader(db),
  }, new Date(at));
  return { ...l, result };
}

function answerFromTool(workflow: string, claim: string, subject = "portfolio"): ScriptedStep {
  return (messages) => {
    const last = messages.at(-1)?.content ?? "";
    const payload = JSON.parse(last.replace(/^Tool result for tools\.rocket:\s*/, ""));
    const quote = JSON.stringify(payload.output.projection ?? payload.output.finding);
    const id = `tool:tools.rocket:${workflow}`;
    return {
      type: "answer",
      text: claim,
      citations: [{ sourceId: id, quote }],
      attributions: [{ subject, claim, sourceIds: [id] }],
    };
  };
}

describe("cross-domain responsibility scenarios (scripted, fixture-verified)", () => {
  test("portfolio: remembered holdings, no-finding wait, later interpretation change, no orders", async () => {
    const w = activate({
      name: "portfolio-daily",
      kind: "responsibility",
      trigger: { schedule: "daily:09:00", target: "portfolio-daily" },
      budget: { requestsMax: 40, toolCallsMax: 20 },
      evidence: {
        question: "Maintain a current investment assessment of the configured wallet",
        autonomy: true,
        capabilities: ["tools.rocket"],
        review: "scheduled",
        constraints: "Paper options only. No signing, orders, swaps, or approvals.",
        completion: "supported assessment or explicit blocker",
      },
      notify: { policy: "daily-brief" },
    });

    const day1 = await tick("2026-09-15T09:00:00.000Z", [
      { type: "tool_call", capability: "capabilities.lookup", input: { query: "rocket" } },
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } },
      answerFromTool("positions", "Hold the current book"),
    ]);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("verified");
    expect(day1.model.calls.length).toBe(3);

    const noFinding = {
      type: "answer" as const,
      text: "Macro is silent, so rotate the book",
      citations: [{ sourceId: "tool:tools.rocket:macro", quote: "nothing" }],
      attributions: [{ subject: "portfolio", claim: "rotate", sourceIds: ["tool:tools.rocket:macro"] }],
    };
    const day2 = await tick("2026-09-16T09:00:00.000Z", [
      (messages) => {
        const blob = messages.map(m => m.content).join("\n");
        expect(blob).toContain("Hold the current book");
        expect(blob).toContain("No signing, orders, swaps, or approvals");
        return { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } };
      },
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "macro" } },
      noFinding,
      noFinding,
    ]);
    const waiting = listResearchOccurrences(db, w.id).find(o => o.fingerprint === "review:daily:2026-09-16");
    expect(waiting?.status).toBe("waiting_for_evidence");
    expect(day2.model.calls.length).toBe(4);

    const day3 = await tick("2026-09-17T09:00:00.000Z", [
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "swap" } },
      (messages) => {
        expect(messages.at(-1)!.content).toMatch(/capability_denied|not approved/);
        return { type: "tool_call", capability: "tools.rocket", input: { workflow: "positions" } };
      },
      { type: "tool_call", capability: "tools.rocket", input: { workflow: "macro-shift" } },
      answerFromTool("macro-shift", "Same holdings; interpret as risk-off until coverage changes"),
    ]);
    const latest = listResearchOccurrences(db, w.id)[0]!;
    expect(latest.status).toBe("verified");
    expect(JSON.parse(latest.result_json ?? "{}").attributions[0].claim).toContain("risk-off");
    expect(day3.model.calls.length).toBe(4);
    expect((db.query("SELECT COUNT(*) n FROM outbox_messages").get() as { n: number }).n).toBeGreaterThanOrEqual(2);
  });

  test("Augustine/Shaul: same controller with sources, resume, and no cross-project leak", async () => {
    const augustine = join(dir, "augustine");
    await mkdir(augustine, { recursive: true });
    await writeFile(join(augustine, "a.md"), "Augustine interprets the passage.");
    await indexCollection(db, { id: "augustine", path: augustine });
    createProject(db, "other", "owner", "other", [dir]);
    behavior.reviseRule(
      { scope, key: "research.requiredCollections", value: "shaul" },
      { actor: "owner", text: "Also require Shaul", source: "user-correction", trusted: true },
    );

    const w = activate({
      name: "augustine-shaul",
      kind: "responsibility",
      trigger: { schedule: "every:1s", target: "augustine-shaul" },
      budget: { requestsMax: 40, toolCallsMax: 20 },
      evidence: {
        question: "Compare Augustine and Shaul",
        autonomy: true,
        review: "event",
        requiredCollections: ["augustine", "shaul"],
        requiredSubjects: ["Augustine", "Shaul"],
        capabilities: ["sources.search", "sources.read"],
      },
    });

    const first = await tick("2026-09-15T00:00:02.000Z", [
      { type: "tool_call", capability: "sources.read", input: { sourceId: "augustine:a.md" } },
      { type: "missing_evidence", text: "Shaul is absent", needed: ["shaul"] },
    ]);
    expect(listResearchOccurrences(db, w.id)[0]!.status).toBe("waiting_for_evidence");
    expect(first.model.calls.length).toBe(2);
    expect((await tick("2026-09-15T00:00:04.000Z", [])).model.calls.length).toBe(0);

    const shaul = join(dir, "shaul");
    await mkdir(shaul, { recursive: true });
    await writeFile(join(shaul, "s.md"), "Shaul disagrees with that interpretation.");
    await indexCollection(db, { id: "shaul", path: shaul });

    const second = await tick("2026-09-15T00:00:06.000Z", [
      { type: "tool_call", capability: "sources.read", input: { sourceId: "shaul:s.md" } },
      {
        type: "answer",
        text: "Their interpretations differ.",
        citations: [
          { sourceId: "augustine:a.md", quote: "Augustine interprets the passage." },
          { sourceId: "shaul:s.md", quote: "Shaul disagrees with that interpretation." },
        ],
        attributions: [
          { subject: "Augustine", claim: "interprets", sourceIds: ["augustine:a.md"] },
          { subject: "Shaul", claim: "disagrees", sourceIds: ["shaul:s.md"] },
        ],
      },
    ]);
    const rows = listResearchOccurrences(db, w.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("verified");
    expect(second.result.outcomes[0]!.outcomeKind).toBe("answer");
    expect(behavior.listRulesByPrefix("project:other", "research.")).toEqual([]);
  });

  test("maintenance: discover tool, reject write, challenge first diagnostic, verify blocker-free diagnosis", async () => {
    const w = activate({
      name: "maintenance-triage",
      kind: "responsibility",
      trigger: { schedule: "every:1s", target: "maintenance-triage" },
      budget: { requestsMax: 40, toolCallsMax: 20 },
      evidence: {
        question: "Diagnose the failing worker from approved read-only tools",
        autonomy: true,
        review: "event",
        capabilities: ["tools.rocket"],
        constraints: "No edits or deploy",
        completion: "verified diagnosis or concrete blocker",
      },
    });

    const run = await tick("2026-09-15T00:00:02.000Z", [
      { type: "tool_call", capability: "capabilities.lookup", input: { query: "rocket" } },
      { type: "tool_call", capability: "files.write", input: { path: "fix.sh", content: "deploy" } },
      (messages) => {
        expect(messages.at(-1)!.content).toMatch(/not approved for this responsibility|not allowed/);
        return { type: "tool_call", capability: "tools.rocket", input: { workflow: "diag-wrong" } };
      },
      (messages) => {
        expect(messages.at(-1)!.content).toContain("disk-full");
        return { type: "tool_call", capability: "tools.rocket", input: { workflow: "logs" } };
      },
      answerFromTool("logs", "Stale lock; restart the worker. No deploy.", "maintenance"),
    ]);
    const o = listResearchOccurrences(db, w.id)[0]!;
    expect(o.status).toBe("verified");
    expect(JSON.parse(o.result_json ?? "{}").text).toContain("No deploy");
    const attempts = investigationOf(o).attempts;
    expect(attempts.some(a => a.capability === "files.write" && !a.ok)).toBe(true);
    expect(attempts.filter(a => a.capability === "tools.rocket" && a.ok).length).toBe(2);
    expect(getRun(db, o.run_id)!.tool_calls_used).toBeGreaterThanOrEqual(4);
    expect(run.model.calls.length).toBe(5);
  });
});

describe("responsibility budget exhaustion (live regression)", () => {
  test("terminalizes exhausted work; same slot stays idle and next slot gets its own budget", async () => {
    const w = activate({ name: "bounded-review", kind: "responsibility",
      trigger: { schedule: "daily:09:00", target: "bounded-review" },
      budget: { requestsMax: 1, toolCallsMax: 1 },
      evidence: { question: "Investigate with approved tools", autonomy: true, capabilities: ["tools.rocket"], review: "scheduled" },
      notify: { policy: "daily-brief" },
    });
    const step: ScriptedStep = { type: "tool_call", capability: "capabilities.lookup", input: { query: "rocket" } };
    const first = await tick("2026-09-15T09:00:00.000Z", [step]);
    const initial = listResearchOccurrences(db, w.id)[0]!;
    expect(initial.status).toBe("failed");
    expect(getRun(db, initial.run_id)?.status).toBe("failed");
    expect(first.model.calls.length).toBe(1);
    expect((await tick("2026-09-15T09:00:00.000Z", [])).model.calls.length).toBe(0);
    const next = await tick("2026-09-16T09:00:00.000Z", [step]);
    expect(next.model.calls.length).toBe(1);
    const rows = listResearchOccurrences(db, w.id);
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.status === "failed")).toBe(true);
    expect(rows[0]!.run_id).not.toBe(rows[1]!.run_id);
  });
});

test("configured external tools are discoverable only within their app and approval list", async () => {
  const { createConversationApp } = await import("../../src/conversation/app.ts");
  const cfg = { ...config(), tools: { external: [{ id: "tools.example-read", bin: process.execPath, args: [fixture, "{workflow}", "--json"], workflows: ["research"], summary: "Example read-only investigation" }] } };
  const app = createConversationApp({ db, behavior, config: cfg, stateDir: dir, ownerId: "owner", project: { id: "p", name: "research", resourceRoots: [dir] } });
  const lookup = async (allowedCapabilities: string[]) => app.capabilityGate.run({ capabilityId: "capabilities.lookup", input: { query: "example-read" }, resources: [] }, app.policy, scope, undefined, { config: cfg, allowedCapabilities });
  const approved = await lookup(["tools.example-read"]);
  expect((approved.result.output as { capabilities: Array<{ id: string }> }).capabilities.map(c => c.id)).toEqual(["tools.example-read"]);
  const descriptor = (approved.result.output as { capabilities: Array<{ schema: { properties: { workflow: { enum: string[] } } } }> }).capabilities[0]!;
  expect(descriptor.schema.properties.workflow.enum).toEqual(["research"]);
  const unapproved = await lookup([]);
  expect((unapproved.result.output as { capabilities: unknown[] }).capabilities).toEqual([]);
  expect(defaultRegistry.get("tools.example-read")).toBeUndefined();
});
