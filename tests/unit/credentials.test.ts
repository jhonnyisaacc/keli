import { describe, expect, test } from "bun:test";
import { LockedCredentialSource } from "../../src/credentials/source.ts";
import { KeliError } from "../../src/core/errors.ts";

describe("credentials", () => {
  test("locked source fails closed", async () => {
    const source = new LockedCredentialSource();
    expect(source.available).toBe(false);
    await expect(source.get({ id: "api-key", service: "keli" })).rejects.toThrow(KeliError);
  });
});
