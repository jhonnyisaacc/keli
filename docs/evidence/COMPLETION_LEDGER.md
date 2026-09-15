# Completion ledger (v0.1.0)

`v0.1.0` was tagged on 2026-09-15 with fixture-only evidence by owner decision; rows marked
**L awaiting …** or **A** are open owner milestones, not engineering gaps. See the
[release report](RELEASE_REPORT.md) for the tag exception and the [release checklist](../RELEASE_CHECKLIST.md)
for the executed rows.

Catalog membership is not a live connection. `ce51b3a` imported pinned Hermes inference
metadata (54 JSON rows; 50 registered catalog profiles plus 6 Keli-owned). ChatGPT gpt-5.5
is the known live conversation path. See [LIVE_ACCOUNT_RESULTS.md](LIVE_ACCOUNT_RESULTS.md),
[CODEX_APP_SERVER.md](CODEX_APP_SERVER.md), [HERMES_PROVIDERS.md](HERMES_PROVIDERS.md), and
the [connection guide](../providers.md).

Compact contract: requirement → existing implementation → missing behavior → reuse
source → integration work → acceptance evidence. Working Keli paths stay in place.

Pins: Hermes `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` (MIT); Nanobot
`f49965445152361b779b465e8a5111549ac934c4` (MIT); `@mariozechner/pi-ai@0.73.1` (MIT).
Codex App Server protocol (openai/codex, Apache-2.0) is a gated coding delegate only.
Telegram Bot API and Discord REST v10 are protocols. MCP JSON-RPC is the Model Context
Protocol spec.

Keli retains authority in `src/core/gate.ts`, `src/core/capability-gate.ts`, and
`ResearchResponsibilityService` in `src/core/behavior.ts`. Adapters propose.

Evidence labels: **F** fixture-verified · **L** real integration/model · **A**
awaiting owner sign-in, external access, or native hardware.

| ID | Requirement (PRD) | Existing | Missing | Reuse | Integration | Evidence |
|---|---|---|---|---|---|---|
| L01 | Neutral project default; Rocket optional | `DEFAULT_PROJECT_NAME=personal` | — | BUILD | preserve stored names | F |
| L02 | Discord receive/route/reconnect/delivery | REST v10 + fixture; inbox/outbox; pairing challenge | Live bot token | ADOPT Discord REST; ADAPT Nanobot backoff | `KELI-PAIR` on the bound route | F; L awaiting bot token |
| L03 | Telegram receive/route/reconnect/delivery (A18) | Bot API + fixture; pairing challenge | Live bot token | ADOPT Telegram Bot API; ADAPT Nanobot offset + backoff | same pairing helper | F; L awaiting bot token |
| L04 | Ordinary real-model onboarding | Bootstrap `keli setup` (one model + auth + default/probe) and `keli connect` / `keli setup advanced` for optional tools | Owner keys for non-ChatGPT | ADAPT Hermes setup/auth and OpenCode family tables; ADOPT pi-ai | `setup.liveChecked` per selected model; [UPSTREAM_COMPAT.md](UPSTREAM_COMPAT.md) | F; L ChatGPT; other ids catalog until probed |
| L05 | ChatGPT-account onboarding | pi-ai inference + OAuth or Codex link | Independent browser login | ADOPT pi-ai; ADAPT Hermes auth/transport split | not App Server execution | F + L (CLI, retrieval, reviews); browser OAuth **A** |
| L06 | Search without fixture-only path | Brave/generic HTTP; hashed web/browser artifacts | Owner search key | ADOPT Brave/generic HTTP | credentials alone do not pass a probe | F; L awaiting search key |
| L07 | MCP stdio + HTTP (A41–A42) | JSON-RPC HTTP + owned stdio; tools/call after tools/list; arguments validated against the fetched JSON Schema | Live MCP server | ADOPT MCP JSON-RPC; Keli owns the child | unknown tools / invalid args typed | F; L awaiting MCP server |
| L08 | Coding delegates Codex/OpenCode (A23–A24, A37) | Fixture + gated Codex app-server; Copilot ACP identity blocked | Live `codex` / OpenCode / Copilot ACP login | ADOPT app-server as **delegate only** | unverified without artifacts | F; L awaiting `codex` |
| L09 | Browser/Playwright screenshots/downloads | Navigate + hashed capture; optional Playwright/CDP/MCP | Live Playwright install | ADOPT Playwright | allowlist before bytes stored | F; L awaiting browser install |
| L10 | Install/service/diagnostics | Generated systemd/launchd via `keli service install`; landlock worker embedded in the binary so binary-only installs pass `doctor` | Linger/launchd enable | ADOPT OS service primitives | no committed `install/keli.service` | F (checklist rows 1, 9); A native linger/launchd |
| L11 | Responsibility controller | Occurrences, budgets, waits, verification, outbox | Improve only on eval failure | ADOPT existing Keli | ordinary chat does not loosen watches | F |
| L12 | Rocket optional tool | `tools.rocket`; `integration_gap` if missing | Live CLI pin | ADOPT Rocket `ResearchResult` | `ROCKET_BIN` | F; L awaiting Rocket binary |
| L13 | Dual-transport pairing, native four-target, five-user, live ≥95% | One-transport pairing fixture; four cross-compiled artifacts; fixture held-out 105/105; checklist rows 1–10 agent-run on Linux | Owner accounts / hardware | — | not an engineering loop | A (open after the tag) |
| L14 | Ordinary vs research conversation | CLI/inbox ordinary; watches research | — | BUILD Keli | greeting after required-collection correction | F |
| L15 | Local-first memory contract | SQLite notes + conversations (FTS query terms quoted as literals); Honcho fixture advisory | Stable Honcho HTTP | KEEP local authority | stale notes cannot override rules | F; L Honcho blocked |
| L16 | Documents / OCR / speech | Uncompressed PDF + optional binaries + OpenAI audio | Live pdftotext/Tesseract/Whisper | BUILD owned processes; no npm PDF parser | never writes notes | F; L awaiting binaries |

Honcho is fixture-only advisory memory (not a second authority). OCR and speech
have fixture contracts; live Tesseract/Whisper/TTS remain owner milestones. Hermes
MoA stays excluded. Extra search vendors stay unadded until a protocol/license check.
Do not import Hermes/Nanobot runtimes.

## Earlier pass: ADOPT / ADAPT / BUILD summary

| Decision | What | Why not the other two |
|---|---|---|
| ADOPT | Discord REST v10, Telegram Bot API, MCP JSON-RPC, Brave/generic search HTTP, Codex app-server JSON-RPC (delegate), systemd/launchd units, pi-ai | Maintained protocols/libraries; importing Hermes/Nanobot Python runtimes would add a second state owner |
| ADAPT | Nanobot poll backoff; Hermes catalog metadata and Nous/xAI/MiniMax OAuth exchanges; existing inbox/outbox/gate | Small TypeScript seam; no PTB/discord.py copy |
| BUILD | Neutral project default; first-use shortlist; readiness layers; ordinary conversation mode; pairing challenge; generated `keli service run` | No upstream component owns Keli state or this product default |
