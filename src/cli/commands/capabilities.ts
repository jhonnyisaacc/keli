import { defineCommand } from "citty";
import { defaultRegistry } from "../../capabilities/registry.ts";
import { emit } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function capabilitiesCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List indexed capabilities" },
    args: {
      json: {
        type: "boolean",
        description: "Output JSON",
        default: false,
      },
      query: {
        type: "string",
        description: "Search capabilities by id or summary",
      },
    },
    async run({ args }) {
      const format = args.json ? "json" : globals.outputFormat;
      const items = args.query
        ? defaultRegistry.discover(args.query)
        : defaultRegistry.index().map((i) => defaultRegistry.get(i.id)!);
      emit(
        {
          count: items.length,
          capabilities: items.map((c) => ({
            id: c.id,
            version: c.version,
            summary: c.summary,
            actionClass: c.actionClass,
          })),
        },
        format,
        items.map((c) => `${c.id}  ${c.summary}`).join("\n"),
      );
    },
  });
}
