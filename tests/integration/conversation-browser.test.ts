import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createConversationApp } from "../../src/conversation/app.ts";
import { BehaviorService } from "../../src/core/behavior.ts";
import { initializeState, requireInitialized } from "../../src/state/init.ts";
import { readConfig, writeConfig } from "../../src/state/config.ts";
import { startIntegrationFixture } from "../fixtures/integration-server.ts";
import { ScriptedChatModel, scriptedFactory } from "../fixtures/scripted-model.ts";

const ENV_KEYS = [
  "KELI_BROWSER_FIXTURE_URL",
  "KELI_FIXTURE_BROWSER",
  "KELI_BROWSER_CDP_URL",
  "KELI_FIXTURE_BROWSER_CDP",
  "KELI_BROWSER_MCP_URL",
  "KELI_FIXTURE_BROWSER_MCP",
] as const;

describe("conversation app browser wiring", () => {
  const previous = new Map<string, string | undefined>();

  afterEach(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
  });

  test("saved CDP settings reach navigate when env fixtures are unset", async () => {
    for (const key of ENV_KEYS) {
      previous.set(key, process.env[key]);
      delete process.env[key];
    }
    const fixture = startIntegrationFixture();
    const stateDir = await mkdtemp(join(tmpdir(), "keli-conv-browser-"));
    try {
      const init = await initializeState(stateDir);
      const { db, owner } = await requireInitialized(stateDir);
      const config = (await readConfig(stateDir))!;
      config.browser = { primary: "cdp" };
      config.integrations = {
        ...config.integrations,
        "browser-cdp": { enabled: true, settings: { url: fixture.endpoint } },
      };
      await writeConfig(config, stateDir);
      const model = new ScriptedChatModel([
        { type: "tool_call", capability: "browser.navigate", input: { url: `${fixture.endpoint}/page` } },
        (messages) => {
          const last = messages.at(-1)?.content ?? "";
          expect(last).toContain("fixture content");
          expect(last).toContain("\"backend\":\"cdp\"");
          return { type: "missing_evidence", text: "Checked the saved CDP backend", needed: [] };
        },
      ]);
      const app = createConversationApp({
        db,
        behavior: new BehaviorService(db, owner.id),
        config,
        stateDir,
        ownerId: owner.id,
        project: { id: init.projectId, name: init.projectName, resourceRoots: [stateDir] },
        model: scriptedFactory(model),
      });
      expect(app.browser.primary).toBe("cdp");
      expect(app.browser.cdpUrl).toBe(fixture.endpoint);
      const outcome = await app.loop.runTurn(app.cliContext("c1"), "open the page", {
        control: {
          assertActive: () => undefined,
          collections: [],
          phase: () => undefined,
          allowedCapabilities: ["browser.navigate"],
        },
      });
      expect(outcome.kind).toBe("missing_evidence");
      expect(model.calls.length).toBe(2);
      db.close();
    } finally {
      fixture.stop();
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});
