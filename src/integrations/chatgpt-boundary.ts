/**
 * ChatGPT-account onboarding is a PRD requirement. Codex App Server implements
 * ChatGPT OAuth, but that authenticates a Codex *agent*, not a Keli proposal-only
 * model. See docs/evidence/CODEX_APP_SERVER.md.
 */
export const CHATGPT_CONVERSATION_INCOMPATIBLE =
  "ChatGPT-account login via Codex App Server authenticates a Codex agent that executes tools, approvals, and thread history. Keli's provider boundary requires proposal-only inference gated by CapabilityGate. App-server has no documented chat-completions or proposal-only method. Keli will not claim ChatGPT as a conversation model and will not silently substitute an API key. Use keli auth add openai-compatible (or grok) for chat. Optional: keli auth add codex --type oauth-device authenticates the coding delegate only.";

export function chatgptConversationIncompatibility(): string {
  return CHATGPT_CONVERSATION_INCOMPATIBLE;
}
