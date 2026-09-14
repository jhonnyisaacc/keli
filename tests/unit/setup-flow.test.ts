import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSetup } from "../../src/setup/wizard.ts";
import { createScriptedWizardIo } from "../../src/setup/io.ts";
import { providersForCategory, SETUP_CATEGORIES, setupBadge } from "../../src/setup/categories.ts";
import { readConfig } from "../../src/state/config.ts";
import { defaultConfig } from "../../src/state/config.ts";
import { manifestRow } from "../../src/integrations/manifest.ts";
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

  test("numbered categories configure search without typing internal ids", async () => {
    const lines: string[] = [];
    const io = createScriptedWizardIo(["personal", "2", "1", "https://search.example/v1", "n"], lines);
    const stateDir = await mkdtemp(join(tmpdir(), "keli-setup-select-"));
    const result = await runSetup({
      stateDir,
      io,
      nonInteractive: false,
      minimal: true,
      skipTransportTest: true,
      skipCalibration: true,
    });
    expect(result.searchConnected).toBe(true);
    const config = await readConfig(stateDir);
    expect(config?.integrations?.search?.settings.baseUrl).toBe("https://search.example/v1");
    expect(config?.providers?.primary?.id).not.toBe("fixture");
    expect(lines.some((line) => line.includes("Select a category"))).toBe(true);
    expect(lines.some((line) => /ChatGPT account \[/.test(line) || line.includes("1. ChatGPT"))).toBe(false);
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
});
