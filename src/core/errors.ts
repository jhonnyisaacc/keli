export type KeliErrorCode =
  | "provider_required"
  | "capability_denied"
  | "capability_unavailable"
  | "sandbox_denied"
  | "secret_unavailable"
  | "invalid_request"
  | "engine_error"
  | "blocked"
  | "cancelled"
  | "quota_exceeded"
  | "unknown";

export class KeliError extends Error {
  constructor(
    message: string,
    readonly code: KeliErrorCode,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "KeliError";
  }
}

export function isKeliError(error: unknown): error is KeliError {
  return error instanceof KeliError;
}
