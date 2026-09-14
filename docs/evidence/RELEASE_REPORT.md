# Release report (feat/v0.1.0 bounded capability pass)

Baseline: `021ca10` plus the bounded capability slices on `feat/v0.1.0`. Plan:
[general-purpose-autonomy.md](../../plans/general-purpose-autonomy.md). Ledger:
[COMPLETION_LEDGER.md](COMPLETION_LEDGER.md). Connection guide: [providers.md](../providers.md).

This report does **not** tag `v0.1.0`. Catalog rows are not live connections. ChatGPT
gpt-5.5 remains the known live conversation path
([LIVE_ACCOUNT_RESULTS.md](LIVE_ACCOUNT_RESULTS.md)).

## User command after this work

`keli setup`

## Implemented and fixture-verified this pass

Neutral `provider-manifest.json` with protocol mapping; numbered one-session setup;
bounded inference fallback (never silent fixture); shared Brave/generic search plus
hashed web/browser artifacts; local-first memory contract (Honcho fixture-only);
documents/OCR/speech behind the gate with optional binaries; MCP `tools/list` before
`tools/call`; Copilot ACP as a distinct blocked delegate; `keli service` as lifecycle.

Contract suites: `tests/unit/providers.test.ts`, `search-providers.test.ts`,
`browser-providers.test.ts`, `memory-providers.test.ts`, `modality-providers.test.ts`,
`transports.test.ts`. Autonomy scenarios remain on the same controller.

Required checks on this pass: `bun test --timeout 20000` (312 pass, 1 skip),
`bun run check` (types, adapter boundary, home-path, markdown links), and the
production build. Held-out fixture rate remains 98.1% (103/105); H025/H026 are
pre-existing override-parser mismatches, not a new architecture loop. Extra review
paths (`src/state/`, `src/core/gate.ts`, `src/execution/`, `scripts/build.ts`,
`install/`) were not rewritten for these slices.

## Awaiting owner sign-in, external access, or native hardware

- Non-ChatGPT keys/OAuth and live ≥95% held-out eval
- Search/MCP/browser accounts or binaries
- Honcho/Tesseract/Whisper/TTS access
- Transport tokens, dual-transport proof
- Codex/OpenCode/Copilot logins
- Live Rocket, four-target native, five-user, notarization

A live check can move one row to `live-verified`. It cannot reopen the research plan.

## Earlier first-use pass (preserved)

Ordinary vs research conversation; provider readiness layers; grok A05 HTTP vs xai-oauth;
wizard shortlist; one-transport pairing; generated systemd/launchd units. The three
scripted scenarios remain on the same controller. No new paper.
