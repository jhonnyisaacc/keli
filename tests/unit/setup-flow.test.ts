import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSetup } from "../../src/setup/wizard.ts";
import { createScriptedWizardIo } from "../../src/setup/io.ts";
import { moreModelProviders, providersForCategory, SETUP_CATEGORIES, setupBadge } from "../../src/setup/categories.ts";
import { readConfig, upsertIntegration, writeConfig, type KeliConfig } from "../../src/state/config.ts";
import { defaultConfig } from "../../src/state/config.ts";
import { initializeState } from "../../src/state/init.ts";
import { syncIntegrationFromDisk } from "../../src/setup/interactive.ts";
import { manifestRow } from "../../src/integrations/manifest.ts";
import { FIRST_USE_PROVIDERS } from "../../src/integrations/first-use.ts";
import "../../src/integrations/load.ts";

describe("selection-first setup", () => {
  test("fixture provider is blocked unless explicitly allowed", () => {
    const fixture = manifestRow("fixture")!;
    expect(setupBadge(fixture, defaultConfig(), false)).toBe("blocked");
    expect(setupBadge(fixture, defaultConfig(), true)).toBe("fixture only");
    const models = SETUP_CATEGORIES.find((c) => c.id === "models")!;
    expect(providersForCategory(models, defaultConfig(), false).some((row) => row.id === "fixture")).toBe(false);
    expect(providersForCategory(models, defaultConfig(), true).some((row) => row.id === "chatgpt")).toBe(true);
  });

  test("numbered search alias configures a generic JSON endpoint", async () => {
    const lines: string[] = [];
    const io = createScriptedWizardIo(["personal", "2", "https://search.example/v1"], lines);
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-select-"));
    const result = await runSetup({
      stateDir,
      io,
      nonInteractive: false,
      section: "search",
      skipTransportTest: true,
      skipCalibration: true,
    });
    expect(result.searchConnected).toBe(true);
    const config = await readConfig(stateDir);
    expect(config?.integrations?.search?.settings.baseUrl).toBe("https://search.example/v1");
    expect(config?.providers?.primary?.id).not.toBe("fixture");
    expect(lines.some((line) => line.includes("Select a category"))).toBe(false);
    expect(lines.some((line) => line.includes("Generic JSON") || line.includes("Search backends"))).toBe(true);
    await rm(stateDir, { recursive: true, force: true });
  });

  test("non-interactive does not imply fixture without an explicit choice", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-nofixture-"));
    const result = await runSetup({
      stateDir,
      nonInteractive: true,
      transport: "none",
      skipCalibration: true,
      skipTransportTest: true,
      minimal: true,
    });
    expect(result.providerConnected).toBe(false);
    const config = await readConfig(stateDir);
    expect(config?.providers?.primary?.id).not.toBe("fixture");
    await rm(stateDir, { recursive: true, force: true });
  });

  test("browser, documents, and speech selections persist and are probed", async () => {
    const browser = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        return Response.json({ ok: true });
      },
    });
    const lines: string[] = [];
    const endpoint = `http://127.0.0.1:${browser.port}`;
    const io = createScriptedWizardIo(
      ["personal", "3", "2", endpoint, "y", "4", "1", "", "y", "5", "1", endpoint, "n"],
      lines,
    );
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-modal-"));
    await runSetup({
      stateDir,
      io,
      nonInteractive: false,
      section: "advanced",
      skipTransportTest: true,
      skipCalibration: true,
    });
    const config = await readConfig(stateDir);
    expect(config?.integrations?.["browser-cdp"]?.settings.url).toBe(endpoint);
    expect(config?.browser?.primary).toBe("cdp");
    expect(config?.integrations?.["documents-pdf"]?.enabled).toBe(true);
    expect(config?.integrations?.["speech-transcribe"]?.settings.baseUrl).toBe(endpoint);
    expect(config?.providers?.primary?.id).not.toBe("fixture");
    expect(lines.some((line) => line.includes("Connected:") || line.includes("Not connected:"))).toBe(true);
    browser.stop(true);
    await rm(stateDir, { recursive: true, force: true });
  });

  test("Chat/Models shows a recommended shortlist then More providers", async () => {
    const models = SETUP_CATEGORIES.find((c) => c.id === "models")!;
    const shortlist = providersForCategory(models, defaultConfig(), false);
    const more = moreModelProviders(false);
    expect(shortlist.map((row) => row.id)).toEqual([...FIRST_USE_PROVIDERS]);
    expect(shortlist.length).toBeLessThanOrEqual(4);
    expect(more.length).toBeGreaterThan(10);
    expect(more.some((row) => FIRST_USE_PROVIDERS.includes(row.id as (typeof FIRST_USE_PROVIDERS)[number]))).toBe(false);

    const lines: string[] = [];
    const io = createScriptedWizardIo(["personal", "5", "0"], lines);
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-shortlist-"));
    await runSetup({
      stateDir,
      io,
      nonInteractive: false,
      skipTransportTest: true,
      skipCalibration: true,
    });
    expect(lines.some((line) => line.includes("Recommended"))).toBe(true);
    expect(lines.some((line) => line.includes("More providers"))).toBe(true);
    expect(lines.some((line) => line.includes("Select a category"))).toBe(false);
    const moreHeader = lines.indexOf("More providers");
    expect(moreHeader).toBeGreaterThan(0);
    expect(lines.slice(moreHeader).some((line) => /^1\. /.test(line))).toBe(true);
    await rm(stateDir, { recursive: true, force: true });
  });

  test("syncs a newly written credentialRef onto the in-memory config before probe", async () => {
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-cred-"));
    const init = await initializeState(stateDir);
    const config: KeliConfig = {
      ...defaultConfig(),
      ownerId: init.ownerId,
      defaultProjectId: init.projectId,
      integrations: {
        "speech-transcribe": { enabled: true, settings: { baseUrl: "http://127.0.0.1:9" } },
      },
    };
    await writeConfig(config, stateDir);
    await upsertIntegration(
      "speech-transcribe",
      {
        enabled: true,
        settings: { baseUrl: "http://127.0.0.1:9" },
        credentialRef: { id: "api-key", service: "keli/speech-transcribe" },
      },
      stateDir,
    );
    expect(config.integrations?.["speech-transcribe"]?.credentialRef).toBeUndefined();
    await syncIntegrationFromDisk(config, stateDir, "speech-transcribe");
    expect(config.integrations?.["speech-transcribe"]?.credentialRef).toEqual({
      id: "api-key",
      service: "keli/speech-transcribe",
    });
    await rm(stateDir, { recursive: true, force: true });
  });

  test("bootstrap connects openai-compatible with a discovered default model", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req) {
        const path = new URL(req.url).pathname;
        if (path.endsWith("/models")) return Response.json({ data: [{ id: "local-discovered" }] });
        return new Response("no", { status: 404 });
      },
    });
    const lines: string[] = [];
    const io = createScriptedWizardIo(["personal", "2", `http://127.0.0.1:${server.port}/v1`], lines);
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-bootstrap-"));
    await runSetup({
      stateDir,
      io,
      nonInteractive: false,
      skipTransportTest: true,
      skipCalibration: true,
    });
    const config = await readConfig(stateDir);
    expect(config?.providers?.primary?.id).toBe("openai-compatible");
    expect(config?.integrations?.["openai-compatible"]?.settings.model).toBe("local-discovered");
    expect(config?.integrations?.["openai-compatible"]?.settings.keyless).toBe("true");
    expect(lines.some((line) => line.includes("Using default model local-discovered"))).toBe(true);
    expect(lines.some((line) => line.includes("Select a category"))).toBe(false);
    expect(lines.some((line) => /Model \[/.test(line))).toBe(false);
    server.stop(true);
    await rm(stateDir, { recursive: true, force: true });
  });
});
