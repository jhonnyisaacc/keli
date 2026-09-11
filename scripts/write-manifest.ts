import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { KELI_VERSION } from "../src/version.ts";
import { CURRENT_SCHEMA_VERSION } from "../src/state/migrate.ts";
import { sha256File } from "../src/update/manifest.ts";
import { detectPlatformArch } from "../src/update/paths.ts";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const { platform, arch } = detectPlatformArch();
const binary = join(dist, "keli");

const sha256 = await sha256File(binary);
const stat = await Bun.file(binary).stat();

const manifest = {
  version: KELI_VERSION,
  gitSha: process.env.GITHUB_SHA ?? "local",
  bunVersion: Bun.version,
  schemaReadMin: 1,
  schemaReadMax: CURRENT_SCHEMA_VERSION,
  schemaWriteMin: 1,
  schemaWriteMax: CURRENT_SCHEMA_VERSION,
  publishedAt: new Date().toISOString(),
  artifacts: [
    {
      name: `keli-${platform}-${arch}`,
      platform,
      arch,
      sha256,
      size: stat.size,
      url: `file://${binary}`,
    },
  ],
};

await writeFile(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${join(dist, "manifest.json")}`);
