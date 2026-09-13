import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { writeConfig } from "../../state/config.ts";
import { indexCollection } from "../../sources/index.ts";
import { createSourceReader } from "../../sources/reader.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function sourcesCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Read-only source collections (markdown + frontmatter) for research" },
    subCommands: {
      add: defineCommand({
        meta: { description: "Register a collection directory in config" },
        args: {
          id: { type: "string", required: true, description: "Collection id (e.g. shaul, cava)" },
          path: { type: "string", required: true, description: "Directory of .md/.txt documents" },
          kind: { type: "string", description: "notes | transcripts" },
          author: { type: "string", description: "Default author when frontmatter has none" },
        },
        async run({ args }) {
          try {
            const { stateDir, config } = await requireInitialized(globals.stateDir);
            const collections = (config.sources?.collections ?? []).filter((c) => c.id !== args.id);
            const kind = args.kind === "transcripts" ? "transcripts" : args.kind === "notes" ? "notes" : undefined;
            collections.push({ id: String(args.id), path: String(args.path), kind, author: args.author ? String(args.author) : undefined });
            await writeConfig({ ...config, sources: { ...(config.sources ?? {}), collections } }, stateDir);
            emit({ id: args.id, path: args.path }, globals.outputFormat, `Registered collection ${args.id}; run: keli sources index`);
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      index: defineCommand({
        meta: { description: "Index (or re-index) configured collections; unchanged documents are skipped" },
        args: { id: { type: "string", description: "Only this collection" } },
        async run({ args }) {
          try {
            const { db, config } = await requireInitialized(globals.stateDir);
            const collections = (config.sources?.collections ?? []).filter((c) => !args.id || c.id === args.id);
            if (!collections.length) throw new Error("No source collections configured. Run: keli sources add --id <id> --path <dir>");
            const results = [];
            for (const collection of collections) results.push(await indexCollection(db, collection));
            db.close();
            emit(
              results,
              globals.outputFormat,
              results.map((r) => `${r.collection}: ${r.indexed} indexed, ${r.unchanged} unchanged, ${r.removed} removed`).join("\n"),
            );
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      list: defineCommand({
        meta: { description: "Show indexed collections" },
        async run() {
          try {
            const { db } = await requireInitialized(globals.stateDir);
            const collections = createSourceReader(db).collections();
            db.close();
            emit(
              collections,
              globals.outputFormat,
              collections.length
                ? collections.map((c) => `${c.id}: ${c.documents} docs${c.authors.length ? ` (${c.authors.join(", ")})` : ""}${c.latestPublishedAt ? ` latest ${c.latestPublishedAt}` : ""}`).join("\n")
                : "No indexed collections",
            );
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      search: defineCommand({
        meta: { description: "Full-text search over indexed collections" },
        args: {
          query: { type: "positional", required: true, description: "Search terms" },
          collection: { type: "string", description: "Restrict to one collection" },
        },
        async run({ args }) {
          try {
            const { db } = await requireInitialized(globals.stateDir);
            const hits = createSourceReader(db).search({ query: String(args.query), collection: args.collection ? String(args.collection) : undefined });
            db.close();
            emit(
              hits,
              globals.outputFormat,
              hits.length ? hits.map((h) => `${h.sourceId}\n  ${h.title}${h.author ? ` — ${h.author}` : ""}\n  ${h.snippet}`).join("\n") : "No hits",
            );
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
    },
  });
}
