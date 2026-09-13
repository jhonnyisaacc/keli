import type { CapabilityResult } from "../capabilities/types.ts";
import { KeliError } from "../core/errors.ts";
import { fixtureUrlFor } from "../integrations/env.ts";

export async function searchQuery(
  input: { query: string },
  fixtureUrl?: string,
): Promise<CapabilityResult> {
  const url = fixtureUrl ?? fixtureUrlFor("search");
  if (!url) {
    return {
      capabilityId: "search.query",
      ok: false,
      error: {
        code: "capability_unavailable",
        message: "Search requires a resolved search integration or KELI_FIXTURE_SEARCH",
      },
    };
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: input.query }),
    });
    if (!response.ok) {
      throw new KeliError(`Search fixture HTTP ${response.status}`, "engine_error");
    }
    const payload = (await response.json()) as { results: { title: string; url: string }[] };
    return {
      capabilityId: "search.query",
      ok: true,
      output: payload,
    };
  } catch (e) {
    const keli = e instanceof KeliError ? e : null;
    return {
      capabilityId: "search.query",
      ok: false,
      error: {
        code: keli?.code ?? "unknown",
        message: keli?.message ?? String(e),
      },
    };
  }
}
