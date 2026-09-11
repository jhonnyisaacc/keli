export type OutputFormat = "plain" | "json";

export function emit(
  data: unknown,
  format: OutputFormat,
  plain?: string,
): void {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  console.log(plain ?? (typeof data === "string" ? data : JSON.stringify(data)));
}

export function emitError(message: string, format: OutputFormat, code = 1): never {
  if (format === "json") {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`error: ${message}`);
  }
  process.exit(code);
  throw new Error(message);
}
