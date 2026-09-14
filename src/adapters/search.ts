import type { CapabilityResult } from "../capabilities/types.ts";
import { KeliError } from "../core/errors.ts";
import { fixtureUrlFor } from "../integrations/env.ts";
import { defaultCredentialSource } from "../credentials/source.ts";
import { tryResolveIntegration } from "../integrations/resolve.ts";
import type { KeliConfig } from "../state/config.ts";

export type SearchQueryOptions = {
  fixtureUrl?: string;
  config?: KeliConfig | null;
  credential?: string;
};

/**
 * Search adapter. Fixture POST /search is preserved. Configured integrations ADOPT
 * generic JSON `{results:[{title,url}]}` or Brave Search `GET /res/v1/web/search`
 * (Hermes web_search backend; protocol, not Hermes Python).
 */
export async function searchQuery(
  input: { query: string },
  fixtureUrlOrOptions?: string | SearchQueryOptions,
): Promise<CapabilityResult> {
  const options: SearchQueryOptions =
    typeof fixtureUrlOrOptions === "string" ? { fixtureUrl: fixtureUrlOrOptions } : (fixtureUrlOrOptions ?? {});
  const fixture = options.fixtureUrl ?? fixtureUrlFor("search");
  if (fixture) return postSearch(fixture, input.query);

  const resolved = tryResolveIntegration("search", { config: options.config, explicitId: "search" });
  const base = resolved?.settings.baseUrl ?? resolved?.fixtureUrl;
  if (!base) {
    return {
      capabilityId: "search.query",
      ok: false,
      error: {
        code: "capability_unavailable",
        message: "Search requires a resolved search integration or KELI_FIXTURE_SEARCH",
      },
    };
  }

  let credential = options.credential;
  if (!credential && resolved?.credentialRef) {
    credential = (await defaultCredentialSource().get(resolved.credentialRef)) ?? undefined;
  }

  try {
    if (isBrave(base)) return await braveSearch(base, input.query, credential);
    return await postSearch(base, input.query, credential);
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: "search.query",
      ok: false,
      error: { code: keli?.code ?? "unknown", message: keli?.message ?? String(e) },
    };
  }
}

function isBrave(base: string): boolean {
  try {
    return new URL(base).host.includes("search.brave.com") || base.includes("/res/v1/web/search");
  } catch {
    return false;
  }
}

async function postSearch(base: string, query: string, credential?: string): Promise<CapabilityResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (credential) headers.Authorization = `Bearer ${credential}`;
  const response = await fetch(`${base.replace(/\/$/, "")}/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new KeliError(`Search HTTP ${response.status}`, "engine_error", response.status >= 500);
  const payload = (await response.json()) as { results: { title: string; url: string }[] };
  return { capabilityId: "search.query", ok: true, output: payload };
}

async function braveSearch(base: string, query: string, credential?: string): Promise<CapabilityResult> {
  const url = new URL(base.includes("/res/v1/web/search") ? base : `${base.replace(/\/$/, "")}/res/v1/web/search`);
  url.searchParams.set("q", query);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (credential) headers["X-Subscription-Token"] = credential;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (response.status === 401 || response.status === 403) {
    throw new KeliError(`Brave Search authentication failed (HTTP ${response.status})`, "needs_reauth");
  }
  if (!response.ok) throw new KeliError(`Brave Search HTTP ${response.status}`, "engine_error", response.status >= 500);
  const payload = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string }> };
  };
  const results = (payload.web?.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "" }));
  return { capabilityId: "search.query", ok: true, output: { results } };
}
