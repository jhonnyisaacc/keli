import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const entry = join(root, "src/cli/index.ts");

const ALL_TARGETS = [
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-darwin-x64",
  "bun-darwin-arm64",
] as const;

function hostTarget(): string {
  return process.platform === "darwin"
    ? process.arch === "arm64"
      ? "bun-darwin-arm64"
      : "bun-darwin-x64"
    : process.arch === "arm64"
      ? "bun-linux-arm64"
      : "bun-linux-x64";
}

const buildAll = process.argv.includes("--all-targets");
const targets = buildAll ? ALL_TARGETS : [hostTarget()];

await mkdir(dist, { recursive: true });

const checksums: string[] = [];

for (const target of targets) {
  const suffix = target.replace("bun-", "");
  const outfile = join(dist, buildAll ? `keli-${suffix}` : "keli");
  const proc = Bun.spawn(
    ["bun", "build", "--compile", `--target=${target}`, entry, "--outfile", outfile],
    { cwd: root, stdout: "inherit", stderr: "inherit" },
  );
  const code = await proc.exited;
  if (code !== 0) process.exit(code);

  const bytes = await Bun.file(outfile).arrayBuffer();
  const sha256 = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  checksums.push(`${sha256}  ${buildAll ? `keli-${suffix}` : "keli"}`);
  console.log(`built ${outfile} (${target}) sha256=${sha256}`);
}

await copyFile(
  join(root, "src", "execution", "landlock-worker.py"),
  join(root, "dist", "landlock-worker.py"),
);

const checksumsBody = checksums.join("\n") + "\n";
await Bun.write(join(dist, "SHA256SUMS"), checksumsBody);

const signingKey = process.env.KELI_RELEASE_SIGNING_KEY;
if (signingKey) {
  const sig = createHash("sha256").update(checksumsBody + signingKey).digest("hex");
  await Bun.write(join(dist, "SHA256SUMS.sig"), sig + "\n");
  console.log("wrote dist/SHA256SUMS.sig (signing key present)");
}

if (buildAll) {
  console.log("all four release targets built (native smoke remains host-only)");
}
