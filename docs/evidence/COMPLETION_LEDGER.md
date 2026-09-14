# Completion ledger (v0.1.0 remaining work)

The L05 incompatibility conclusion below is superseded by [live account results](LIVE_ACCOUNT_RESULTS.md) and the corrected [account boundary](CODEX_APP_SERVER.md). ChatGPT inference is now implemented through an adopted model library.

Compact contract: requirement → existing implementation → missing behavior → reuse
source → integration work → acceptance evidence. Working Keli paths stay in place.

Pins: Hermes `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` (MIT); Nanobot
`f49965445152361b779b465e8a5111549ac934c4` (MIT). Codex App Server protocol:
[learn.chatgpt.com/docs/app-server](https://learn.chatgpt.com/docs/app-server)
(openai/codex, Apache-2.0). Telegram Bot API and Discord REST v10 are protocols
(no runtime import). MCP JSON-RPC is the Model Context Protocol spec.

Keli retains authority in `src/core/gate.ts`, `src/core/capability-gate.ts`, and
`ResearchResponsibilityService` in `src/core/behavior.ts`. Adapters propose.

Evidence labels: **F** fixture-verified · **L** real integration/model · **A**
awaiting owner sign-in, external access, or native hardware.

| ID | Requirement (PRD) | Existing | Missing | Reuse | Integration | Evidence |
|---|---|---|---|---|---|---|
| L01 | Neutral project default; Rocket optional | `keli init` / setup hardcoded `"Rocket"` | Explicit name or `personal` | BUILD (product default) | `DEFAULT_PROJECT_NAME`; preserve stored names | F |
| L02 | Discord receive/route/reconnect/delivery | REST v10 + fixture; inbox/outbox; `keli discord poll` | Shared reconnect backoff on poll errors | ADOPT Discord REST; ADAPT Nanobot poll backoff (`POLL_STALE_SECONDS=120`, 5–300s) | `src/transports/reconnect.ts`; Discord poll loop | F; L awaiting bot token |
| L03 | Telegram receive/route/reconnect/delivery (A18) | Fixture send + inbox dedupe; `/getMe` probe | Bot API getUpdates/sendMessage; poll cycle; reconnect | ADOPT Telegram Bot API (same bounded choice as Discord REST, not grammY/PTB runtimes); ADAPT Nanobot offset + backoff | `TelegramBackend` fixture+REST; `keli telegram poll`; inbox/outbox unchanged | F; L awaiting bot token |
| L04 | Ordinary real-model onboarding | Wizard stores provider id; fixture default | Successful round-trip as setup outcome | ADAPT Hermes setup/auth/doctor surfaces | Wizard probes `/models`; records `setup.providerConnected` | F; L awaiting API key |
| L05 | ChatGPT-account onboarding | `oauth-device` throws “use api-key” | Honest ChatGPT path behind Keli provider boundary | Inspect Codex App Server auth | **Implemented and live-checked** using pi-ai inference, not App Server execution; independent OAuth or explicit read-only Codex account link. See [CODEX_APP_SERVER.md](CODEX_APP_SERVER.md). | F + L (ChatGPT CLI, retrieval and scheduled reviews); independent browser login awaits owner |
| L06 | Search without fixture-only path | Fixture HTTP `{results}` | Configured endpoint + key | ADOPT generic search HTTP + Brave `GET /res/v1/web/search` (Hermes web_search backend) | Adapter uses resolved search integration | F; L awaiting search key |
| L07 | MCP stdio + HTTP (A41–A42) | Fixture `/mcp` POST | JSON-RPC initialize / tools/list / tools/call; owned stdio | ADOPT MCP JSON-RPC 2024-11-05 (protocol; same style as Discord REST). Official TS SDK not vendored: keep process ownership in Keli. | HTTP JSON-RPC + stdio client; fixture path preserved | F; L awaiting MCP server |
| L08 | Coding delegates Codex/OpenCode (A23–A24, A37) | Fixture `/delegate` | Real Codex spawn under the gate | ADOPT Codex app-server JSON-RPC as **delegate only** | `delegate.run` may spawn `codex app-server`; completion stays unverified without artifacts | F; L awaiting `codex` + ChatGPT login |
| L09 | Browser/Playwright | Pluggable backends; Playwright probe | Unchanged working path | ADOPT Playwright (existing) | No rewrite | F; L awaiting browser install |
| L10 | Install/service/diagnostics | bootstrap.sh, doctor, update, backup | systemd user + launchd user agent | ADOPT OS service primitives (PRD §9) | `install/keli.service`, `install/io.keli.plist`, `keli service` | F (unit text + dry-run); A native linger/launchd |
| L11 | Responsibility controller | Occurrences, budgets, waits, verification, outbox | Improve only on eval failure | ADOPT existing Keli | No controller rewrite this slice | F (existing scenarios) |
| L12 | Rocket optional tool | `tools.rocket` profile | Live CLI pin | ADOPT Rocket `ResearchResult` | Env `ROCKET_BIN`; mismatch is integration defect | F; L awaiting Rocket binary |
| L13 | Dual-transport pairing, native four-target, five-user, live ≥95% | Fixture A-gates | Owner accounts / hardware | — | Not claimed | A |

## Earlier pass: ADOPT / ADAPT / BUILD summary

| Decision | What | Why not the other two |
|---|---|---|
| ADOPT | Discord REST v10, Telegram Bot API, MCP JSON-RPC, Brave/generic search HTTP, Codex app-server JSON-RPC (delegate), systemd/launchd units | Maintained protocols/OS primitives; importing Hermes/Nanobot Python channel runtimes would add a second state owner |
| ADAPT | Nanobot Telegram/Discord poll liveness (stale 120s, backoff 5–300s); Hermes doctor/setup round-trip; existing Keli inbox/outbox/gate | Small TypeScript seam; no PTB/discord.py copy |
| BUILD | Neutral project default; ChatGPT incompatibility report; `keli service run` composing existing ticks; thin JSON-RPC stdio helper | No upstream component owns Keli state or this product default |

Hermes Telegram (`plugins/platforms/telegram/adapter.py`) and Nanobot
(`nanobot/channels/telegram/runtime.py`) are full agent channels with their own
buses. They are **not** imported. Failure lessons (offset, stale long-poll,
backoff) are adapted into Keli’s backend seam.
