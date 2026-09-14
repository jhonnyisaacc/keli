#!/usr/bin/env bun
/**
 * Scripted structured-tool fixture. Labelled: not a live Rocket binary.
 * Emits ResearchResult-shaped JSON so Keli can map execution / acquisition / evidence / finding.
 */
export {};
const workflow = process.argv[2] ?? "";
const jsonFlag = process.argv.includes("--json");

if (!jsonFlag) {
  console.error("fixture requires --json");
  process.exit(2);
}

if (workflow === "sleep") {
  await Bun.sleep(4000);
}

const payloads: Record<string, Record<string, unknown>> = {
  research: {
    operational: { ok: true, health: "ok" },
    acquisition: { status: "healthy", freshness: "2026-09-13T09:00:00Z" },
    research: { sufficient: true, finding: { thesis: "hold", workflow }, coverage: { wallets: 1 } },
  },
  positions: {
    operational: { ok: true, health: "ok" },
    acquisition: { status: "healthy", freshness: "2026-09-13T09:00:00Z" },
    research: { sufficient: true, finding: { thesis: "hold", workflow }, coverage: { wallets: 1 } },
  },
  macro: {
    operational: { ok: true, health: "ok" },
    acquisition: { status: "healthy" },
    research: { sufficient: false, finding: null, coverage: { wallets: 1 } },
  },
  health: {
    operational: { ok: false, error: "rpc unavailable" },
    acquisition: { status: "unavailable", error: "rpc unavailable" },
    research: { sufficient: false, finding: null },
  },
  sleep: {
    operational: { ok: true },
    acquisition: { status: "healthy" },
    research: { sufficient: true, finding: { slept: true } },
  },
};

const payload = payloads[workflow] ?? payloads.research;
process.stdout.write(JSON.stringify({ workflow, ...payload }) + "\n");
