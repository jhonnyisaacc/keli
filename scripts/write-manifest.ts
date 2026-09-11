import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { KELI_VERSION } from "../src/version.ts";
import { CURRENT_SCHEMA_VERSION } from "../src/state/migrate.ts";
import { sha256File } from "../src/update/manifest.ts";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");

const artifacts: Array<{
  name: string;
  platform: string;
  arch: string;
  sha256: string;
  size: number;
  url: string;
}> = [];

const names = await readdir(dist);
for (const name of names) {
  const match = /^keli-(linux|darwin)-(x64|arm64)$/.exec(name);
  if (!match) continue;
  const binary = join(dist, name);
  const sha256 = await sha256File(binary);
  const stat = await Bun.file(binary).stat();
  artifacts.push({
    name,
    platform: match[1],
    arch: match[2],
    sha256,
    size: stat.size,
    url: `file://${binary}`,
  });
}

if (artifacts.length === 0) {
  const binary = join(dist, "keli");
  const sha256 = await sha256File(binary);
  const stat = await Bun.file(binary).stat();
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  artifacts.push({
    name: `keli-${platform}-${arch}`,
    platform,
    arch,
    sha256,
    size: stat.size,
    url: `file://${binary}`,
  });
}

const manifest = {
  version: KELI_VERSION,
  gitSha: process.env.GITHUB_SHA ?? "local",
  bunVersion: Bun.version,
  schemaReadMin: 1,
  schemaReadMax: CURRENT_SCHEMA_VERSION,
  schemaWriteMin: 1,
  schemaWriteMax: CURRENT_SCHEMA_VERSION,
  publishedAt: new Date().toISOString(),
  artifacts,
};

const manifestPath = join(dist, "manifest.json");
const manifestBody = JSON.stringify(manifest, null, 2) + "\n";
await writeFile(manifestPath, manifestBody);
console.log(`wrote ${manifestPath}`);

const signingKey = process.env.KELI_RELEASE_SIGNING_KEY;
if (signingKey) {
  const sig = createHash("sha256")
    .update(manifestBody + signingKey)
    .digest("hex");
  await writeFile(join(dist, "manifest.json.sig"), sig + "\n");
  console.log("wrote dist/manifest.json.sig (signing key present)");
}
