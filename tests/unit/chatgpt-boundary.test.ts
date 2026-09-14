import { describe, expect, test } from "bun:test";
import { addCredential } from "../../src/integrations/auth.ts";

import { createModelProvider } from "../../src/model/provider-factory.ts";
import "../../src/integrations/load.ts";

describe("ChatGPT / Codex App Server boundary", () => {
  test("chatgpt login needs an interactive callback, never a pasted API key", async () => {
    await expect(addCredential("chatgpt", { type: "oauth-device" })).rejects.toThrow(
      /interactively/,
    );

  });

  test("chatgpt cannot be constructed without an explicitly linked account", async () => {
    await expect(createModelProvider({ explicitId: "chatgpt", config: { version: 2, ownerId: "o", defaultProjectId: "p" } })).rejects.toThrow();
  });
});
