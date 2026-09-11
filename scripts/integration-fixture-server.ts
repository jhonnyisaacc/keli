import { startIntegrationFixture } from "../tests/fixtures/integration-server.ts";

const fixture = startIntegrationFixture();
console.log(fixture.endpoint);

process.on("SIGINT", () => {
  fixture.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  fixture.stop();
  process.exit(0);
});
