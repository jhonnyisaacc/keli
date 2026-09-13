/** Single reader for namespaced fixture/dev knobs. Legacy names stay as aliases. */

const FIXTURE_KEYS = {
  model: ["KELI_FIXTURE_MODEL", "KELI_FIXTURE_URL"],
  provider: ["KELI_FIXTURE_PROVIDER", "KELI_PROVIDER_URL"],
  grok: ["KELI_FIXTURE_GROK", "KELI_GROK_FIXTURE_URL"],
  discord: ["KELI_FIXTURE_DISCORD", "KELI_DISCORD_FIXTURE_URL"],
  telegram: ["KELI_FIXTURE_TELEGRAM", "KELI_TELEGRAM_FIXTURE_URL"],
  delegate: ["KELI_FIXTURE_DELEGATE", "KELI_DELEGATE_FIXTURE_URL"],
  browser: ["KELI_FIXTURE_BROWSER", "KELI_BROWSER_FIXTURE_URL"],
  "browser-session": ["KELI_FIXTURE_BROWSER_SESSION", "KELI_BROWSER_SESSION_FIXTURE_URL"],
  search: ["KELI_FIXTURE_SEARCH", "KELI_SEARCH_FIXTURE_URL"],
  mcp: ["KELI_FIXTURE_MCP", "KELI_MCP_FIXTURE_URL"],
  honcho: ["KELI_FIXTURE_HONCHO", "KELI_HONCHO_FIXTURE_URL"],
  "browser-cdp": ["KELI_FIXTURE_BROWSER_CDP", "KELI_BROWSER_CDP_URL"],
  "browser-mcp": ["KELI_FIXTURE_BROWSER_MCP", "KELI_BROWSER_MCP_URL"],
} as const;

export type FixtureSlot = keyof typeof FIXTURE_KEYS;

export function fixtureUrlFor(slot: FixtureSlot): string | undefined {
  for (const name of FIXTURE_KEYS[slot]) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export function fixtureEnabled(flag: "honcho"): boolean {
  if (flag === "honcho") return process.env.KELI_HONCHO_ENABLED === "1";
  return false;
}

export function preferredProviderId(): string | undefined {
  return process.env.KELI_PROVIDER_ID;
}

export function allFixtureSlots(): Record<FixtureSlot, string | undefined> {
  const out = {} as Record<FixtureSlot, string | undefined>;
  for (const slot of Object.keys(FIXTURE_KEYS) as FixtureSlot[]) {
    out[slot] = fixtureUrlFor(slot);
  }
  return out;
}
