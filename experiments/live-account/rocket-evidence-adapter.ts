/** Optional live-test boundary adapter. No domain engine; no default Keli dependency on Rocket. */
const [bin, state, scratch] = process.argv.slice(2);
if (!bin || !state || !scratch) throw new Error("Usage: rocket-evidence-adapter.ts <rocket-bin> <private-portfolio-copy> <scratch-state-directory>");
const child = Bun.spawn([bin, "portfolio", "review", "--state", state, "--state-dir", scratch, "--json"], { stdin: "ignore", stdout: "pipe", stderr: "pipe" });
const timer = setTimeout(() => child.kill(), 25_000);
try {
  const [text, , exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (exit !== 0) throw new Error(`Rocket exited ${exit}`);
  const result = JSON.parse(text);
  if (result.schema_version !== 2) throw new Error("Unrecognized Rocket output schema");
  // This diagnostic adapter exposes declared blockers. It deliberately does not certify
  // domain findings or convert ACTION_REQUIRED / process success into sufficient evidence.
  console.log(JSON.stringify({
    operational: { ok: result.operational?.status === "HEALTHY" },
    research: { sufficient: "unknown", finding: null,
      coverage: { declaredStatus: result.status, reasons: result.reasons, warnings: result.warnings },
      effectiveTime: result.decision_time },
  }));
} finally { clearTimeout(timer); if (child.exitCode === null) child.kill(); }
