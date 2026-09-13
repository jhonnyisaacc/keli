import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  defaultConfig,
  getConfigValue,
  isSecretConfigPath,
  normalizeConfig,
  setConfigValue,
  writeConfig,
  readConfig,
} from "../../src/state/config.ts";

describe("config paths", () => {
  test("normalize migrates primaryModel into providers.primary", () => {
    const n = normalizeConfig({
      ...defaultConfig(),
      ownerId: "o",
      defaultProjectId: "p",
      primaryModel: "fixture",
      fallbackModel: "openai-compatible",
    });
    expect(n.providers?.primary?.id).toBe("fixture");
    expect(n.providers?.fallback?.[0]?.id).toBe("openai-compatible");
  });

  test("get/set dotted paths", () => {
    let config = { ...defaultConfig(), ownerId: "o", defaultProjectId: "p" };
    config = setConfigValue(config, "routing.cheap", "fixture");
    expect(getConfigValue(config, "routing.cheap")).toBe("fixture");
  });

  test("secret path detection", () => {
    expect(isSecretConfigPath("integrations.grok.settings.api-key")).toBe(true);
    expect(isSecretConfigPath("routing.cheap")).toBe(false);
  });

  test("write/read keeps integrations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keli-cfg-"));
    await writeConfig(
      {
        ...defaultConfig(),
        ownerId: "o",
        defaultProjectId: "p",
        integrations: { discord: { enabled: true, settings: { channelId: "c1" } } },
      },
      dir,
    );
    const loaded = await readConfig(dir);
    expect(loaded?.integrations?.discord?.settings.channelId).toBe("c1");
  });
});
