import { readSilentLine } from "./io.ts";

/** Terminal editing without echoing secret characters or adding them to shell history. */
export async function promptSecret(prompt: string): Promise<string> {
  return readSilentLine(`${prompt.endsWith("\n") ? prompt : `\n${prompt}`}`);
}
