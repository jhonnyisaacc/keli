import { describe, expect, test } from "bun:test";
import { discoverIntegrations } from "../../src/integrations/catalog.ts";
import { listIntegrations, getIntegration, probeIntegration } from "../../src/integrations/registry.ts";
import { resolveModelProvider, tryResolveIntegration } from "../../src/integrations/resolve.ts";
import { fixtureUrlFor } from "../../src/integrations/env.ts";
import { listProviders, resolveProvider } from "../../src/model/provider-registry.ts";
import "../../src/integrations/load.ts";

describe("integration registry", () => {
  test("bundled profiles register by kind", () => {
    const models = listIntegrations("model-provider");
    expect(models.some((p) => p.id === "fixture")).toBe(true);
    expect(models.some((p) => p.id === "openai-compatible")).toBe(true);
    expect(models.some((p) => p.id === "grok")).toBe(true);
    expect(getIntegration("xai")?.id).toBe("grok");
    expect(listIntegrations("transport").map((p) => p.id).sort()).toEqual(["discord", "telegram"]);
    expect(listIntegrations("memory").some((p) => p.id === "honcho")).toBe(true);
  });

  test("discover never installs", () => {
    const found = discoverIntegrations("discord");
    expect(found.installed).toBe(false);
    expect(found.matches.length).toBeGreaterThan(0);
    const unknown = discoverIntegrations("not-a-real-vendor-xyz");
    expect(unknown.matches.length).toBe(0);
    expect(unknown.message).toContain("nothing installed");
  });

  test("probe reports how to configure", async () => {
    const status = await probeIntegration("openai-compatible", { settings: {} });
    expect(status.howToConfigure.length).toBeGreaterThan(0);
    expect(status.configured).toBe(Boolean(fixtureUrlFor("provider")));
  });

  test("provider registry facade stays compatible", () => {
    const providers = listProviders();
    const claude = providers.find((p) => p.id === "claude-code");
    expect(claude?.available).toBe(false);
    expect(claude?.reason).toContain("unavailable");
  });

  test("resolver prefers fixture-env when no config", () => {
    const prev = process.env.KELI_FIXTURE_URL;
    const prevId = process.env.KELI_PROVIDER_ID;
    process.env.KELI_FIXTURE_URL = "http://127.0.0.1:9";
    delete process.env.KELI_PROVIDER_ID;
    const resolved = resolveModelProvider();
    expect(resolved.profile.id).toBe("fixture");
    expect(resolved.source).toBe("fixture-env");
    if (prev) process.env.KELI_FIXTURE_URL = prev;
    else delete process.env.KELI_FIXTURE_URL;
    if (prevId) process.env.KELI_PROVIDER_ID = prevId;
  });

  test("tryResolve unknown is null", () => {
    expect(tryResolveIntegration("search", { explicitId: "nope-xyz" })).toBeNull();
  });

  test("resolveProvider fixture still constructs", () => {
    const prev = process.env.KELI_FIXTURE_URL;
    process.env.KELI_FIXTURE_URL = "http://127.0.0.1:9";
    const provider = resolveProvider("fixture");
    expect(provider).toBeDefined();
    if (prev) process.env.KELI_FIXTURE_URL = prev;
    else delete process.env.KELI_FIXTURE_URL;
  });
});
