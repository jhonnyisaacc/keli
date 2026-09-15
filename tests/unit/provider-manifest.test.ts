import { describe, expect, test } from "bun:test";
import { listByCategory, listByStatus, manifestRow, resolveReadiness } from "../../src/integrations/manifest.ts";
import { catalogEntry, providerCatalog } from "../../src/integrations/catalog-provider.ts";
import { defaultConfig } from "../../src/state/config.ts";
import manifest from "../../src/integrations/provider-manifest.json";

describe("provider manifest", () => {
  test("protocol mapping keeps similar vendors on distinct adapters", () => {
    expect(manifestRow("grok")?.protocol).toBe("openai-compatible-http");
    expect(manifestRow("xai-oauth")?.protocol).toBe("oauth-external-cli");
    expect(manifestRow("xai-oauth")?.protocolNote).toContain("distinct from grok");
    expect(manifestRow("gemini")?.protocol).toBe("native-sdk");
    expect(manifestRow("vertex")?.protocol).toBe("cloud-sdk");
    expect(manifestRow("commandcode")?.protocol).toBe("openai-compatible-http");
    expect(manifestRow("commandcode-anthropic")?.protocol).toBe("anthropic-messages");
    expect(manifestRow("chatgpt")?.protocolNote).toContain("not Codex");
    expect(manifestRow("copilot-acp")?.status).toBe("excluded");
    expect(manifestRow("moa")?.status).toBe("excluded");
  });

  test("status comes from inventory plus config, never from file existence", () => {
    const anthropic = manifestRow("anthropic")!;
    expect(anthropic.status).toBe("catalogued");
    expect(resolveReadiness(anthropic)).toBe("catalogued");
    const configured = resolveReadiness(anthropic, {
      ...defaultConfig(),
      integrations: { anthropic: { enabled: true, settings: {}, credentialRef: { service: "keli/anthropic", id: "api-key" } } },
    });
    expect(configured).toBe("configured");
    const live = resolveReadiness(anthropic, {
      ...defaultConfig(),
      providers: { primary: { id: "anthropic", model: "claude-account" } },
      integrations: { anthropic: { enabled: true, settings: { model: "claude-account" }, credentialRef: { service: "keli/anthropic", id: "api-key" } } },
      setup: { liveChecked: { anthropic: { at: "2026-01-01T00:00:00.000Z", model: "claude-account" } } },
    });
    expect(live).toBe("live-verified");
    const stale = resolveReadiness(anthropic, {
      ...defaultConfig(),
      providers: { primary: { id: "anthropic", model: "other" } },
      integrations: { anthropic: { enabled: true, settings: { model: "other" } } },
      setup: { liveChecked: { anthropic: { at: "2026-01-01T00:00:00.000Z", model: "claude-account" } } },
    });
    expect(stale).toBe("configured");
    expect(resolveReadiness(manifestRow("moa")!, {
      ...defaultConfig(),
      integrations: { moa: { enabled: true, settings: { baseUrl: "http://127.0.0.1" } } },
    })).toBe("excluded");
  });

  test("listByCategory and listByStatus do not treat catalog membership as a live adapter", () => {
    const search = listByCategory("search");
    expect(search.some((row) => row.id === "search")).toBe(true);
    expect(search.every((row) => row.category === "search")).toBe(true);
    const blocked = listByStatus(defaultConfig(), "blocked");
    expect(blocked.some((row) => row.id === "honcho")).toBe(true);
    expect(blocked.every((row) => row.readiness === "blocked")).toBe(true);
    const catalogued = listByStatus(undefined, "catalogued");
    expect(catalogued.some((row) => row.id === "openrouter" && row.runtimeAdapter === "SdkModelProvider")).toBe(true);
    expect(catalogued.every((row) => row.readiness !== "live-verified")).toBe(true);
  });

  test("mechanical inference snapshot still constructs catalog entries without claiming live access", () => {
    expect(providerCatalog.some((row) => row.name === "anthropic")).toBe(true);
    expect(catalogEntry("anthropic")?.name).toBe("anthropic");
    expect(catalogEntry("grok")).toBeUndefined();
    expect(catalogEntry("moa")).toBeUndefined();
    const text = JSON.stringify(manifest);
    expect(text).not.toMatch(/\/(?:home|Users)\//);
    expect(manifest.attribution.hermes.pin).toMatch(/^[0-9a-f]{40}$/);
  });

  test("every inventory row has a status and a reason, and ids are unique", () => {
    const statuses = new Set(["catalogued", "fixture-verified", "blocked", "excluded"]);
    const ids = (manifest.providers as Array<{ id: string; status: string; protocolNote?: string; protocol?: string }>).map((row) => {
      expect(statuses.has(row.status)).toBe(true);
      if (row.status === "blocked" || row.status === "excluded") {
        expect(row.protocolNote || row.protocol).toBeTruthy();
      }
      return row.id;
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("generator matches the committed inventory and does not revive hermes-catalog.json", async () => {
    const { buildManifest } = await import("../../scripts/import-provider-manifest.ts");
    const built = buildManifest();
    const committed = manifest.providers as Array<{ id: string; status: string; runtimeAdapter: string; category: string }>;
    expect(built.providers.map((row) => row.id)).toEqual(committed.map((row) => row.id));
    for (const row of committed) {
      const got = built.providers.find((p) => p.id === row.id);
      expect(got?.status as string).toBe(row.status);
      expect(got?.runtimeAdapter).toBe(row.runtimeAdapter);
      expect(got?.category as string).toBe(row.category);
    }
    expect(built.providers.find((row) => row.id === "copilot-acp-delegate")?.status).toBe("blocked");
    expect(built.providers.find((row) => row.id === "documents-pdf")?.runtimeAdapter).toBe("documentsExtract");
    const generator = await Bun.file(new URL("../../scripts/import-provider-manifest.ts", import.meta.url)).text();
    expect(generator).not.toContain("src/integrations/hermes-catalog.json");
    expect(generator).not.toContain("import-hermes-catalog.py");
  });
});
