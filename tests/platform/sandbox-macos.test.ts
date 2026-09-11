import { describe, expect, test } from "bun:test";
import { getSandboxBackend, resetSandboxProbeCache } from "../../src/execution/backends.ts";
import { shellExec } from "../../src/adapters/shell.ts";

const isDarwin = process.platform === "darwin";

describe("macOS sandbox fail-closed", () => {
  test.skipIf(isDarwin)("documents darwin fail-closed expectation on non-mac hosts", async () => {
    resetSandboxProbeCache();
    const backend = await getSandboxBackend();
    if (process.platform === "linux") {
      expect(backend.available).toBe(true);
      return;
    }
    expect(backend.available).toBe(false);
  });

  test.skipIf(!isDarwin)("shell.exec fails closed when sandbox unavailable", async () => {
    resetSandboxProbeCache();
    const backend = await getSandboxBackend();
    expect(backend.available).toBe(false);

    const result = await shellExec(
      { command: "echo hi" },
      { readableRoots: [process.cwd()], writableRoots: [process.cwd()] },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("sandbox_denied");
  });
});
