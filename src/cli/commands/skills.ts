import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { projectScope } from "../../state/repos.ts";
import {
  activateSkill,
  getActiveSkill,
  listSkillIndex,
  pinSkillVersion,
  rollbackSkill,
} from "../../skills/store.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function skillsCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Durable skill pins" },
    subCommands: {
      list: skillsList(globals),
      show: skillsShow(globals),
      pin: skillsPin(globals),
      activate: skillsActivate(globals),
      rollback: skillsRollback(globals),
    },
  });
}

function scopeOf(config: { defaultProjectId: string }, override?: string) {
  return override ?? projectScope(config.defaultProjectId);
}

function skillsList(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List skill index (compact summaries)" },
    args: { scope: { type: "string" } },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const rows = listSkillIndex(db, scopeOf(config, args.scope));
        db.close();
        emit({ skills: rows }, globals.outputFormat, rows.map((r) => `${r.id}@${r.version}\t${r.summary}`).join("\n"));
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function skillsShow(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Show the active skill" },
    args: {
      id: { type: "positional", required: true },
      scope: { type: "string" },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const skill = getActiveSkill(db, String(args.id), scopeOf(config, args.scope));
        db.close();
        emit(skill, globals.outputFormat, skill ? `${skill.id}@${skill.version}\n${skill.content}` : "not found");
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function skillsPin(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Pin a skill version (draft unless --activate)" },
    args: {
      id: { type: "string", required: true },
      version: { type: "string", required: true },
      content: { type: "string", required: true },
      source: { type: "string", default: "owner" },
      scope: { type: "string" },
      activate: { type: "boolean", default: false },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        const scope = scopeOf(config, args.scope);
        const version = Number(args.version);
        const record = pinSkillVersion(db, {
          id: args.id,
          version,
          scope,
          source: args.source,
          content: args.content,
        });
        if (args.activate) activateSkill(db, args.id, scope, version);
        db.close();
        emit(record, globals.outputFormat, `Pinned ${record.id}@${record.version}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function skillsActivate(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Activate a pinned skill version" },
    args: {
      id: { type: "string", required: true },
      version: { type: "string", required: true },
      scope: { type: "string" },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        activateSkill(db, args.id, scopeOf(config, args.scope), Number(args.version));
        db.close();
        emit({ id: args.id, version: args.version }, globals.outputFormat, `Activated ${args.id}@${args.version}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function skillsRollback(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Roll a skill back to a previous version" },
    args: {
      id: { type: "string", required: true },
      version: { type: "string", required: true },
      scope: { type: "string" },
    },
    async run({ args }) {
      try {
        const { db, config } = await requireInitialized(globals.stateDir);
        rollbackSkill(db, args.id, scopeOf(config, args.scope), Number(args.version));
        db.close();
        emit({ id: args.id, version: args.version }, globals.outputFormat, `Rolled back ${args.id} to ${args.version}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
