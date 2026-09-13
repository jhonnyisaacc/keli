import { defaultCredentialSource } from "../src/credentials/source.ts";
import { renderLiveProbe, runLiveProbe } from "../src/integrations/live-probe.ts";
import { readConfig } from "../src/state/config.ts";

const args = process.argv.slice(2);
const requireArg = args.find((a) => a.startsWith("--require="));
const onlyArg = args.find((a) => a.startsWith("--only="));
const require = requireArg ? requireArg.slice("--require=".length).split(",").filter(Boolean) : [];
const only = onlyArg ? onlyArg.slice("--only=".length).split(",").filter(Boolean) : undefined;

const config = await readConfig(process.env.KELI_STATE_DIR);
const report = await runLiveProbe({
  config,
  credentials: defaultCredentialSource(),
  require,
  only,
});
const text = renderLiveProbe(report);
await Bun.write("docs/evidence/LIVE_PROBE.md", text);
console.log(text);
if (!report.green) process.exit(1);
