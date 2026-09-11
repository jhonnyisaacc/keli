import { startFixtureProvider } from "../tests/fixtures/provider.ts";

const fixture = startFixtureProvider();
console.log(fixture.endpoint);

process.on("SIGINT", () => {
  fixture.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  fixture.stop();
  process.exit(0);
});
