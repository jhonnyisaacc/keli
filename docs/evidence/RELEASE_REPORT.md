# Release report (feat/v0.1.0 completion pass)

Historical report for the earlier pass. ChatGPT incompatibility and no-live-model statements below are superseded by [live account results](LIVE_ACCOUNT_RESULTS.md).

Baseline: `d9e51d2`. Plan: [general-purpose-autonomy.md](../../plans/general-purpose-autonomy.md).
Ledger: [COMPLETION_LEDGER.md](COMPLETION_LEDGER.md).

This report does **not** tag `v0.1.0`. `bun test` at this pass: **245 pass**, 1
platform skip, 0 fail (temporary `KELI_STATE_DIR`). That is a regression baseline,
not live portfolio quality or product readiness.

## Adopted

- Discord REST v10 (existing) plus Nanobot-adapted reconnect backoff on poll loops.
- Telegram Bot API getUpdates / sendMessage / getMe, wired to Keli inbox, routes, and outbox.
- MCP JSON-RPC 2024-11-05 over HTTP and owned stdio (fixture `/mcp` preserved).
- Generic search HTTP and Brave Search request shape (Hermes backend protocol).
- Codex App Server JSON-RPC as a **coding delegate** only.
- systemd user unit and launchd plist templates.

Hermes `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` MIT and Nanobot
`f49965445152361b779b465e8a5111549ac934c4` MIT were inspected. Their Python
channel runtimes were not imported.

## Newly developed (Keli-owned)

- Neutral default project name `personal`; existing names preserved. Rocket is not a product default.
- ChatGPT conversation-model **incompatibility** (not a silent API-key substitute):
  [CODEX_APP_SERVER.md](CODEX_APP_SERVER.md).
- `keli service run` composing existing job, watch, and transport ticks.
- Setup `providerConnected` from a bounded live probe.

Responsibility controller was **not** rewritten. Scripted cross-domain scenarios remain
the evaluation harness.

## Implemented and fixture-verified

Telegram REST mock, Telegram conversation cycle, reconnect backoff, search/MCP without
fixture env, MCP stdio, Codex app-server stdio fixture (completion stays `unverified`),
ChatGPT auth refusal, init/setup project name, service unit install, existing
responsibility scenarios.

## Verified with a real integration and model

Not in this pass unless the operator's environment already has tokens/binaries.
Attempted at report time: `ROCKET_BIN` unset; no OpenAI/xAI/Telegram/Discord tokens in
the environment. `codex` is on PATH but was not logged in or spawned (would be a live
ChatGPT/device-code session). Live usefulness therefore remains awaiting owner
credentials and a pinned Rocket binary.

## Awaiting owner sign-in, external access, or native hardware

- Live Discord/Telegram bot pairing and delivery receipts
- ChatGPT-account conversation (blocked by app-server incompatibility; needs a
  proposal-only ChatGPT inference API if OpenAI documents one)
- Live Codex app-server with ChatGPT device-code (delegate only)
- Live Rocket CLI pin (`ROCKET_BIN` / `ROCKET_STATE_DIR`)
- Live OpenAI-compatible / Grok onboarding round-trip
- Four-target native smoke, macOS notarization, five-user checklist, live held-out ≥95%

## Evaluation note

The three scenarios (portfolio/Rocket fixture, Augustine/Shaul, maintenance) continue to
run through `tests/integration/responsibility-scenarios.test.ts` on the same controller.
No listed research-paper failure (lost evidence, lost commitment after compaction,
no-progress loops, unsupported completion, confident invention) was newly exposed by
those fixtures, so no additional paper was opened.

Live Rocket and live-model usefulness remain **awaiting** private binaries and keys.
