import type { CapabilityDescriptor } from "./types.ts";
import { KeliError } from "../core/errors.ts";

export function validateCapabilityInput(
  descriptor: CapabilityDescriptor,
  input: Record<string, unknown>,
): void {
  const required = descriptor.schema.required;
  if (!Array.isArray(required)) return;

  for (const key of required) {
    if (typeof key !== "string") continue;
    const value = input[key];
    if (value === undefined || value === null) {
      throw new KeliError(
        `Capability '${descriptor.id}' requires field '${key}'`,
        "invalid_request",
      );
    }
    if (typeof value === "string" && value.length === 0) {
      throw new KeliError(
        `Capability '${descriptor.id}' requires non-empty field '${key}'`,
        "invalid_request",
      );
    }
  }
}
