import { KeliError } from "../core/errors.ts";

export type NormalizedProviderError = {
  code: string;
  message: string;
  retryable: boolean;
};

export function normalizeProviderFailure(
  status: number,
  body?: string,
): NormalizedProviderError {
  if (status === 401 || status === 403) {
    return { code: "auth", message: "Provider authentication failed", retryable: false };
  }
  if (status === 429) {
    return { code: "quota", message: "Provider rate limit exceeded", retryable: true };
  }
  if (status >= 500) {
    return { code: "transport", message: `Provider HTTP ${status}`, retryable: true };
  }
  return {
    code: "invalid_request",
    message: body?.slice(0, 512) ?? `Provider HTTP ${status}`,
    retryable: false,
  };
}

export function providerErrorToKeli(error: NormalizedProviderError): KeliError {
  const code =
    error.code === "auth"
      ? "invalid_request"
      : error.code === "quota"
        ? "engine_error"
        : error.code === "transport"
          ? "engine_error"
          : "engine_error";
  return new KeliError(error.message, code, error.retryable);
}
