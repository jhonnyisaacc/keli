import { defineCommand } from "citty";
import { openDatabase } from "../../state/db.ts";
import { readConfig } from "../../state/config.ts";
import { projectScope } from "../../state/repos.ts";
import { addNote, listNotes, searchNotes } from "../../memory/notes.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function notesCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Local scoped notes (advisory memory)" },
    subCommands: {
      add: notesAddCommand(globals),
      list: notesListCommand(globals),
      search: notesSearchCommand(globals),
    },
  });
}

function notesAddCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Add a scoped note" },
    args: {
      title: { type: "string", required: true },
      body: { type: "string", required: true },
      scope: { type: "string", description: "Project scope override" },
    },
    async run({ args }) {
      try {
        const config = await readConfig(globals.stateDir);
        if (!config?.defaultProjectId) {
          emitError("Run keli init first", globals.outputFormat);
          return;
        }
        const scope = args.scope ?? projectScope(config.defaultProjectId);
        const db = await openDatabase(globals.stateDir);
        const note = addNote(db, {
          id: crypto.randomUUID(),
          scope,
          title: args.title,
          body: args.body,
        });
        db.close();
        emit(note, globals.outputFormat, `Note added: ${note.id}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function notesListCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List notes for default project scope" },
    async run() {
      try {
        const config = await readConfig(globals.stateDir);
        if (!config?.defaultProjectId) {
          emitError("Run keli init first", globals.outputFormat);
          return;
        }
        const db = await openDatabase(globals.stateDir);
        const notes = listNotes(db, projectScope(config.defaultProjectId));
        db.close();
        emit({ notes }, globals.outputFormat);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function notesSearchCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "FTS search notes in default project scope" },
    args: {
      q: { type: "string", required: true },
    },
    async run({ args }) {
      try {
        const config = await readConfig(globals.stateDir);
        if (!config?.defaultProjectId) {
          emitError("Run keli init first", globals.outputFormat);
          return;
        }
        const db = await openDatabase(globals.stateDir);
        const notes = searchNotes(db, projectScope(config.defaultProjectId), args.q);
        db.close();
        emit({ notes }, globals.outputFormat);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
