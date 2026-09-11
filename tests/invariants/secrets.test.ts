import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LockedCredentialSource } from "../../src/credentials/source.ts";
import { runLandlocked } from "../../src/execution/linux-landlock.ts";
import { KeliError } from "../../src/core/errors.ts";

describe("A44 secret isolation", () => {
  test("locked credential source fails closed without leaking value", async () => {
    const source = new LockedCredentialSource();
    await expect(source.get({ id: "SYNTHETIC_SECRET", service: "keli-test" })).rejects.toThrow(
      KeliError,
    );
  });

  test.skipIf(process.platform !== "linux")(
    "landlocked shell child does not inherit synthetic secret env var",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "keli-secret-"));
      const workspace = await mkdtemp(join(root, "ws-"));
      const secret = "keli-test-secret-value-do-not-leak";

      process.env.KELI_TEST_SECRET = secret;
      const result = await runLandlocked(
        ["sh", "-c", "echo ${KELI_TEST_SECRET:-missing}"],
        workspace,
        [root],
        10_000,
      );
      delete process.env.KELI_TEST_SECRET;

      expect(result.stdout.trim()).toBe("missing");
      expect(result.stdout).not.toContain(secret);
      await rm(root, { recursive: true, force: true });
    },
  );
});
