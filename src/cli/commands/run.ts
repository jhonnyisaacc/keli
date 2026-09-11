import { defineCommand } from "citty";
import { openApp, type CliGlobals } from "../context.ts";
import { emit, emitError } from "../output.ts";
import { needsProvider } from "../parse-run-args.ts";

export function runCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Run one headless turn" },
    args: {
      prompt: {
        type: "positional",
        description: "Prompt text",
        required: false,
      },
      p: {
        type: "string",
        alias: "prompt-flag",
        description: "Prompt text",
      },
      fixture: {
        type: "boolean",
        description: "Use fixture provider (requires KELI_FIXTURE_URL or --fixture-endpoint)",
        default: false,
      },
      "fixture-endpoint": {
        type: "string",
        description: "OpenAI-compatible fixture endpoint base URL",
      },
      undo: {
        type: "boolean",
        description: "Undo last rule revision for default project",
        default: false,
      },
    },
    async run({ args }) {
      const prompt = args.p ?? args.prompt;
      if (!prompt && !args.undo) {
        emitError("Provide --prompt/-p or --undo", globals.outputFormat);
      }

      if (args.fixture && args["fixture-endpoint"]) {
        globals.fixture = true;
        globals.fixtureEndpoint = args["fixture-endpoint"];
      } else if (args.fixture && process.env.KELI_FIXTURE_URL) {
        globals.fixture = true;
        globals.fixtureEndpoint = process.env.KELI_FIXTURE_URL;
      } else if (globals.fixtureEndpoint) {
        globals.fixture = true;
      } else if (args.fixture) {
        emitError(
          "Fixture mode requires KELI_FIXTURE_URL or --fixture-endpoint",
          globals.outputFormat,
        );
      }

      try {
        const resolvedPrompt = args.p ?? args.prompt;
        const runArgs = {
          prompt: resolvedPrompt,
          undo: args.undo,
          fixture: args.fixture,
          fixtureEndpoint: globals.fixtureEndpoint,
        };
        const app = await openApp(globals, {
          requireProvider: needsProvider({
            ...runArgs,
            outputFormat: globals.outputFormat,
            cwd: globals.cwd,
          }),
        });
        const result = await app.loop.runTurn(prompt ?? "", { undo: args.undo });
        app.close();
        emit(result, globals.outputFormat, result.message);
        if (result.kind === "error" || result.kind === "blocked") {
          process.exit(result.kind === "blocked" ? 2 : 1);
        }
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
