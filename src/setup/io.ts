import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type WizardIo = {
  println(line?: string): void;
  question(prompt: string): Promise<string>;
  secret(prompt: string): Promise<string>;
  close(): void;
};

/** Every prompt starts on a fresh line. Secret entry never opens a second readline. */
export function createReadlineWizardIo(
  stdin: NodeJS.ReadableStream = input,
  stdout: NodeJS.WritableStream = output,
): WizardIo {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return {
    println(line = "") {
      stdout.write(`${line}\n`);
    },
    async question(prompt: string) {
      stdout.write("\n");
      return (await rl.question(prompt)).trim();
    },
    async secret(prompt: string) {
      stdout.write("\n");
      rl.pause();
      try {
        return (await readSilentLine(prompt, stdin, stdout)).trim();
      } finally {
        rl.resume();
      }
    },
    close() {
      rl.close();
    },
  };
}

export function createScriptedWizardIo(answers: string[], lines: string[] = []): WizardIo {
  const queue = [...answers];
  return {
    println(line = "") {
      lines.push(line);
    },
    async question(prompt: string) {
      lines.push(prompt);
      const next = queue.shift();
      if (next === undefined) throw new Error(`No scripted answer for: ${prompt}`);
      return next.trim();
    },
    async secret(prompt: string) {
      lines.push(prompt);
      const next = queue.shift();
      if (next === undefined) throw new Error(`No scripted secret for: ${prompt}`);
      return next.trim();
    },
    close() {},
  };
}

export async function readSilentLine(
  prompt: string,
  stdin: NodeJS.ReadableStream = input,
  stdout: NodeJS.WritableStream = output,
): Promise<string> {
  stdout.write(prompt);
  if (!("isTTY" in stdin) || !stdin.isTTY) {
    throw new Error("Use an interactive terminal or the provider's credential environment variable");
  }
  const readable = stdin as typeof input;
  const wasRaw = readable.isRaw;
  readable.setRawMode?.(true);
  readable.resume();
  let value = "";
  try {
    for await (const chunk of readable) {
      const text = Buffer.from(chunk as Uint8Array).toString("utf8");
      if (text === "\u0003") throw new Error("Interrupted");
      if (text === "\r" || text === "\n") break;
      if (text === "\u007f" || text === "\b") {
        value = value.slice(0, -1);
        continue;
      }
      if (text === "\u0004") break;
      if (text.charCodeAt(0) >= 32) value += text;
    }
  } finally {
    readable.setRawMode?.(wasRaw ?? false);
  }
  stdout.write("\n");
  return value;
}
