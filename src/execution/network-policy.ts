import { KeliError } from "../core/errors.ts";

export type NetworkPolicy = {
  allowedHosts: string[];
};

export function assertAllowedHost(policy: NetworkPolicy, url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new KeliError(`Invalid URL: ${url}`, "invalid_request");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new KeliError(`Unsupported URL scheme: ${parsed.protocol}`, "capability_denied");
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = policy.allowedHosts.map((h) => h.toLowerCase());
  if (!allowed.includes(host)) {
    throw new KeliError(`Host not allowed: ${host}`, "capability_denied");
  }
  return parsed;
}
