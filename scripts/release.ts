import { $ } from "bun";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(import.meta.dir, "..");

await $`bun run scripts/build.ts`.cwd(root);
await $`bun run scripts/write-manifest.ts`.cwd(root);

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

const integrationProc = Bun.spawn(["bun", "run", "scripts/integration-fixture-server.ts"], {
  cwd: root,
  stdout: "pipe",
});
const integrationReader = integrationProc.stdout.getReader();
const { value: integrationValue } = await integrationReader.read();
integrationReader.releaseLock();
const integrationUrl = new TextDecoder().decode(integrationValue).trim();

const stateDir = await mkdtemp(join(tmpdir(), "keli-release-"));
const env = {
  ...process.env,
  KELI_STATE_DIR: stateDir,
  KELI_FIXTURE_URL: fixtureUrl,
  KELI_DELEGATE_FIXTURE_URL: integrationUrl,
  KELI_BROWSER_FIXTURE_URL: integrationUrl,
};

await $`${keli} init`.cwd(root).env(env);
await $`${keli} doctor`.cwd(root).env(env);
await $`${keli} -p ${"Rocket changes use Codex"} --fixture`.cwd(root).env(env);
await $`${keli} -p ${"Perform the next Rocket coding action."} --fixture`.cwd(root).env(env);

await $`${keli} invoke web.fetch --url ${`${integrationUrl}/page`} --json`.cwd(root).env({
  ...env,
});

fixtureProc.kill();
integrationProc.kill();
console.log("release: local artifacts prepared and 0.1-C smoke passed (no publish)");
