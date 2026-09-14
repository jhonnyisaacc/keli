# Spike reuse notes (0.1-A)

| Spike | Pin / path | Adopted pattern | Not copied |
|-------|------------|-----------------|------------|
| Architecture B | `personal-agent-b` | Bun-owned gate, SQLite rules/actions/effects, prepare→finish | Python Nanobot child, flat test harness |
| Native slice | `personal-agent-native-spike` | Bun.serve fixture, proposal-only adapter | 29-line spike as production loop |
| E1 | `personal-agent-e1` c4a25c9 | Enum validation, explain projection | Nanobot foundation, tool-local gate |

Contract tests in `tests/invariants/` trace to PRD A01–A11.

## 0.1-C

| Area | Approach | Notes |
|------|----------|-------|
| HTTP/web | Bun `fetch` + host allowlist | Static-page complement; no browser engine required |
| Browser sessions | Pluggable backends in `browser-backends.ts` | fixture, playwright, CDP, MCP; Playwright is conformance target not exclusive |
| Search/MCP/delegate | Fixture HTTP server for conformance | Real backends wired via env URLs |
| Budgets/cancel | `runs` table + `run-control.ts` | Capability gate terminalizes on cancel |

## 0.1-F through 0.1-I

| Area | ADOPT | ADAPT | BUILD (Keli-owned) |
|------|-------|-------|---------------------|
| Integration/onboarding | — | Hermes `ProviderProfile` registry, shared runtime resolver, `hermes model`/`setup`/`auth`/`doctor` surfaces, credential scoping, catalog-never-auto-install (`05d705dd695d1084388529124dc2ffe5ce919e89`) | `src/integrations/*`; gate remains authority; no `.env` secrets; no user plugin loader in v0.1.0 |
| Model providers | OpenAI-compatible HTTP (`fetch`) | Nanobot typed timeout/quota patterns; Hermes `api_mode` | Profile data + `provider-registry.ts` facade |
| Honcho | Fixture HTTP protocol | Optional network memory seam; single-select `memory.provider` | Local FTS notes; absent when disabled (A29) |
| Browser session | Playwright/CDP/MCP (0.1-C) | Hermes backend seam | `browser.session` credential-ref connect; browser-backend profiles |
| Routing/budgets | — | Hermes advisory budget lessons | `routing.ts`, `budgets.ts` pre-dispatch |
| Skills | Agent Skills layout concept | Nanobot compaction/index lessons | Durable `skill_pins` SQLite store |
| Helpers | — | Nanobot child ownership (#5429) | `helpers.spawn`, `helper_runs`, fan-out cap |
| Release | Bun cross-compile targets | Checksum + optional signing hook | Held-out fixture suite, support matrix |

## 0.1-J (integration readiness)

| Evidence / upstream | ADOPT | ADAPT | BUILD (Keli-owned) | PRD trace |
|---------------------|-------|-------|--------------------|-----------|
| Nanobot #5510 conditional wakeups | — | Fingerprint-before-wake idea | `src/watches/heartbeat.ts`: collection/URL fingerprint; unchanged = zero model calls | A15, A21 |
| Nanobot #5379 preservation before cursor advance | — | Archive-then-verify ordering | `src/memory/retention.ts`: hash-verified artifact per row, journaled pass, idempotent | A33 |
| Hermes #82879 stalled memory writers | — | Persist attempt/last-success | `watches.last_attempt_at/last_success_at/last_error/attempts`; pause after N failures; inbox `processError` annotation | A21 |
| Hermes #4335 continuity across interfaces | — | Shared approved knowledge, separate histories | `conversation_turns` per conversation; rules per scope; Discord thread = its own conversation | A07, A17 |
| Pi extensions (small interfaces, selective context) | — | Narrow `SourceReader` interface; system prompt loads collection summaries, passages on demand | `src/sources/reader.ts`, `src/conversation/context.ts`; authority stays in `gate.ts`/`behavior.ts` | I3, A01 |
| SOUL/HEARTBEAT prose files | — | Keep as authoring surface only | `src/watches/heartbeat-file.ts` compiles sections into versioned proposals; approval explicit | A07, A15 |
| Discord REST v10 | Protocol (`fetch`, no discord.js) | Polling receiver instead of gateway | `src/transports/discord-backend.ts` fixture + REST; outbox/inbox truth stays in SQLite | A17, A18 |
| OpenAI chat completions JSON mode | Protocol | JSON-object decisions instead of native tool calling | `src/conversation/decision.ts` validates shape before anything executes | A01, A02 |
| SQLite `VACUUM INTO` | Built-in | — | Update snapshot + migration rehearsal (`src/update/install.ts`) | A04, A33 |

Upstream records above are issue reports and proposals, not reproduced defects in current releases. No third-party code was vendored in 0.1-J; pins are protocol-level.

## Evidence-driven research autonomy

ADOPT existing Keli watches, run budgets, scoped capability dispatch, source index, turns and outbox; ADAPT addressed evidence and phase-memory/verification principles; BUILD the missing resumable watch-occurrence connection. Reference pins, MIT licenses, I1–I7/I9–I10 and acceptance trace IDs are recorded in the [integration evidence note](research-autonomy/README.md#reuse-and-review). No upstream implementation was copied. Paired demonstrations use baseline `4bd3b9e` and scripted providers through actual Keli runtime paths.
