import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { compactMemory } from "../../memory/retention.ts";
import { listConversations } from "../../memory/conversations.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function memoryCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Advisory memory: compact, retain, list conversations" },
    subCommands: {
      compact: defineCommand({
        meta: { description: "Archive expired notes/conversations before advancing the preservation cursor" },
        async run() {
          try {
            const { db, stateDir, owner } = await requireInitialized(globals.stateDir);
            const result = await compactMemory(db, stateDir, owner.id);
            db.close();
            emit(result, globals.outputFormat, `Archived ${result.archived} rows`);
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
      conversations: defineCommand({
        meta: { description: "List conversation summaries" },
        async run() {
          try {
            const { db } = await requireInitialized(globals.stateDir);
            const conversations = listConversations(db);
            db.close();
            emit({ conversations }, globals.outputFormat);
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
    },
  });
}
