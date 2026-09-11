import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CapabilityRegistry, defaultRegistry } from "../../src/capabilities/registry.ts";
import { dispatchCapability } from "../../src/execution/dispatch.ts";
import { defaultNetworkPolicy } from "../../src/execution/dispatch-context.ts";

describe("capability dispatch", () => {
  test("files.read succeeds inside roots and denies outside", async () => {
    const root = await mkdtemp(join(tmpdir(), "keli-dispatch-"));
    const file = join(root, "hello.txt");
    await writeFile(file, "hi");

    const policy = { readableRoots: [root], writableRoots: [root] };
    const ok = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "files.read", input: { path: "hello.txt" }, resources: [root] },
      { policy, network: defaultNetworkPolicy(), cwd: root },
    );
    expect(ok.ok).toBe(true);

    const denied = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "files.read", input: { path: "/etc/passwd" }, resources: [] },
      { policy, network: defaultNetworkPolicy(), cwd: root },
    );
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe("capability_denied");
    await rm(root, { recursive: true, force: true });
  });

  test("registry index stays compact with many registrations", () => {
    const registry = new CapabilityRegistry();
    const base = registry.index().length;
    for (let i = 0; i < 100; i++) {
      registry.register({
        id: `skill.extra-${i}`,
        version: "0.0.1",
        summary: `extra ${i}`,
        actionClass: "read",
        resources: [],
        schema: { type: "object" },
      });
    }
    expect(registry.index().length).toBe(base + 100);
    expect(JSON.stringify(registry.index()).length).toBeLessThan(20_000);
  });
});
