import { describe, expect, test } from "bun:test";
import { addCredential } from "../../src/integrations/auth.ts";
import { chatgptConversationIncompatibility } from "../../src/integrations/chatgpt-boundary.ts";
import { createModelProvider } from "../../src/model/provider-factory.ts";
import "../../src/integrations/load.ts";

describe("ChatGPT / Codex App Server boundary", () => {
  test("chatgpt oauth-device reports the documented incompatibility", async () => {
    await expect(addCredential("chatgpt", { type: "oauth-device" })).rejects.toThrow(
      /Codex agent that executes tools/,
    );
    expect(chatgptConversationIncompatibility()).toContain("proposal-only");
  });

  test("chatgpt cannot be constructed as a conversation provider", async () => {
    await expect(createModelProvider({ explicitId: "chatgpt", config: { version: 2, ownerId: "o", defaultProjectId: "p" } })).rejects.toThrow();
  });
});
