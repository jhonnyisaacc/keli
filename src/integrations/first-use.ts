/** Providers offered on first setup. Catalog ids remain valid when typed explicitly. */
export const FIRST_USE_PROVIDERS = ["chatgpt", "openai-compatible", "anthropic", "grok"] as const;

export type FirstUseProvider = (typeof FIRST_USE_PROVIDERS)[number];

export const FIRST_USE_STATUS_IDS = [
  ...FIRST_USE_PROVIDERS,
  "search",
  "discord",
  "telegram",
] as const;
