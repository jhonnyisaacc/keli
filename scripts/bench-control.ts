/** Gate prepare→finish overhead excluding provider. Target p95 ≤ 50ms (PRD §14). */

export {};

const SAMPLES = 24;

async function main() {
  const { createTestEnv } = await import("../tests/helpers/setup.ts");
  const { GateService } = await import("../src/core/gate.ts");
  const samples: number[] = [];

  for (let i = 0; i < SAMPLES; i++) {
    const env = await createTestEnv();
    env.behavior.reviseCodingDelegate("Rocket", "Codex", {
      actor: "owner",
      text: "Rocket changes use Codex",
      source: "user-correction",
      trusted: true,
    });
    const gate = new GateService(env.db, env.behavior);
    const start = performance.now();
    const prepared = gate.prepare("noop", `project:${env.rocketId}`, "coding.delegate");
    gate.finish(prepared.id, {
      id: prepared.id,
      scope: prepared.scope,
      key: prepared.key,
      revision: prepared.revision,
      delegate: "Codex",
    });
    samples.push(performance.now() - start);
    env.close();
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]!;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const report = [
    `# Control-plane timing`,
    "",
    `Samples: ${SAMPLES} (cold-ish; new temp state each observation)`,
    `Mean: ${mean.toFixed(2)} ms`,
    `p95: ${p95.toFixed(2)} ms`,
    `Target: p95 ≤ 50 ms (PRD §14)`,
    `Status: ${p95 <= 50 ? "pass" : "above target (record; do not tag on this alone)"}`,
    "",
  ].join("\n");
  await Bun.write("docs/evidence/TIMING.md", report + "\n");
  console.log(report);
}

await main();
