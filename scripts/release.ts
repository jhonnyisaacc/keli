import { $ } from "bun";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(import.meta.dir, "..");

await $`bun run scripts/build.ts`.cwd(root);

const keli = join(root, "dist", "keli");
const version = await $`${keli} version`.cwd(root).text();
console.log(version.trim());

const fixtureProc = Bun.spawn(["bun", "run", "scripts/fixture-server.ts"], {
  cwd: root,
  stdout: "pipe",
});
const reader = fixtureProc.stdout.getReader();
const { value } = await reader.read();
reader.releaseLock();
const fixtureUrl = new TextDecoder().decode(value).trim();
const stateDir = await mkdtemp(join(tmpdir(), "keli-release-"));

await $`${keli} init`.cwd(root).env({ ...process.env, KELI_STATE_DIR: stateDir });
await $`${keli} doctor`.cwd(root).env({ ...process.env, KELI_STATE_DIR: stateDir });
await $`${keli} -p ${"Rocket changes use Codex"} --fixture`.cwd(root).env({
  ...process.env,
  KELI_STATE_DIR: stateDir,
  KELI_FIXTURE_URL: fixtureUrl,
});
await $`${keli} -p ${"Perform the next Rocket coding action."} --fixture`.cwd(root).env({
  ...process.env,
  KELI_STATE_DIR: stateDir,
  KELI_FIXTURE_URL: fixtureUrl,
});

fixtureProc.kill();
console.log("release: local artifacts prepared and smoke passed (no publish in 0.1-A)");
