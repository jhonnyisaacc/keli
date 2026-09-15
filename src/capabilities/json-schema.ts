/** Bounded JSON Schema checks for MCP tool arguments. No $ref / allOf / oneOf. */

export type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  required?: string[];
  properties?: Record<string, unknown>;
  additionalProperties?: boolean | JsonSchema;
  items?: unknown;
  additionalItems?: boolean | JsonSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function issue(path: string, message: string): string {
  return path ? `'${path}' ${message}` : message;
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    default:
      return true;
  }
}

/** Returns a short error phrase, or null when `value` satisfies `schema`. */
export function validateJsonSchema(schema: unknown, value: unknown, path = ""): string | null {
  if (schema === true) return null;
  if (schema === false) return issue(path, "does not match the schema");
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return null;
  const s = schema as JsonSchema;

  if ("const" in s) {
    if (!jsonEqual(value, s.const)) return issue(path, `must equal ${JSON.stringify(s.const)}`);
  }
  if (s.enum) {
    if (!s.enum.some((allowed) => jsonEqual(value, allowed))) {
      return issue(path, `must be one of ${s.enum.map((item) => JSON.stringify(item)).join(", ")}`);
    }
  }
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((type) => matchesType(type, value))) {
      return issue(path, `must be ${types.join(" or ")}`);
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of s.required ?? []) {
      if (!(key in obj) || obj[key] === undefined) {
        return path ? issue(path, `is missing required property '${key}'`) : `is missing required argument '${key}'`;
      }
    }
    const props = s.properties ?? {};
    for (const [key, propSchema] of Object.entries(props)) {
      if (key in obj && obj[key] !== undefined) {
        const nested = validateJsonSchema(propSchema, obj[key], joinPath(path, key));
        if (nested) return nested;
      }
    }
    if (s.additionalProperties !== undefined) {
      for (const key of Object.keys(obj)) {
        if (key in props) continue;
        if (s.additionalProperties === false) {
          return path ? issue(path, `does not allow additional property '${key}'`) : `does not allow additional argument '${key}'`;
        }
        if (s.additionalProperties !== true) {
          const nested = validateJsonSchema(s.additionalProperties, obj[key], joinPath(path, key));
          if (nested) return nested;
        }
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof s.minItems === "number" && value.length < s.minItems) {
      return issue(path, `must have at least ${s.minItems} items`);
    }
    if (typeof s.maxItems === "number" && value.length > s.maxItems) {
      return issue(path, `must have at most ${s.maxItems} items`);
    }
    if (s.items !== undefined) {
      if (Array.isArray(s.items)) {
        for (let i = 0; i < s.items.length && i < value.length; i++) {
          const nested = validateJsonSchema(s.items[i], value[i], `${path}[${i}]`);
          if (nested) return nested;
        }
        if (value.length > s.items.length) {
          if (s.additionalItems === false) return issue(path, "has too many items");
          if (s.additionalItems && s.additionalItems !== true) {
            for (let i = s.items.length; i < value.length; i++) {
              const nested = validateJsonSchema(s.additionalItems, value[i], `${path}[${i}]`);
              if (nested) return nested;
            }
          }
        }
      } else {
        for (let i = 0; i < value.length; i++) {
          const nested = validateJsonSchema(s.items, value[i], path ? `${path}[${i}]` : `[${i}]`);
          if (nested) return nested;
        }
      }
    }
  }

  if (typeof value === "string") {
    if (typeof s.minLength === "number" && value.length < s.minLength) {
      return issue(path, `must be at least ${s.minLength} characters`);
    }
    if (typeof s.maxLength === "number" && value.length > s.maxLength) {
      return issue(path, `must be at most ${s.maxLength} characters`);
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (typeof s.minimum === "number" && value < s.minimum) return issue(path, `must be >= ${s.minimum}`);
    if (typeof s.maximum === "number" && value > s.maximum) return issue(path, `must be <= ${s.maximum}`);
  }
  return null;
}
