import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { listConversations } from "../../memory/conversations.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function sessionsCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List recent runs and conversations" },
    subCommands: {
      list: defineCommand({
        meta: { description: "List conversations and recent runs" },
        async run() {
          try {
            const { db } = await requireInitialized(globals.stateDir);
            const conversations = listConversations(db, 50);
            const runs = db
              .query("SELECT id, scope, status, created_at FROM runs ORDER BY created_at DESC LIMIT 50")
              .all() as Array<{ id: string; scope: string; status: string; created_at: string }>;
            db.close();
            emit(
              { conversations, runs },
              globals.outputFormat,
              [
                ...conversations.map((c) => `conversation\t${c.id}\t${c.transport ?? "-"}\t${c.externalId ?? "-"}`),
                ...runs.map((r) => `run\t${r.id}\t${r.status}\t${r.scope}`),
              ].join("\n") || "No sessions yet.",
            );
          } catch (e) {
            emitError(String(e), globals.outputFormat);
          }
        },
      }),
    },
  });
}
