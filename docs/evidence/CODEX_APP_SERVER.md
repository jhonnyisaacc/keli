# Codex App Server behind Keli’s provider boundary

Inspected: [Codex App Server](https://learn.chatgpt.com/docs/app-server) (2026-09-14).
Implementation: `openai/codex` `codex-rs/app-server`, Apache-2.0. Transport:
JSON-RPC 2.0 over stdio (default), experimental WebSocket, or Unix socket.

## What the protocol is

App-server is the interface Codex uses to power rich clients. After `initialize` /
`initialized`, clients start **threads** and **turns**. The server streams agent
events, runs tools, hosts approvals, MCP servers, and conversation history.

ChatGPT authentication is first-class:

- `account/login/start` with `type: "chatgpt"` (browser) or `"chatgptDeviceCode"`
- Codex **owns** the OAuth flow, persists tokens, and refreshes them
- `chatgptAuthTokens` is experimental and requires the **host** to already possess
  ChatGPT tokens (`capabilities.experimentalApi = true`)

## Required Keli constraint

Keli’s provider boundary: a model returns **proposals**. `CapabilityGate` /
`GateService` authorize every consequential dispatch. Adapters must not execute
ambient host effects or write canonical state.

## Precise incompatibility (conversation model)

Codex App Server ChatGPT login authenticates a **Codex agent process** that owns
tool execution, approvals, and thread history. There is no documented
inference-only or proposal-only method that yields ChatGPT-authenticated chat
completions for Keli’s `HttpModelProvider`.

Using `thread/start` + `turn/start` as ordinary conversation would let Codex
execute tools outside Keli’s gate. Extracting ChatGPT tokens from Codex’s store
to call OpenAI chat completions is not a documented app-server API.
`chatgptAuthTokens` is the reverse direction (host → Codex).

Therefore **ChatGPT-account cannot be claimed as a Keli conversation-model
onboarding path** without either substituting API-key setup (forbidden) or
surrendering authorization to Codex (forbidden).

`keli auth add chatgpt --type oauth-device` must report this incompatibility. It
must not silently store an API key.

## What is adopted (coding delegate only)

Codex App Server **is** usable as the Codex **coding delegate** (`delegate.run`)
after the capability gate authorizes the handoff:

1. Keli prepares/authorizes `delegate.run` with workspace, goal, budget, cancel epoch.
2. Spawn `codex app-server` (stdio) with that workspace as cwd; owned process.
3. `initialize` / `initialized`, then `thread/start` + `turn/start` with the goal.
4. Map `turn/completed` / errors to a delegate receipt. Artifacts/tests still
   required before `verified` (A24). A child saying complete is not success.
5. ChatGPT device-code login, if used, authenticates **that Codex process**, not
   Keli conversation.

Ordinary chat remains OpenAI-compatible or Grok API-key (or fixture). Codex
ChatGPT login is optional delegate setup, not the conversation provider.

## Tests

See `tests/unit/codex-app-server.test.ts`: fixture stdio JSON-RPC; unauthorized
spawn is not performed; conversation profile reports `unsupported`.
