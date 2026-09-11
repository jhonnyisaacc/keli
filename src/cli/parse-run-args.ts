export type ParsedRunArgs = {
  prompt?: string;
  undo: boolean;
  fixture: boolean;
  fixtureEndpoint?: string;
  outputFormat: "plain" | "json";
  cwd?: string;
};

/** Parse shared run flags from argv tail (after optional headless prompt). */
export function parseRunFlags(argv: string[]): Omit<ParsedRunArgs, "prompt"> {
  let fixture = false;
  let fixtureEndpoint: string | undefined = process.env.KELI_FIXTURE_URL;
  let outputFormat: "plain" | "json" = "plain";
  let cwd: string | undefined;
  let undo = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--fixture") {
      fixture = true;
      i += 1;
    } else if (arg === "--fixture-endpoint") {
      fixtureEndpoint = argv[i + 1];
      i += 2;
    } else if (arg === "--output-format" || arg === "-output-format") {
      outputFormat = argv[i + 1] === "json" ? "json" : "plain";
      i += 2;
    } else if (arg === "--cwd") {
      cwd = argv[i + 1];
      i += 2;
    } else if (arg === "--undo") {
      undo = true;
      i += 1;
    } else {
      i += 1;
    }
  }

  return { undo, fixture, fixtureEndpoint, outputFormat, cwd };
}

/** Parse `keli -p "..." [flags]` headless invocation. */
export function parseHeadlessArgv(argv: string[]): ParsedRunArgs | null {
  if (argv.length === 0) return null;

  let prompt: string | undefined;
  let rest: string[];

  if (argv[0] === "-p" || argv[0] === "--prompt") {
    prompt = argv[1];
    rest = argv.slice(2);
  } else if (argv[0].startsWith("-p") && argv[0].length > 2) {
    prompt = argv[0].slice(2);
    rest = argv.slice(1);
  } else {
    return null;
  }

  if (prompt === undefined && !rest.includes("--undo")) return null;
  if (prompt === undefined && rest.includes("--undo")) {
    return { prompt: undefined, ...parseRunFlags(rest) };
  }
  if (prompt === "" && !rest.includes("--undo")) return null;

  const flags = parseRunFlags(rest);
  return { prompt, ...flags };
}

export function needsProvider(args: ParsedRunArgs): boolean {
  if (args.undo) return false;
  return true;
}
