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
| Model providers | OpenAI-compatible HTTP (`fetch`) | Nanobot typed timeout/quota patterns | `provider-registry.ts`, fixture default |
| Honcho | Fixture HTTP protocol | Optional network memory seam | Local FTS notes; absent when disabled (A29) |
| Browser session | Playwright/CDP/MCP (0.1-C) | Hermes backend seam | `browser.session` credential-ref connect |
| Routing/budgets | — | Hermes advisory budget lessons | `routing.ts`, `budgets.ts` pre-dispatch |
| Skills | Agent Skills layout concept | Nanobot compaction/index lessons | Durable `skill_pins` SQLite store |
| Helpers | — | Nanobot child ownership (#5429) | `helpers.spawn`, `helper_runs`, fan-out cap |
| Release | Bun cross-compile targets | Checksum + optional signing hook | Held-out fixture suite, support matrix |
