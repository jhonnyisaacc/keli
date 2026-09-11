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
