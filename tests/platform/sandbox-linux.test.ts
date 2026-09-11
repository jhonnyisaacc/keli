import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { probeLandlock, runLandlocked } from "../../src/execution/linux-landlock.ts";
import { resetSandboxProbeCache } from "../../src/execution/backends.ts";

const isLinux = process.platform === "linux";

describe("linux landlock sandbox", () => {
  test.skipIf(!isLinux)("probe reports landlock availability", async () => {
    const probe = await probeLandlock();
    expect(probe.platform).toBe("linux");
    expect(probe.available).toBe(true);
  });

  test.skipIf(!isLinux)("confined shell cannot write outside workspace", async () => {
    resetSandboxProbeCache();
    const workspace = await mkdtemp(join(tmpdir(), "keli-landlock-ws-"));
    const escapeTarget = join(tmpdir(), `keli-escape-${Date.now()}.txt`);

    const result = await runLandlocked(
      ["sh", "-c", `echo escaped > ${escapeTarget}`],
      workspace,
      [],
    );

    expect(result.exitCode).not.toBe(0);
    let exists = true;
    try {
      await readFile(escapeTarget, "utf8");
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
    await rm(workspace, { recursive: true, force: true });
  });

  test.skipIf(!isLinux)("confined shell can write inside workspace", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "keli-landlock-ws-"));

    const result = await runLandlocked(
      ["sh", "-c", "echo ok > ok.txt"],
      workspace,
      [],
    );

    expect(result.exitCode).toBe(0);
    expect(await readFile(join(workspace, "ok.txt"), "utf8")).toContain("ok");
    await rm(workspace, { recursive: true, force: true });
  });
});
