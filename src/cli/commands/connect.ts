import { defineCommand } from "citty";
import { runSetup, type SetupSection } from "../../setup/wizard.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

const SECTIONS = new Set([
  "provider",
  "transport",
  "delegate",
  "memory",
  "mcp",
  "search",
  "browser",
  "documents",
  "speech",
  "advanced",
  "connect",
]);

export function connectCommand(globals: CliGlobals) {
  return defineCommand({
    meta: {
      description: "Connect optional integrations (search, browser, memory, speech, messaging, MCP)",
    },
    args: {
      section: {
        type: "positional",
        description: "search | browser | memory | documents | speech | transport | mcp | delegate",
        required: false,
      },
      fixture: {
        type: "boolean",
        default: false,
        description: "Allow the fixture provider; never an implicit production default",
      },
    },
    async run({ args }) {
      try {
        const raw = args.section as string | undefined;
        const section: SetupSection =
          raw && SECTIONS.has(raw) ? (raw as SetupSection) : "connect";
        const result = await runSetup({
          stateDir: globals.stateDir,
          cwd: globals.cwd,
          section,
          skipCalibration: true,
          skipTransportTest: true,
          fixture: args.fixture || globals.fixture,
        });
        emit(result, globals.outputFormat, "Optional connections updated");
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
