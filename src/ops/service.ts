import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

export type ServicePlatform = "linux" | "darwin" | "other";

export function detectServicePlatform(platform = process.platform): ServicePlatform {
  if (platform === "linux") return "linux";
  if (platform === "darwin") return "darwin";
  return "other";
}

export function defaultServiceDir(platform: ServicePlatform = detectServicePlatform()): string {
  if (process.env.KELI_SERVICE_DIR) return process.env.KELI_SERVICE_DIR;
  if (platform === "linux") return join(homedir(), ".config/systemd/user");
  if (platform === "darwin") return join(homedir(), "Library/LaunchAgents");
  return join(homedir(), ".local/share/keli/service");
}

export function serviceUnitName(platform: ServicePlatform = detectServicePlatform()): string {
  return platform === "darwin" ? "io.keli.plist" : "keli.service";
}

export function systemdUserUnit(exec: string): string {
  return `[Unit]
Description=Keli personal agent (jobs, watches, transport poll)
After=default.target

[Service]
Type=simple
ExecStart=${exec} service run --loop 30
Restart=on-failure
RestartSec=5
Environment=KELI_STATE_DIR=%h/.local/share/keli

[Install]
WantedBy=default.target
`;
}

export function launchdPlist(exec: string, label = "io.keli"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${exec}</string>
    <string>service</string>
    <string>run</string>
    <string>--loop</string>
    <string>30</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
`;
}

export async function installServiceFiles(options: {
  execPath: string;
  destDir?: string;
  platform?: ServicePlatform;
}): Promise<{ path: string; platform: ServicePlatform }> {
  const platform = options.platform ?? detectServicePlatform();
  if (platform === "other") {
    throw new Error("Service install supports Linux systemd user units and macOS launchd");
  }
  const dir = options.destDir ?? defaultServiceDir(platform);
  await mkdir(dir, { recursive: true });
  const path = join(dir, serviceUnitName(platform));
  const body = platform === "darwin" ? launchdPlist(options.execPath) : systemdUserUnit(options.execPath);
  await writeFile(path, body, "utf8");
  return { path, platform };
}

export async function readInstalledService(destDir?: string, platform?: ServicePlatform): Promise<string | null> {
  const p = platform ?? detectServicePlatform();
  const dir = destDir ?? defaultServiceDir(p);
  const path = join(dir, serviceUnitName(p));
  if (!existsSync(path)) return null;
  return readFile(path, "utf8");
}

export { dirname };
