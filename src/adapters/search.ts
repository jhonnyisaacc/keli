import type { CapabilityResult } from "../capabilities/types.ts";
import { KeliError } from "../core/errors.ts";

export async function searchQuery(
  input: { query: string },
  fixtureUrl?: string,
): Promise<CapabilityResult> {
  if (!fixtureUrl) {
    return {
      capabilityId: "search.query",
      ok: false,
      error: {
        code: "capability_unavailable",
        message: "Search requires KELI_SEARCH_FIXTURE_URL or configured search backend",
      },
    };
  }

  try {
    const response = await fetch(`${fixtureUrl.replace(/\/$/, "")}/search`, {
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
