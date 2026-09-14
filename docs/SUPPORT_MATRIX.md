# Support matrix (0.1-I)

| Target | Build artifact | CI smoke | Native runner evidence |
|--------|----------------|----------|------------------------|
| Linux x64 | `keli-linux-x64` | Required (`bun test`, release smoke) | Host CI |
| Linux arm64 | `keli-linux-arm64` | Cross-compile via `bun run build --all-targets` | Leftover: native runner |
| macOS x64 | `keli-darwin-x64` | Sandbox job (fail-closed checks) | Leftover: G02 cannot be faked in Linux CI |
| macOS arm64 | `keli-darwin-arm64` | Cross-compile artifact only | Leftover: notarization |

## Providers and adapters

| Surface | Fixture (CI default) | Live (optional) |
|---------|----------------------|-----------------|
| Model provider | `KELI_FIXTURE_MODEL` / `KELI_FIXTURE_URL` | `keli setup provider` + live probe for the **selected** model only |
| Grok override (A05) | `KELI_FIXTURE_GROK` / `KELI_GROK_FIXTURE_URL` | `grok` HTTP API-key path; `xai-oauth` is the subscription account path |
| Catalog inference ids | Construction + protocol mocks | Not live-verified; `keli providers list` shows catalogued/configured/live-verified |
| Honcho memory | `KELI_FIXTURE_HONCHO` + `KELI_HONCHO_ENABLED=1` | Blocked live HTTP until the documented contract is stable |
| Browser session | `KELI_FIXTURE_BROWSER_SESSION` | Playwright with credential ref |
| Delegate | `KELI_FIXTURE_DELEGATE` | External-cli / ACP when pinned |
| Discord/Telegram | `KELI_FIXTURE_DISCORD` / `KELI_FIXTURE_TELEGRAM` | Token via `keli auth add` |

Fixture knobs are read in `src/integrations/env.ts` only. Legacy `KELI_*_FIXTURE_URL` names remain aliases.

## Readiness for live integration testing (0.1-J)

What "configured" means per surface, and what has actually been exercised:

| Surface | Verified in CI (fixture/replay) | Live behavior | Not yet done |
|---------|--------------------------------|---------------|--------------|
| Model provider (OpenAI-compatible chat, ChatGPT, Anthropic/Gemini via pi-ai) | Config + credential resolution, budgets, retries, catalog construction, selected-model setup probe | ChatGPT gpt-5.5 live; other ids live only after that account's probe | Catalog row count is not entitlement; cloud SDK chains not live-tested |
| Search | Fixture POST + Brave/generic request shape; `missing_access` when unset; malformed JSON typed | `keli setup` Search + owner key | Extra search backends deferred |
| Memory | Local notes/conversations/sources; Honcho fixture advisory only | Owner Honcho HTTP if a stable contract appears | Unmaintained memory SaaS excluded |
| Documents / OCR / speech | Text PDF + fixture OCR/audio; missing binary typed | pdftotext, Tesseract, Whisper/TTS accounts | npm PDF parsers not adopted |
| MCP | `tools/list` then `tools/call`; unknown names typed | Live MCP server | Keyless search rings excluded |
| Browser | Hashed navigate/capture; allowlist before store | Playwright/CDP/MCP binaries | Python browser agents excluded |
| Research corrections | Scoped rule commit/undo, quoted-text rejection, leak test across projects | Same code path | — |
| Source collections | Index, FTS search, read, fingerprint; Augustine/Shaul and Cava fixture corpora | Point `keli sources add` at the real Shaul index / transcript folders | Transcript ingestion from YouTube itself is outside Keli (bounded adapter feeds a folder) |
| Discord | Fixture receiver + sender: thread binding, dedupe, cursor, stored replies on restart | `RestDiscordBackend` polling (REST v10, bot token) via `keli discord poll --loop 10` | First live run against a **separate Keli bot identity**; Nancy's receiver is not taken over |
| Telegram | Outbox/inbox fixtures, Bot API mock getUpdates/sendMessage, conversation cycle, `/getMe` | `RestTelegramBackend` + `keli telegram poll` | Live bot token + owner pairing |
| Watches / heartbeat | Fingerprint gating, one wake per change, notify-once, pause after failures, HEARTBEAT import as proposals | `keli watches tick` from cron/systemd timer | URL watches beyond loopback need `network.allowedHosts` |
| Updates | Install/rollback bookkeeping, snapshot + migration rehearsal, off/notify/auto policy, idle deferral | `keli update --scheduled` from a daily timer | Published release manifest URL; native-runner evidence |
| Structured CLI tools (`tools.rocket`) | Fixture CLI: argv lock, timeout/cancel, ResearchResult mapping, integration_gap | `ROCKET_BIN` + `ROCKET_STATE_DIR` when configured | Live Rocket revision pin |
| General responsibilities | Scheduled review slots, allowlisted tools, `capabilities.lookup`, no-finding wait, schema v13 | `keli watches import` + approve a `kind: responsibility` watch | Live Rocket + live-model daily brief |
| Cross-domain scenarios | Scripted portfolio, Augustine/Shaul, maintenance on one controller | [operating guide](responsibilities.md) | Live Rocket / live-model evaluation |

Live probe: `bun run scripts/live-probe.ts` performs real round trips; required integrations that are skipped are reported as not passing.

## Human-only leftovers (do not tag v0.1.0 until recorded)

- Apple notarization / release signing keys in secure CI
- Held-out correction eval ≥95% with **live** provider (fixture suite runs in CI)
- Five-user assisted onboarding checklist (`docs/RELEASE_CHECKLIST.md`)
- Four-target **native** runner evidence on real hardware

## Evidence-driven research autonomy (opt-in)

| Surface | Verified locally | Remaining live milestone / limit |
|---|---|---|
| Approved indexed-source responsibility | 13 integration tests: dependency recovery, quiet thesis changes, false/stale completion, restart/concurrency, cancellation, budgets, owner/route input, migration preservation | One bounded live-provider watch; URL autonomy and general coding are outside this slice |
| Material-change notification | Paired scripted comparison and real outbox persistence; rejected delivery retry and ambiguous acknowledgement handling | Semantic relevance quality and live transport acknowledgement reconciliation |
| Evidence verification | Current passage hashes, exact quotes, required coverage and scoped source access | Semantic entailment and factual truth are not established by structural checks |

See [reproduction, evidence and scope](evidence/research-autonomy/README.md).

## Live account milestone

ChatGPT account conversation is now implemented with pi-ai 0.73.1 and live-tested
with gpt-5.5. This is separate from the Codex App Server coding delegate. Existing
Codex account linking was exercised; independent browser login remains owner-operated.
See [account connection](evidence/CODEX_APP_SERVER.md) and
[live results and limitations](evidence/LIVE_ACCOUNT_RESULTS.md).
