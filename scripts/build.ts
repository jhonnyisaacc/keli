import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const out = join(root, "dist", "keli");

await mkdir(join(root, "dist"), { recursive: true });

const target =
  process.platform === "darwin"
    ? process.arch === "arm64"
      ? "bun-darwin-arm64"
      : "bun-darwin-x64"
    : process.arch === "arm64"
      ? "bun-linux-arm64"
      : "bun-linux-x64";

const entry = join(root, "src/cli/index.ts");
const proc = Bun.spawn(
  ["bun", "build", "--compile", `--target=${target}`, entry, "--outfile", out],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);
const code = await proc.exited;
if (code !== 0) process.exit(code);

console.log(`built ${out} (${target})`);
