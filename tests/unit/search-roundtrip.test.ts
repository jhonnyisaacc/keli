import { describe, expect, test } from "bun:test";
import { searchProfile } from "../../src/integrations/profiles/search/fixture.ts";

describe("search live probe", () => {
  test("Brave does not pass on a credential ref without making a request", async () => {
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("no", { status: 500 });
    }) as unknown as typeof fetch;
    try {
      const missingKey = await searchProfile.roundTrip!({
        settings: { baseUrl: "https://api.search.brave.com" },
        credentialRef: { service: "keli/search", id: "api-key" },
      });
      expect(missingKey.ok).toBe(false);
      expect(missingKey.failure).toBe("not-configured");
      expect(calls).toBe(0);

      const live = await searchProfile.roundTrip!({
        settings: { baseUrl: "https://api.search.brave.com" },
        credential: "brave-key",
        credentialRef: { service: "keli/search", id: "api-key" },
      });
      expect(live.ok).toBe(false);
      expect(calls).toBe(1);
      expect(live.failure).toBe("transport");
    } finally {
      globalThis.fetch = original;
    }
  });
});
