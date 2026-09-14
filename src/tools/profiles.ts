import type { CapabilityDescriptor } from "../capabilities/types.ts";
import type { KeliConfig } from "../state/config.ts";
import type { StructuredToolProfile } from "./types.ts";

export const ROCKET_CAPABILITY_ID = "tools.rocket";
export const ROCKET_PIN_WORKFLOWS = ["research", "positions", "macro", "health"] as const;

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT = 262_144;

export function rocketDescriptor(): CapabilityDescriptor {
  return {
    id: ROCKET_CAPABILITY_ID,
    version: "0.1.0",
    summary: "Run a configured Rocket research workflow and return structured evidence",
    actionClass: "read",
    resources: ["workflow"],
    schema: {
      type: "object",
      properties: { workflow: { type: "string" } },
      required: ["workflow"],
    },
  };
}

export function resolveRocketProfile(config?: KeliConfig | null, env: NodeJS.ProcessEnv = process.env): StructuredToolProfile {
  const rocket = config?.tools?.rocket;
  const workflows = rocket?.workflows?.length ? rocket.workflows : [...ROCKET_PIN_WORKFLOWS];
  return {
    id: ROCKET_CAPABILITY_ID,
    version: "0.1.0",
    summary: rocketDescriptor().summary,
    actionClass: "read",
    executable: rocket?.bin || env.ROCKET_BIN || "",
    args: rocket?.args?.length ? rocket.args : ["{workflow}", "--json"],
    workflows,
    timeoutMs: rocket?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxOutputBytes: rocket?.maxOutputBytes ?? DEFAULT_MAX_OUTPUT,
    stateEnvVar: "ROCKET_STATE_DIR",
    stateDir: rocket?.stateDir || env.ROCKET_STATE_DIR,
    testedRevision: rocket?.revision,
  };
}

export function resolveExternalProfiles(config?: KeliConfig | null, env: NodeJS.ProcessEnv = process.env): StructuredToolProfile[] {
  const extras = config?.tools?.external ?? [];
  return extras.filter((tool): tool is typeof tool & { id: string } => Boolean(tool.id)).map((tool) => ({
    id: tool.id.startsWith("tools.") ? tool.id : `tools.${tool.id}`,
    version: tool.version ?? "0.1.0",
    summary: tool.summary ?? `Configured structured tool ${tool.id}`,
    actionClass: "read",
    executable: tool.bin || (tool.binEnv ? env[tool.binEnv] ?? "" : ""),
    args: tool.args ?? ["{workflow}", "--json"],
    workflows: tool.workflows ?? [],
    timeoutMs: tool.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxOutputBytes: tool.maxOutputBytes ?? DEFAULT_MAX_OUTPUT,
    stateEnvVar: tool.stateEnvVar,
    stateDir: tool.stateDir || (tool.stateEnvVar ? env[tool.stateEnvVar] : undefined),
    testedRevision: tool.revision,
  }));
}

export function profileFor(
  capabilityId: string,
  config?: KeliConfig | null,
  env: NodeJS.ProcessEnv = process.env,
): StructuredToolProfile | undefined {
  if (capabilityId === ROCKET_CAPABILITY_ID) return resolveRocketProfile(config, env);
  return resolveExternalProfiles(config, env).find((p) => p.id === capabilityId);
}

export function structuredToolDescriptors(config?: KeliConfig | null): CapabilityDescriptor[] {
  const extras = (config?.tools?.external ?? []).filter((tool): tool is typeof tool & { id: string } => Boolean(tool.id)).map((tool) => {
    const id = tool.id.startsWith("tools.") ? tool.id : `tools.${tool.id}`;
    return {
      id,
      version: tool.version ?? "0.1.0",
      summary: tool.summary ?? `Configured structured tool ${tool.id}`,
      actionClass: "read" as const,
      resources: ["workflow"],
      schema: {
        type: "object",
        properties: { workflow: { type: "string" } },
        required: ["workflow"],
      },
    };
  });
  return [rocketDescriptor(), ...extras];
}
