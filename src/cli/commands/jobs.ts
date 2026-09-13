import { defineCommand } from "citty";
import { requireInitialized } from "../../state/init.ts";
import { projectScope, getProjectById } from "../../state/repos.ts";
import { createJob, listJobs, pinJobSkill, setJobStatus } from "../../jobs/store.ts";
import { listOccurrences } from "../../jobs/occurrences.ts";
import { tickScheduler } from "../../jobs/scheduler.ts";
import { createJobTickContext } from "../../jobs/tick-context.ts";
import { parseSchedule } from "../../jobs/schedule.ts";
import { emit, emitError } from "../output.ts";
import type { CliGlobals } from "../context.ts";

export function jobsCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Durable jobs and scheduled triggers" },
    subCommands: {
      list: jobsListCommand(globals),
      add: jobsAddCommand(globals),
      tick: jobsTickCommand(globals),
      occurrences: jobsOccurrencesCommand(globals),
      pause: jobsPauseCommand(globals),
      "pin-skill": jobsPinSkillCommand(globals),
    },
  });
}

function jobsListCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List jobs" },
    async run() {
      try {
        const { db } = await requireInitialized(globals.stateDir);
        const jobs = listJobs(db);
        db.close();
        emit({ jobs }, globals.outputFormat, jobs.length ? undefined : "No jobs scheduled yet.");
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function jobsAddCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Add a recurring job" },
    args: {
      name: { type: "string", required: true, description: "Job name" },
      schedule: {
        type: "string",
        required: true,
        description: "every:<n>s|m|h or daily:HH:MM (UTC)",
      },
    },
    async run({ args }) {
      try {
        parseSchedule(args.schedule);
        const { db, config, owner } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) throw new Error("Default project missing");
        const scope = projectScope(project.id);
        const job = createJob(db, {
          id: crypto.randomUUID(),
          ownerId: owner.id,
          scope,
          name: args.name,
          schedule: args.schedule,
          status: "active",
        });
        db.close();
        emit(job, globals.outputFormat, `Created job ${job.name} (${job.schedule})`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function jobsTickCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Run scheduler tick (materialize due occurrences)" },
    async run() {
      try {
        const { db, owner, config, stateDir } = await requireInitialized(globals.stateDir);
        const project = getProjectById(db, config.defaultProjectId);
        if (!project) throw new Error("Default project missing");
        const roots = JSON.parse(project.resource_roots_json) as string[];
        const ctx = createJobTickContext({
          db,
          ownerId: owner.id,
          stateDir,
          policy: { readableRoots: roots, writableRoots: roots },
        });
        const result = await tickScheduler(db, ctx);
        db.close();
        emit(result, globals.outputFormat, `Tick: ${result.materialized.length} occurrence(s) materialized`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function jobsOccurrencesCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "List job occurrences" },
    args: {
      job: { type: "string", description: "Filter by job id" },
    },
    async run({ args }) {
      try {
        const { db } = await requireInitialized(globals.stateDir);
        const occurrences = listOccurrences(db, args.job);
        db.close();
        emit({ occurrences }, globals.outputFormat);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function jobsPinSkillCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Pin a skill version to a job (A28)" },
    args: {
      job: { type: "string", required: true },
      skill: { type: "string", required: true },
      version: { type: "string", required: true },
    },
    async run({ args }) {
      try {
        const { db } = await requireInitialized(globals.stateDir);
        pinJobSkill(db, args.job, args.skill, Number(args.version));
        db.close();
        emit(
          { jobId: args.job, skillId: args.skill, version: args.version },
          globals.outputFormat,
          `Pinned ${args.skill}@${args.version} to job ${args.job}`,
        );
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}

function jobsPauseCommand(globals: CliGlobals) {
  return defineCommand({
    meta: { description: "Pause a job" },
    args: {
      id: { type: "positional", required: true, description: "Job id" },
    },
    async run({ args }) {
      try {
        const { db } = await requireInitialized(globals.stateDir);
        setJobStatus(db, args.id, "paused");
        db.close();
        emit({ id: args.id, status: "paused" }, globals.outputFormat, `Paused job ${args.id}`);
      } catch (e) {
        emitError(String(e), globals.outputFormat);
      }
    },
  });
}
