#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import type { CliGlobals } from "./context.ts";
import { initCommand } from "./commands/init.ts";
import { doctorCommand } from "./commands/doctor.ts";
import { inspectCommand } from "./commands/inspect.ts";
import { runCommand } from "./commands/run.ts";
import { capabilitiesCommand } from "./commands/capabilities.ts";
import { invokeCommand } from "./commands/invoke.ts";
import { jobsCommand } from "./commands/jobs.ts";
import { discordCommand } from "./commands/discord.ts";
import { telegramCommand } from "./commands/telegram.ts";
import { routesCommand } from "./commands/routes.ts";
import { setupCommand } from "./commands/setup.ts";
import { connectCommand } from "./commands/connect.ts";
import { backupCommand, restoreCommand } from "./commands/backup.ts";
import { pauseCommand, resumeCommand, stopCommand } from "./commands/pause.ts";
import { updateCommand } from "./commands/update.ts";
import { notesCommand } from "./commands/notes.ts";
import { providersCommand } from "./commands/providers.ts";
import { integrationsCommand } from "./commands/integrations.ts";
import { authCommand } from "./commands/auth.ts";
import { configCommand } from "./commands/config.ts";
import { skillsCommand } from "./commands/skills.ts";
import { memoryCommand } from "./commands/memory.ts";
import { chatCommand } from "./commands/chat.ts";
import { sessionsCommand } from "./commands/sessions.ts";
import { sourcesCommand } from "./commands/sources.ts";
import { watchesCommand } from "./commands/watches.ts";
import { serviceCommand } from "./commands/service.ts";
import {
  loginCommand,
  logoutCommand,
  versionCommand,
  agentCommand,
} from "./commands/stubs.ts";
import { emitError } from "./output.ts";
import { KELI_VERSION } from "../version.ts";
import { parseHeadlessArgv, needsProvider } from "./parse-run-args.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import "../integrations/load.ts";

function buildGlobals(overrides: Partial<CliGlobals> = {}): CliGlobals {
  return {
    cwd: overrides.cwd ?? process.cwd(),
    stateDir: overrides.stateDir ?? process.env.KELI_STATE_DIR,
    outputFormat: overrides.outputFormat ?? "plain",
    fixture: overrides.fixture ?? false,
    fixtureEndpoint: overrides.fixtureEndpoint ?? fixtureUrlFor("model"),
  };
}

async function runHeadless(argv: string[]) {
  const parsed = parseHeadlessArgv(argv);
  if (!parsed) return false;

  const globals = buildGlobals({
    cwd: parsed.cwd,
    outputFormat: parsed.outputFormat,
    fixture: parsed.fixture,
    fixtureEndpoint: parsed.fixtureEndpoint,
  });

  if (!parsed.prompt && parsed.undo) {
    const run = runCommand(globals);
    await run.run?.({
      args: { undo: true, fixture: false },
      rawArgs: [],
      cmd: run,
      data: {},
    } as never);
    return true;
  }

  if (needsProvider(parsed) && !globals.fixture && !globals.fixtureEndpoint) {
    emitError(
      "Headless -p requires --fixture and KELI_FIXTURE_URL or --fixture-endpoint in 0.1-A",
      globals.outputFormat,
    );
  }

  const run = runCommand(globals);
  await run.run?.({
    args: {
      p: parsed.prompt,
      fixture: parsed.fixture || !!globals.fixtureEndpoint,
      undo: parsed.undo,
      "fixture-endpoint": globals.fixtureEndpoint,
    },
    rawArgs: [],
    cmd: run,
    data: {},
  } as never);
  return true;
}

function createMain(globals: CliGlobals) {
  return defineCommand({
    meta: {
      name: "keli",
      version: KELI_VERSION,
      description: "Keli — personal agent with durable scoped corrections",
    },
    subCommands: {
      init: initCommand(globals),
      doctor: doctorCommand(globals),
      inspect: inspectCommand(globals),
      run: runCommand(globals),
      chat: chatCommand(globals),
      capabilities: capabilitiesCommand(globals),
      invoke: invokeCommand(globals),
      jobs: jobsCommand(globals),
      discord: discordCommand(globals),
      telegram: telegramCommand(globals),
      routes: routesCommand(globals),
      setup: setupCommand(globals),
      connect: connectCommand(globals),
      backup: backupCommand(globals),
      restore: restoreCommand(globals),
      pause: pauseCommand(globals),
      resume: resumeCommand(globals),
      stop: stopCommand(globals),
      login: loginCommand(globals),
      logout: logoutCommand(globals),
      auth: authCommand(globals),
      config: configCommand(globals),
      update: updateCommand(globals),
      notes: notesCommand(globals),
      memory: memoryCommand(globals),
      skills: skillsCommand(globals),
      providers: providersCommand(globals),
      integrations: integrationsCommand(globals),
      version: versionCommand(globals),
      sessions: sessionsCommand(globals),
      sources: sourcesCommand(globals),
      watches: watchesCommand(globals),
      service: serviceCommand(globals),
      agent: agentCommand(globals),
    },
  });
}

function printRootHelp() {
  console.log(`Keli ${KELI_VERSION} — personal agent`);
  console.log("");
  console.log("Commands:");
  console.log("  keli init              Initialize state");
  console.log("  keli setup             Connect one conversation model, then chat");
  console.log("  keli connect           Optional integrations (search, browser, memory, MCP, …)");
  console.log("  keli doctor            Health checks");
  console.log("  keli chat              Research chat with cited evidence and corrections");
  console.log("  keli sources           add | index | list | search (read-only collections)");
  console.log("  keli watches           import | list | approve | tick (heartbeat)");
  console.log("  keli discord poll      Receive → converse → reply on bound routes");
  console.log("  keli telegram poll     Receive → converse → reply on bound chats");
  console.log("  keli service run       Jobs + watches + transport poll");
  console.log("  keli update --mode     off | notify | auto (daily, idle boundary)");
  console.log("  keli integrations      list | discover");
  console.log("  keli auth              add | list | status | remove");
  console.log("  keli -p \"...\" --fixture  Headless one-shot");
  console.log("  keli version           Version info");
  console.log("");
  console.log("Run `keli <command> --help` for details.");
}

const rawArgs = process.argv.slice(2);

if (await runHeadless(rawArgs)) {
  // headless turn handled
} else if (rawArgs.length === 0) {
  printRootHelp();
} else {
  runMain(createMain(buildGlobals()));
}
