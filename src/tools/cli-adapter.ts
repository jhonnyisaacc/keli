import { existsSync } from "node:fs";
import type { CapabilityResult } from "../capabilities/types.ts";
import { KeliError } from "../core/errors.ts";
import { assertNotCancelled } from "../core/run-control.ts";
import type { DispatchContext } from "../execution/dispatch-context.ts";
import { compactProjection, projectResearchResult } from "./research-result.ts";
import type { StructuredToolOutput, StructuredToolProfile, ToolExecutionStatus } from "./types.ts";

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
const WORKFLOW_RE = /^[a-z][a-z0-9._-]*$/;

function integrationGap(capabilityId: string, message: string): CapabilityResult {
  return {
    capabilityId,
    ok: false,
    error: { code: "integration_gap", message, retryable: false },
    output: {
      integrationGap: message,
      execution: { ok: false, exitCode: null, timedOut: false, cancelled: false, truncated: false, durationMs: 0 },
    },
  };
}

export function resolveArgs(profile: StructuredToolProfile, input: Record<string, unknown>): string[] {
  const workflow = typeof input.workflow === "string" ? input.workflow.trim() : "";
  if (!WORKFLOW_RE.test(workflow)) throw new KeliError("workflow must be a declared lowercase token", "invalid_request");
  if (!profile.workflows.includes(workflow)) {
    throw new KeliError(`workflow ${workflow} is not approved for ${profile.id}`, "capability_denied");
  }
  const allowed = { workflow };
  return profile.args.map((part) =>
    part.replace(PLACEHOLDER, (_, name: string) => {
      if (!(name in allowed)) throw new KeliError(`argument placeholder {${name}} is not declared`, "invalid_request");
      return allowed[name as keyof typeof allowed];
    }),
  );
}

async function readLimited(stream: ReadableStream<Uint8Array> | undefined, max: number): Promise<{ text: string; truncated: boolean }> {
  if (!stream) return { text: "", truncated: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (size + value.byteLength > max) {
      chunks.push(value.subarray(0, Math.max(0, max - size)));
      size = max;
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  return { text: Buffer.concat(chunks).toString("utf8"), truncated };
}

export async function runStructuredTool(
  profile: StructuredToolProfile,
  input: Record<string, unknown>,
  ctx: DispatchContext,
): Promise<CapabilityResult> {
  if (!profile.executable) {
    return integrationGap(profile.id, `${profile.id} executable is not configured in its tool profile`);
  }
  if (!existsSync(profile.executable)) {
    return integrationGap(profile.id, `${profile.id} executable is missing: ${profile.executable}`);
  }

  let args: string[];
  try {
    args = resolveArgs(profile, input);
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: profile.id,
      ok: false,
      error: { code: keli?.code ?? "invalid_request", message: keli?.message ?? String(e) },
    };
  }

  const env: Record<string, string> = {};
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.HOME) env.HOME = process.env.HOME;
  if (process.env.LANG) env.LANG = process.env.LANG;
  if (profile.stateEnvVar && profile.stateDir) env[profile.stateEnvVar] = profile.stateDir;

  const started = performance.now();
  const proc = Bun.spawn([profile.executable, ...args], {
    cwd: ctx.cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });

  let timedOut = false;
  let cancelled = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, profile.timeoutMs);

  const cancelWatch = ctx.run
    ? setInterval(() => {
        try {
          assertNotCancelled(ctx.run!.db, ctx.run!.runId, ctx.run!.cancelEpoch);
        } catch {
          cancelled = true;
          proc.kill();
        }
      }, 50)
    : undefined;

  try {
    const [stdout, stderr] = await Promise.all([
      readLimited(proc.stdout, profile.maxOutputBytes),
      readLimited(proc.stderr, Math.min(16_384, profile.maxOutputBytes)),
    ]);
    const exitCode = await proc.exited;
    const durationMs = Math.round(performance.now() - started);
    const truncated = stdout.truncated || stderr.truncated;
    if (truncated && !timedOut && !cancelled) proc.kill();

    const execution: ToolExecutionStatus = {
      ok: exitCode === 0 && !timedOut && !cancelled && !truncated,
      exitCode,
      timedOut,
      cancelled,
      truncated,
      durationMs,
    };

    let raw: unknown = stdout.text;
    try {
      raw = JSON.parse(stdout.text) as unknown;
    } catch {
      raw = { parseError: "stdout was not JSON", stdout: stdout.text.slice(0, 2000), stderr: stderr.text.slice(0, 1000) };
    }

    const evidence = projectResearchResult(raw, execution);
    if (!profile.executable) evidence.integrationGap = `${profile.id} executable is not configured`;
    const output: StructuredToolOutput = {
      ...evidence,
      sourceId: `tool:${profile.id}:${String(input.workflow)}`,
      workflow: String(input.workflow),
      profileId: profile.id,
      testedRevision: profile.testedRevision,
      projection: compactProjection(evidence, String(input.workflow), profile.id),
      raw,
    };

    return {
      capabilityId: profile.id,
      ok: !cancelled && !timedOut,
      output,
      error: cancelled
        ? { code: "cancelled", message: "structured tool cancelled" }
        : timedOut
          ? { code: "timeout", message: `${profile.id} exceeded ${profile.timeoutMs}ms` }
          : undefined,
    };
  } finally {
    clearTimeout(timer);
    if (cancelWatch) clearInterval(cancelWatch);
    if (proc.exitCode === null && proc.signalCode === null) proc.kill();
  }
}
