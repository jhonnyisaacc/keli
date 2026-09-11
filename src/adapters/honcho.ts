import { KeliError } from "../core/errors.ts";

export type HonchoStoreInput = {
  scope: string;
  key: string;
  content: string;
};

export type HonchoQueryInput = {
  scope: string;
  query: string;
};

export type HonchoResult = {
  ok: boolean;
  records?: Array<{ key: string; content: string }>;
  error?: { code: string; message: string };
};

export type HonchoAdapterConfig = {
  fixtureUrl?: string;
  enabled?: boolean;
};

export function honchoConfigFromEnv(): HonchoAdapterConfig {
  return {
    fixtureUrl: process.env.KELI_HONCHO_FIXTURE_URL,
    enabled: process.env.KELI_HONCHO_ENABLED === "1",
  };
}

export function isHonchoAvailable(config: HonchoAdapterConfig = honchoConfigFromEnv()): boolean {
  return Boolean(config.enabled && config.fixtureUrl);
}

export async function honchoStore(
  input: HonchoStoreInput,
  config: HonchoAdapterConfig = honchoConfigFromEnv(),
): Promise<HonchoResult> {
  if (!config.enabled) {
    return { ok: false, error: { code: "honcho_disabled", message: "Honcho adapter disabled" } };
  }
  const url = config.fixtureUrl;
  if (!url) {
    return { ok: false, error: { code: "honcho_unavailable", message: "Honcho not configured" } };
  }
  return honchoFixtureCall(url, "store", input);
}

export async function honchoQuery(
  input: HonchoQueryInput,
  config: HonchoAdapterConfig = honchoConfigFromEnv(),
): Promise<HonchoResult> {
  if (!config.enabled) {
    return { ok: false, error: { code: "honcho_disabled", message: "Honcho adapter disabled" } };
  }
  const url = config.fixtureUrl;
  if (!url) {
    return { ok: false, error: { code: "honcho_unavailable", message: "Honcho not configured" } };
  }
  return honchoFixtureCall(url, "query", input);
}

export async function honchoDelete(
  scope: string,
  key: string,
  config: HonchoAdapterConfig = honchoConfigFromEnv(),
): Promise<HonchoResult> {
  if (!config.enabled) {
    return { ok: false, error: { code: "honcho_disabled", message: "Honcho adapter disabled" } };
  }
  const url = config.fixtureUrl;
  if (!url) {
    return { ok: false, error: { code: "honcho_unavailable", message: "Honcho not configured" } };
  }
  return honchoFixtureCall(url, "delete", { scope, key });
}

async function honchoFixtureCall(
  baseUrl: string,
  op: string,
  body: Record<string, unknown>,
): Promise<HonchoResult> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/honcho/${op}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: { code: "honcho_outage", message: `Honcho fixture HTTP ${response.status}` },
      };
    }
    const payload = (await response.json()) as HonchoResult;
    return payload;
  } catch (e) {
    throw new KeliError(`Honcho request failed: ${e}`, "engine_error");
  }
}
