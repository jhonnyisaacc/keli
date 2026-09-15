import { describe, expect, test } from "bun:test";
import { validateJsonSchema } from "../../src/capabilities/json-schema.ts";
import { validateMcpToolCall, type McpToolSchema } from "../../src/adapters/mcp.ts";

const echo: McpToolSchema[] = [
  {
    name: "echo",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" }, count: { type: "integer" } },
      required: ["text"],
      additionalProperties: false,
    },
  },
];

describe("JSON Schema subset", () => {
  test("accepts valid objects and rejects wrong property types", () => {
    expect(validateJsonSchema({ type: "object", properties: { n: { type: "integer" } } }, { n: 2 })).toBeNull();
    expect(validateJsonSchema({ type: "object", properties: { n: { type: "integer" } } }, { n: 1.5 })).toContain("integer");
    expect(validateJsonSchema({ type: "number" }, Number.NaN)).toContain("number");
  });

  test("enforces enum, const, additionalProperties, and array items", () => {
    expect(validateJsonSchema({ enum: ["a", "b"] }, "a")).toBeNull();
    expect(validateJsonSchema({ enum: ["a", "b"] }, "c")).toContain("one of");
    expect(validateJsonSchema({ const: 3 }, 3)).toBeNull();
    expect(validateJsonSchema({ const: 3 }, 4)).toContain("equal");
    expect(
      validateJsonSchema({ type: "object", properties: { id: { type: "string" } }, additionalProperties: false }, { id: "x", extra: 1 }),
    ).toContain("additional");
    expect(validateJsonSchema({ type: "array", items: { type: "string" } }, ["ok"])).toBeNull();
    expect(validateJsonSchema({ type: "array", items: { type: "string" } }, [1])).toContain("string");
  });

  test("type unions and nested properties", () => {
    expect(validateJsonSchema({ type: ["string", "null"] }, null)).toBeNull();
    expect(validateJsonSchema({ type: ["string", "null"] }, 1)).toContain("string or null");
    expect(
      validateJsonSchema(
        { type: "object", properties: { child: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] } } },
        { child: { ok: true } },
      ),
    ).toBeNull();
    expect(
      validateJsonSchema(
        { type: "object", properties: { child: { type: "object", required: ["ok"] } } },
        { child: {} },
      ),
    ).toContain("ok");
  });
});

describe("MCP tool argument schema", () => {
  test("still rejects unknown names and missing required keys", () => {
    expect(validateMcpToolCall(echo, "missing", {})?.error?.message).toMatch(/Unknown MCP tool/);
    expect(validateMcpToolCall(echo, "echo", {})?.error?.message).toMatch(/missing required argument 'text'/);
    expect(validateMcpToolCall(echo, "echo", { text: "hi" })).toBeNull();
  });

  test("rejects wrong types, extra properties, and enum mismatches", () => {
    expect(validateMcpToolCall(echo, "echo", { text: 1 })?.error?.message).toMatch(/must be string/);
    expect(validateMcpToolCall(echo, "echo", { text: "hi", extra: true })?.error?.message).toMatch(/additional argument 'extra'/);
    const typed: McpToolSchema[] = [
      {
        name: "mode",
        inputSchema: {
          type: "object",
          properties: { mode: { type: "string", enum: ["fast", "slow"] } },
          required: ["mode"],
        },
      },
    ];
    expect(validateMcpToolCall(typed, "mode", { mode: "fast" })).toBeNull();
    expect(validateMcpToolCall(typed, "mode", { mode: "other" })?.error?.message).toMatch(/one of/);
  });
});
