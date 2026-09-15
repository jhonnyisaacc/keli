/**
 * OpenCode Zen/Go/Free model id and endpoint routing, adapted from Hermes
 * `hermes_cli/models.py` (MIT, pin 93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544),
 * which follows OpenCode's published family tables. Not an OpenCode runtime.
 */

const OPENCODE_FAMILIES = ["opencode-zen", "opencode-go", "opencode-free"] as const;

export type OpencodeApiMode = "chat_completions" | "anthropic_messages" | "codex_responses";

const OPENCODE_API_MODE_PREFIXES: Record<string, Array<{ prefixes: string[]; mode: OpencodeApiMode }>> = {
  "opencode-go": [
    { prefixes: ["gpt-", "grok-", "muse-spark"], mode: "codex_responses" },
    { prefixes: ["minimax-", "qwen"], mode: "anthropic_messages" },
  ],
  "opencode-zen": [
    { prefixes: ["claude-"], mode: "anthropic_messages" },
    { prefixes: ["gpt-", "grok-", "muse-spark"], mode: "codex_responses" },
    { prefixes: ["qwen"], mode: "anthropic_messages" },
  ],
};

export function opencodeFamily(id: string): (typeof OPENCODE_FAMILIES)[number] | undefined {
  const raw = id.trim().toLowerCase();
  return OPENCODE_FAMILIES.find((family) => raw === family || raw.startsWith(`${family}-`) || raw.startsWith(family));
}

export function normalizeModelId(providerId: string, model: string | undefined): string {
  const current = (model ?? "").trim();
  if (!current) return current;
  const family = opencodeFamily(providerId);
  if (!family) return current;
  for (const prefix of [`${providerId}/`, `${family}/`]) {
    if (current.toLowerCase().startsWith(prefix.toLowerCase())) return current.slice(prefix.length);
  }
  return current;
}

export function opencodeApiMode(providerId: string, model: string | undefined): OpencodeApiMode {
  let family = opencodeFamily(providerId);
  if (family === "opencode-free") family = "opencode-zen";
  const normalized = normalizeModelId(providerId, model).toLowerCase();
  if (normalized && family) {
    for (const rule of OPENCODE_API_MODE_PREFIXES[family] ?? []) {
      if (rule.prefixes.some((prefix) => normalized.startsWith(prefix))) return rule.mode;
    }
  }
  return "chat_completions";
}

export function normalizeOpencodeBaseUrl(providerId: string, apiMode: OpencodeApiMode, baseUrl: string): string {
  const url = baseUrl.trim().replace(/\/$/, "");
  if (!url || !opencodeFamily(providerId)) return url;
  if (apiMode === "anthropic_messages") return url.replace(/\/v1$/, "");
  if (url.endsWith("/v1")) return url;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "opencode.ai" || host.endsWith(".opencode.ai")) return `${url}/v1`;
  } catch {
    /* keep */
  }
  return url;
}
