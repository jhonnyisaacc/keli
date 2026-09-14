import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installServiceFiles, launchdPlist, systemdUserUnit } from "../../src/ops/service.ts";

describe("user service units", () => {
  test("generated systemd and launchd units run keli service, not a committed install template", async () => {
    expect(systemdUserUnit("/opt/keli/keli")).toContain("ExecStart=/opt/keli/keli service run --loop 30");
    expect(systemdUserUnit("/opt/keli/keli")).toContain("KELI_STATE_DIR=%h/.local/share/keli");
    expect(launchdPlist("/opt/keli/keli")).toContain("io.keli");
    expect(launchdPlist("/opt/keli/keli")).toContain("service");
    const dest = await mkdtemp(join(tmpdir(), "keli-service-"));
    const linux = await installServiceFiles({ execPath: "/opt/keli/keli", destDir: dest, platform: "linux" });
    expect(linux.path).toBe(join(dest, "keli.service"));
    const body = await Bun.file(linux.path).text();
    expect(body).toContain("keli service run");
    await rm(dest, { recursive: true, force: true });
  });
});
