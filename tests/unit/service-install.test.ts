import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installServiceFiles, readInstalledService, systemdUserUnit, launchdPlist } from "../../src/ops/service.ts";

describe("OS service units", () => {
  test("linux unit and launchd plist are written without personal-home paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keli-service-"));
    const linux = await installServiceFiles({ execPath: "/opt/keli/keli", destDir: dir, platform: "linux" });
    const body = await readInstalledService(dir, "linux");
    expect(linux.path.endsWith("keli.service")).toBe(true);
    expect(body).toContain("service run");
    expect(body).not.toMatch(/\/home\/[A-Za-z]/);

    const darwinDir = await mkdtemp(join(tmpdir(), "keli-launchd-"));
    const darwin = await installServiceFiles({ execPath: "/opt/keli/keli", destDir: darwinDir, platform: "darwin" });
    const plist = await readInstalledService(darwinDir, "darwin");
    expect(darwin.path.endsWith("io.keli.plist")).toBe(true);
    expect(plist).toContain("io.keli");
    expect(systemdUserUnit("/opt/keli/keli")).toContain("Restart=on-failure");
    expect(launchdPlist("/opt/keli/keli")).toContain("KeepAlive");
    await rm(dir, { recursive: true, force: true });
    await rm(darwinDir, { recursive: true, force: true });
  });
});
