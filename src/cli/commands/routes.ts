import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { projectScope, getProjectById } from "../../state/repos.ts";
import { bindTransportRoute, listTransportRoutes } from "../../transports/routes.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function routesCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Transport route bindings (immutable external ids → scope)" },
    subCommands: {
      list: routesListCommand(globals),
      bind: routesBindCommand(globals),
    },
  });
}

function routesListCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List transport routes" },
    args: {
      transport: { type: "string", description: "Filter by transport" },
    },
    async run({ args }) {
      try {
        const { db } = await requireInitialized(globals.stateDir);
        const routes = listTransportRoutes(db, args.transport);
        db.close();
        emit({ routes }, globals.outputFormat);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function routesBindCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Bind a transport external id to a project scope" },
    args: {
      transport: { type: "string", required: true, description: "discord or telegram" },
      id: { type: "string", required: true, description: "External route id (channel or chat[:topic])" },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) throw new Error("Default project missing");
        const route = bindTransportRoute(db, {
          transport: args.transport,
          externalId: args.id,
          scope: projectScope(project.id),
        });
        db.close();
        emit(route, globals.outputFormat, `Bound ${args.transport}:${args.id}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
