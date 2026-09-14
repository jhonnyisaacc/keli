# ChatGPT account connection: corrected boundary

The earlier conclusion that ChatGPT accounts cannot power Keli conversation was too
broad. A live request and the actual Keli CLI conversation now work with a ChatGPT
account. App Server and inference transport are different integration choices.

## Adopted implementation

- ADOPT `@mariozechner/pi-ai` **0.73.1**, MIT, for Codex Responses inference and
  independent ChatGPT OAuth login/refresh. This is the model library only: no Pi
  coding-agent runtime, tool executor, or canonical state store.
- ADOPT `proper-lockfile` **4.1.2**, MIT, to serialize refresh of Keli-owned sessions
  across processes. Refresh credentials stay in Keli's OS credential store.
- ADAPT the separation between account authentication and model transport observed
  in Hermes **93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544**, MIT:
  `hermes_cli/auth_codex.py`, `agent/transports/codex.py`, and
  `hermes_cli/provider_catalog.py`. Hermes also offers a distinct App Server runtime;
  importing that runtime is not required to obtain a model response.
- BUILD the small adapter to Keli's existing `ChatModelProvider` / `ModelProvider`,
  configuration, usage accounting, and credential-reference interfaces.
- Traces: I8, A01–A02, A25, A35. No gate ownership or database schema change.

The adopted provider uses the Codex backend protocol implemented by pi-ai. This is
third-party account compatibility, not a claim that ChatGPT subscriptions include
OpenAI Platform API credits or a public chat-completions API. Account/model support
can change; a live inference probe is the evidence of compatibility.

## Connection modes

`keli auth add chatgpt` uses pi-ai's browser OAuth flow and stores an independent
session in the OS credential store. Unlock that store before login. Refresh is
serialized and persisted before the new access token is used. Browser/manual
callback completion requires the owner's participation; it was not newly exercised
in this session.

`keli auth add chatgpt --type external-cli` explicitly links an existing Codex login.
Keli reads its unexpired access token without copying or rotating the refresh token
or changing Codex's files. When that session expires, renew it with Codex or choose
an independent Keli login. Removing Keli's link does not log Codex out.

Then select the conversation provider:

```sh
keli config set providers.primary.id chatgpt
keli config set providers.primary.model gpt-5.5
keli chat --message 'Hello Keli'
```

Interactive setup also offers account login when ChatGPT is selected. The provider
probe makes a real bounded inference request; finding credentials alone is not a
successful connection. Explicit model IDs are retained, never silently substituted.
The pinned library catalog is not an account entitlement list.

## Authority

Every inference request supplies an empty native tool list. Keli receives text or
JSON proposals and sends any requested action through its existing conversation
validation and capability gate. Unexpected native tool calls and incomplete answers
are rejected. No Codex/Pi agent process is spawned for ordinary conversation.

Codex App Server remains a separate coding delegate integration. Its child claiming
completion still does not prove verification. The earlier App Server delegate
implementation has not been live-validated by this account-connection work.

## Evidence

See [live account results](LIVE_ACCOUNT_RESULTS.md) for the executed conversation,
retrieval, correction, restart, and responsibility checks. Account tokens, wallet
identifiers, holdings, and personal paths are excluded from repository evidence.
