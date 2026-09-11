import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertReadable } from "../../src/execution/policy.ts";
import { KeliError } from "../../src/core/errors.ts";

describe("resource policy", () => {
  test("denies paths outside project roots", async () => {
    const root = await mkdtemp(join(tmpdir(), "keli-policy-"));
    await writeFile(join(root, "allowed.txt"), "ok");
    const policy = { readableRoots: [root], writableRoots: [root] };

    const resolved = assertReadable(policy, "allowed.txt", root);
    expect(resolved).toContain("allowed.txt");

    expect(() => assertReadable(policy, "/etc/passwd", root)).toThrow(KeliError);
    await rm(root, { recursive: true, force: true });
  });
});
