import { describe, expect, test } from "bun:test";
import { parseHeadlessArgv, needsProvider } from "../../src/cli/parse-run-args.ts";

describe("parseHeadlessArgv", () => {
  test("parses --undo with empty -p prompt", () => {
    const parsed = parseHeadlessArgv(["-p", "", "--undo"]);
    expect(parsed?.undo).toBe(true);
    expect(parsed?.prompt).toBe("");

    expect(parseHeadlessArgv(["--undo"])).toBeNull();
  });

  test("parses -p with --undo flag", () => {
    const parsed = parseHeadlessArgv([
      "-p",
      "ignored when undo",
      "--undo",
      "--fixture",
    ]);
    expect(parsed?.undo).toBe(true);
    expect(parsed?.fixture).toBe(true);
    expect(parsed?.prompt).toBe("ignored when undo");
  });

  test("headless undo-only via keli run is not headless argv", () => {
    expect(parseHeadlessArgv(["run", "--undo"])).toBeNull();
  });

  test("needsProvider false for undo-only", () => {
    expect(
      needsProvider({
        undo: true,
        fixture: false,
        outputFormat: "plain",
      }),
    ).toBe(false);
  });

  test("needsProvider false when undo is set even with prompt", () => {
    expect(
      needsProvider({
        undo: true,
        prompt: "ignored",
        fixture: false,
        outputFormat: "plain",
      }),
    ).toBe(false);
  });
});
