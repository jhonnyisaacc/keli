# Changelog

All notable changes to Keli follow [SemVer](https://semver.org/).

## 0.1.0-alpha (unreleased)

**Release policy:** the full initial PRD product ships as **v0.1.0**. Increments 0.1-A–E are complete in code; 0.1-F–I remain before tagging. See [PRD.md](PRD.md) §11.

### 0.1-E

- POSIX `install/bootstrap.sh`; `keli update --check|--install|--rollback` with manifest checksum verification
- `scripts/write-manifest.ts`; release emits `dist/manifest.json` (SHA-256 always; signing hook when keys exist)
- `keli backup` / `keli restore` (credentials excluded; jobs paused on restore; no outbox replay)
- Global `keli pause` / `keli stop` / `keli resume --revalidated`; scheduler and effectful capabilities blocked
- Schema v7: `job_grants`, `preservation_cursor`; remaining deterministic A-gates with fixture-backed transports
- Docs: `docs/INSTALL.md`, `docs/OPERATIONS.md`, `THIRD_PARTY_NOTICES`, Linux CI workflow

### 0.1-D

- Schema v4–v6: jobs, occurrences, outbox, transport inbox/routes with run/action linkage
- Durable jobs: schedule parsing, coalesced scheduler tick, gate dispatch via `jobs.observe`, A21 recovery
- `keli jobs` subcommands; Discord and Telegram transport stubs with outbox receipts and inbox dedupe
- Transport routes bind immutable external ids to scopes; inbox queue processed on startup and via CLI
- Outbox reconcile on open; delivery retry for pending Discord/Telegram messages; failed terminalization
- Explained `keli setup` wizard (interactive + `--non-interactive` for tests); `keli routes` bind/list
- Acceptance coverage: A15 quiet recurrence, A18/A19 transport paths, A21 non-repeat dispatch, route tests
- Monotonic fencing tokens on lease acquire (same-ms supersede no longer false-positive valid)

### 0.1-C

- HTTP/web/search/browser/MCP/delegate capabilities with fixture-backed conformance tests
- Browser complement model: `http.fetch`/`web.fetch` for static pages; pluggable session backends (fixture, Playwright, CDP, MCP)
- Delegate conformance in gate loop via `actWithDelegate`; primary/fallback with lease fencing (A37)
- Playwright navigate backend (`scripts/playwright-navigate.ts`)
- Run budgets and cancellation epochs on capability path
- Release smoke exercises delegate + `keli invoke web.fetch`
- Schema v3 `runs` table; network host allowlist for outbound fetch

### 0.1-B

- Capability registry, gated dispatch, and `keli invoke` / `keli capabilities`
- Linux Landlock sandbox worker; macOS shell fails closed
- Artifact receipts (schema v2) and `files.write`
- Typed `KeliError`, provider error normalization, capability gate truth
- Platform tests: denied-resource (Linux), fail-closed (macOS), secret isolation
- Fixes: async state-dir creation before SQLite open; headless `--undo` flag parity

### 0.1-A

- Initial repository bootstrap (increment 0.1-A)
- SQLite state, durable scoped rules, authority gate
- Grok Build-style CLI: `init`, `doctor`, `inspect`, headless `-p`
- Fixture provider and invariant tests for corrections, scope, gate, restart
