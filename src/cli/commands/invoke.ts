import { defineCommand } from "citty";
import { defaultRegistry } from "../../capabilities/registry.ts";
import { CapabilityGate } from "../../core/capability-gate.ts";
import { requireInitialized } from "../../state/init.ts";
import { getProjectById, projectScope } from "../../state/repos.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";
import type { CapabilityProposal } from "../../capabilities/types.ts";
import { validateCapabilityInput } from "../../capabilities/validate.ts";
import { KeliError } from "../../core/errors.ts";

export function invokeCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Invoke a gated capability directly" },
    args: {
      capability: {
        type: "positional",
        description: "Capability id (e.g. files.read)",
        required: true,
      },
      path: {
        type: "string",
        description: "Path argument for file capabilities",
      },
      content: {
        type: "string",
        description: "Content for files.write",
      },
      command: {
        type: "string",
        description: "Command for shell.exec",
      },
      url: {
        type: "string",
        description: "URL for http.fetch / web.fetch / browser.navigate",
      },
      query: {
        type: "string",
        description: "Query for search.query",
      },
      workflow: {
        type: "string",
        description: "Declared workflow for tools.rocket and other structured CLI tools",
      },
      name: {
        type: "string",
        description: "Tool name for mcp.tools/call",
      },
      delegate: {
        type: "string",
        description: "Delegate name for delegate.run (Codex/OpenCode)",
      },
      goal: {
        type: "string",
        description: "Goal for delegate.run",
      },
      json: {
        type: "boolean",
        default: false,
      },
    },
    async run({ args }) {
      const format = args.json ? "json" : globals.outputFormat;
      try {
        const { stateDir, config, db, owner } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) {
          emitError("Default project missing", format);
        }

        const roots = JSON.parse(project.resource_roots_json) as string[];
        const policy = { readableRoots: roots, writableRoots: roots };
        const scope = projectScope(project.id);

        const descriptor = defaultRegistry.get(args.capability);
        if (!descriptor) {
          throw new KeliError(`Unknown capability: ${args.capability}`, "capability_denied");
        }

        const input: Record<string, string> = {};
        if (args.path !== undefined) input.path = args.path;
        if (args.content !== undefined) input.content = args.content;
        if (args.command !== undefined) input.command = args.command;
        if (args.url !== undefined) input.url = args.url;
        if (args.query !== undefined) input.query = args.query;
        if (args.name !== undefined) input.name = args.name;
        if (args.delegate !== undefined) input.delegate = args.delegate;
        if (args.goal !== undefined) input.goal = args.goal;
        if (args.workflow !== undefined) input.workflow = args.workflow;
        if (args.capability === "delegate.run") {
          input.workspace = args.path ?? globals.cwd;
          input.actionId = crypto.randomUUID();
        }
        validateCapabilityInput(descriptor, input);

        const proposal: CapabilityProposal = {
          capabilityId: args.capability,
          input,
          resources: roots,
        };

        const gate = new CapabilityGate(db, defaultRegistry, stateDir, owner.id);
        const { actionId, runId, result } = await gate.run(proposal, policy, scope, globals.cwd, { config });
        const terminal = gate.terminalStatus(actionId);

        emit(
          { actionId, runId, terminal, result },
          format,
          result.ok ? JSON.stringify(result.output) : `error: ${result.error?.message}`,
        );

        db.close();
        if (!result.ok) process.exit(1);
      } catch (e) {
        emitError(String(e), format);
      }
    },
  });
}
