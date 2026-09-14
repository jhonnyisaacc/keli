import { credentialService, type CredentialSource } from "../credentials/source.ts";
import { KeliError } from "../core/errors.ts";
import type { KeliConfig } from "../state/config.ts";
import { fixtureUrlFor, type FixtureSlot } from "./env.ts";
import { listIntegrations, resolveProfileId } from "./registry.ts";
import type { IntegrationProfile, RoundTripResult } from "./types.ts";
import "./load.ts";

export type LiveProbeOutcome = "pass" | "fail" | "skipped" | "unverifiable";

export type LiveProbeLine = {
  id: string;
  kind: IntegrationProfile["kind"];
  required: boolean;
  configured: boolean;
  outcome: LiveProbeOutcome;
  detail: string;
  latencyMs?: number;
};

export type LiveProbeReport = {
  at: string;
  lines: LiveProbeLine[];
  required: string[];
  passed: number;
  failed: number;
  skipped: number;
  unverifiable: number;
  /** Green only when every required integration performed a real round trip successfully. */
  green: boolean;
};

/**
 * Required integrations come from the saved configuration: the primary provider, the chosen
 * transport, and any explicit `--require` list. Nothing is required by default so a bare
 * checkout is honest about what it cannot verify.
 */
export function requiredIntegrationIds(config: KeliConfig | null | undefined, extra: string[] = []): string[] {
  const ids = new Set<string>(extra.map((id) => resolveProfileId(id) ?? id));
  const primary = config?.providers?.primary?.id ?? config?.primaryModel;
  if (primary && primary !== "fixture") ids.add(resolveProfileId(primary) ?? primary);
  if (config?.setup?.transport && config.setup.transport !== "none") ids.add(config.setup.transport);
  if (config?.memory?.provider) ids.add(config.memory.provider);
  return [...ids];
}

export async function runLiveProbe(options: {
  config: KeliConfig | null;
  credentials?: CredentialSource;
  require?: string[];
  timeoutMs?: number;
  only?: string[];
}): Promise<LiveProbeReport> {
  const required = requiredIntegrationIds(options.config, options.require);
  const lines: LiveProbeLine[] = [];

  for (const profile of listIntegrations()) {
    if (options.only && !options.only.some((id) => (resolveProfileId(id) ?? id) === profile.id)) continue;
    const isRequired = required.includes(profile.id);
    const entry = options.config?.integrations?.[profile.id];
    const fixtureUrl = profile.fixtureKey ? fixtureUrlFor(profile.fixtureKey as FixtureSlot) : undefined;
    const settings = { ...(entry?.settings ?? {}) };
    const selectedModel = [options.config?.providers?.primary, ...(options.config?.providers?.fallback ?? [])].find((p) => p && resolveProfileId(p.id) === profile.id)?.model;
    if (selectedModel) settings.model = selectedModel;
    const configured = Boolean(entry?.enabled || settings.baseUrl || fixtureUrl || entry?.credentialRef);

    if (!configured) {
      lines.push({
        id: profile.id,
        kind: profile.kind,
        required: isRequired,
        configured: false,
        outcome: isRequired ? "fail" : "skipped",
        detail: isRequired ? "required but not configured" : "not configured",
      });
      continue;
    }

    if (!profile.roundTrip) {
      lines.push({
        id: profile.id,
        kind: profile.kind,
        required: isRequired,
        configured: true,
        outcome: isRequired ? "fail" : "unverifiable",
        detail: "profile defines no live round trip",
      });
      continue;
    }

    let credential: string | undefined;
    let credentialDetail = "";
    const ref =
      entry?.credentialRef ??
      (profile.auth.type !== "none" && profile.auth.type !== "external-cli"
        ? { id: profile.settings.find((s) => s.secret)?.key ?? "api-key", service: credentialService(profile.id) }
        : undefined);
    if (ref && options.credentials) {
      try {
        credential = (await options.credentials.get(ref)) ?? undefined;
        if (!credential && entry?.credentialRef) credentialDetail = "credential ref set but value missing";
      } catch (e) {
        credentialDetail =
          e instanceof KeliError && e.code === "secret_unavailable" ? "credential store locked" : String(e);
      }
    }

    let result: RoundTripResult;
    try {
      const { catalogEntry } = await import("./catalog-provider.ts");
      if (profile.kind === "model-provider" && catalogEntry(profile.id) && !fixtureUrl) {
        const { createModelProvider } = await import("../model/provider-factory.ts");
        const created = await createModelProvider({ config: options.config, explicitId: profile.id, credentials: options.credentials });
        const response = await created.provider.complete!([{ role: "user", content: 'Reply with exactly {"connected":true}' }], { responseFormat: "json_object", maxTokens: 128, timeoutMs: options.timeoutMs ?? 30_000 });
        let ok = false;
        try { ok = !response.error && JSON.parse(response.content!).connected === true; } catch { /* malformed */ }
        result = { ok, detail: ok ? `Model ${created.model} completed an inference request` : response.error ?? "Unexpected model response", failure: ok ? undefined : "invalid" };
      } else result = await profile.roundTrip({
        settings,
        credentialRef: entry?.credentialRef,
        fixtureUrl,
        needsReauth: entry?.status?.needsReauth,
        credential,
        credentialSource: options.credentials,
        timeoutMs: options.timeoutMs,
      });
    } catch (e) {
      result = { ok: false, detail: "Connection check failed; verify the model, endpoint and credential with keli setup provider", failure: e instanceof KeliError && e.code === "secret_unavailable" ? "auth" : "transport" };
    }
    lines.push({
      id: profile.id,
      kind: profile.kind,
      required: isRequired,
      configured: true,
      outcome: result.ok ? "pass" : "fail",
      detail: [result.detail, credentialDetail].filter(Boolean).join("; "),
      latencyMs: result.latencyMs,
    });
  }

  const passed = lines.filter((l) => l.outcome === "pass").length;
  const failed = lines.filter((l) => l.outcome === "fail").length;
  const skipped = lines.filter((l) => l.outcome === "skipped").length;
  const unverifiable = lines.filter((l) => l.outcome === "unverifiable").length;
  const green =
    failed === 0 && required.every((id) => lines.find((l) => l.id === id)?.outcome === "pass");
  return { at: new Date().toISOString(), lines, required, passed, failed, skipped, unverifiable, green };
}

export function renderLiveProbe(report: LiveProbeReport): string {
  const out = ["# Live integration probe", "", `At: ${report.at}`, "", `Required: ${report.required.join(", ") || "(none configured)"}`, ""];
  for (const line of report.lines) {
    const tag = line.outcome.toUpperCase();
    const req = line.required ? " [required]" : "";
    const latency = line.latencyMs != null ? ` ${line.latencyMs}ms` : "";
    out.push(`- ${line.id} (${line.kind})${req}: ${tag}${latency} — ${line.detail}`);
  }
  out.push("");
  out.push(
    `passed=${report.passed} failed=${report.failed} skipped=${report.skipped} unverifiable=${report.unverifiable} green=${report.green}`,
  );
  out.push("Skipped or unverifiable required integrations count as failures; optional skips are reported, never counted as passes.");
  return out.join("\n") + "\n";
}
