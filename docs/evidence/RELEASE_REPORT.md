# Release report (v0.1.0)

Baseline: `021ca10` plus the bounded capability slices on `feat/v0.1.0`, merged fast-forward
into `main` and tagged `v0.1.0` on 2026-09-15. Plan:
[general-purpose-autonomy.md](../../plans/general-purpose-autonomy.md). Ledger:
[COMPLETION_LEDGER.md](COMPLETION_LEDGER.md). Connection guide: [providers.md](../providers.md).
Checklist: [RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md).

## Tag decision and open PRD §14 items

[PRD.md](../../PRD.md) §11 and §14 ask for live evidence before tagging `v0.1.0`. The owner
decided on 2026-09-15 to tag with **fixture-only** evidence and no live credentials. This
report records that exception; it does not amend the PRD. The following §14 items remain
**open owner milestones** after the tag:

- Live provider held-out eval ≥95% on a real model (fixture suite is 105/105)
- Non-ChatGPT API keys / OAuth subscriptions; ChatGPT gpt-5.5 remains the only live-tested
  conversation path ([LIVE_ACCOUNT_RESULTS.md](LIVE_ACCOUNT_RESULTS.md), 2026-09-14)
- Search, MCP, browser accounts or binaries; Honcho, Tesseract, Whisper, TTS access
- Discord/Telegram bot tokens and dual-transport pairing proof
- Codex / OpenCode / Copilot ACP logins; delegate conformance on two pinned implementations
- Four-target native smoke on real hardware; macOS notarization and signing keys
- Five-user (or assisted) usability check on both OS families
- Live Rocket scenario

A live check can move one ledger row to `live-verified`. It cannot redefine the authority
boundary or reopen the research plan.

## User commands after this release

`keli setup` connects one conversation model (auth, default model, bounded probe).
`keli connect` (alias `keli setup advanced`) adds optional search, browser, memory, speech,
messaging, MCP, and delegates. Section commands (`setup provider|search|memory|mcp|transport|
delegate`) remain as compatibility aliases.

## Implemented and fixture-verified on `feat/v0.1.0`

Neutral `provider-manifest.json` with protocol mapping; numbered one-session setup;
bounded inference fallback (never silent fixture); shared Brave/generic search plus
hashed web/browser artifacts; local-first memory contract (Honcho fixture-only);
documents/OCR/speech behind the gate with optional binaries; MCP `tools/list` before
`tools/call` with JSON-Schema argument validation; Copilot ACP as a distinct blocked
delegate; `keli service` as lifecycle.

Provider onboarding (final slice): Hermes/OpenCode **setup behavior** adapted into Keli-owned
flows (`src/setup/flows.ts`) for API-key, OAuth/device, external-CLI, and keyless local
endpoints, with provider-specific defaults, model normalization, live model discovery where
available, and typed errors. Credentials are stored as references only. The
[upstream compatibility ledger](UPSTREAM_COMPAT.md) is generated from the single manifest.
Persisted browser configuration reaches dispatch without fixture environment variables.

Contract suites: `tests/unit/providers.test.ts`, `provider-onboarding.test.ts`,
`search-providers.test.ts`, `browser-providers.test.ts`, `memory-providers.test.ts`,
`modality-providers.test.ts`, `transports.test.ts`, `json-schema.test.ts`. Autonomy
scenarios remain on the same controller.

## Release close-out evidence (2026-09-15, Linux x64 host, Bun 1.4.0)

| Check | Result |
|---|---|
| `bun test --timeout 20000` (temporary `KELI_STATE_DIR`) | 339 pass, 1 platform skip, 0 fail |
| Held-out correction fixture suite | 100% (105/105). H025/H026 were aligned with PRD A05: "Use Grok only this time" is one run override. |
| `bun run check` | types, adapter boundary, home-path, and markdown-link checks pass |
| `bun run build` / `--all-targets` | `keli-linux-x64`, `keli-linux-arm64`, `keli-darwin-x64`, `keli-darwin-arm64`, `SHA256SUMS`, `manifest.json` with the tagged git SHA |
| `bun run release` | Compiled-binary fixture smoke (init, doctor, correction, action, `web.fetch`) passes; the script now seeds its smoke project explicitly and always stops its fixture servers |
| Release checklist rows 1–10 | All pass against the bootstrap-installed binary; see notes below |

Defects found by the checklist and fixed before the tag:

1. `keli notes search` passed raw text to FTS5 `MATCH`; hyphens, colons, or operator words
   raised `SQLiteError`. Terms are now quoted literals with implicit AND.
2. A binary-only install (bootstrap or update) had no `landlock-worker.py` beside the
   executable, so `keli doctor` failed its sandbox probe. The worker is embedded in the
   compiled binary and materialized to a content-addressed temporary file only when no
   sibling copy exists. What runs under the sandbox is unchanged.

Extra-review paths touched in this close-out: `src/execution/linux-landlock.ts` (worker
resolution only). `src/state/`, `src/core/gate.ts`, `scripts/build.ts`, and `install/` were
not changed for the tag.

## Earlier first-use pass (preserved)

Ordinary vs research conversation; provider readiness layers; grok A05 HTTP vs xai-oauth;
wizard shortlist; one-transport pairing; generated systemd/launchd units. The three
scripted scenarios remain on the same controller. No new paper.
