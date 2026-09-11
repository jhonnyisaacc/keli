import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const stateDir = await mkdtemp(join(tmpdir(), "keli-dev-"));
process.env.KELI_STATE_DIR = stateDir;

console.log(`KELI_STATE_DIR=${stateDir}`);
console.log("Run: bun src/cli/index.ts init");
console.log("Ctrl+C to exit dev supervisor.");

process.stdin.resume();
