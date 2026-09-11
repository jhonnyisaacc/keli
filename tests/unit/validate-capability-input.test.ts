import { describe, expect, test } from "bun:test";
import { defaultRegistry } from "../../src/capabilities/registry.ts";
import { validateCapabilityInput } from "../../src/capabilities/validate.ts";
import { dispatchCapability } from "../../src/execution/dispatch.ts";
import { defaultNetworkPolicy } from "../../src/execution/dispatch-context.ts";
import { KeliError } from "../../src/core/errors.ts";

describe("validateCapabilityInput", () => {
  test("rejects files.list without path", () => {
    const descriptor = defaultRegistry.get("files.list")!;
    expect(() => validateCapabilityInput(descriptor, {})).toThrow(KeliError);
  });

  test("rejects files.write without content", () => {
    const descriptor = defaultRegistry.get("files.write")!;
    expect(() => validateCapabilityInput(descriptor, { path: "/tmp/x" })).toThrow(KeliError);
  });

  test("dispatch returns blocked result for missing required fields", async () => {
    const result = await dispatchCapability(
      defaultRegistry,
      { capabilityId: "files.list", input: {}, resources: ["/tmp"] },
      {
        policy: { readableRoots: ["/tmp"], writableRoots: [] },
        network: defaultNetworkPolicy(),
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_request");
  });
});
