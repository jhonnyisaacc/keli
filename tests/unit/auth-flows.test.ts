import { describe, expect, test } from "bun:test";
import { LockedCredentialSource } from "../../src/credentials/source.ts";
import { addCredential } from "../../src/integrations/auth.ts";
import { KeliError } from "../../src/core/errors.ts";
import "../../src/integrations/load.ts";

describe("auth flows", () => {
  test("oauth-device is a declared unimplemented seam", async () => {
    await expect(
      addCredential("openai-compatible", { type: "oauth-device", value: "x" }),
    ).rejects.toThrow(/OAuth\/device/);
  });

  test("locked store fails closed on write", async () => {
    try {
      await addCredential("openai-compatible", {
        value: "sk-test",
        source: new LockedCredentialSource(),
      });
      throw new Error("expected failure");
    } catch (e) {
      expect(e).toBeInstanceOf(KeliError);
      expect((e as KeliError).code).toBe("secret_unavailable");
    }
  });
});
