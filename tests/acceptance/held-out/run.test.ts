import { describe, expect, test } from "bun:test";
import { parsePrompt, isAmbiguousCorrection, isUntrustedInstruction } from "../../../src/core/correction.ts";
import { HELD_OUT_CASES } from "./cases.ts";

function classify(input: string): string {
  if (isUntrustedInstruction(input)) return "blocked";
  if (isAmbiguousCorrection(input)) return "blocked";
  const parsed = parsePrompt(input);
  return parsed.kind;
}

describe("held-out correction fixture suite", () => {
  test("has at least 100 cases", () => {
    expect(HELD_OUT_CASES.length).toBeGreaterThanOrEqual(100);
  });

  test("fixture pass rate report", () => {
    const failures: string[] = [];
    for (const case_ of HELD_OUT_CASES) {
      const actual = classify(case_.input);
      if (actual !== case_.expect) {
        failures.push(`${case_.id}: expected ${case_.expect}, got ${actual} for "${case_.input}"`);
      }
    }
    const passRate = ((HELD_OUT_CASES.length - failures.length) / HELD_OUT_CASES.length) * 100;
    console.log(
      `held-out fixture pass rate: ${passRate.toFixed(1)}% (${HELD_OUT_CASES.length - failures.length}/${HELD_OUT_CASES.length})`,
    );
    if (failures.length > 0) {
      console.log(failures.slice(0, 5).join("\n"));
    }
    expect(passRate).toBeGreaterThanOrEqual(95);
  });
});
