# Changelog

All notable changes to Keli follow [SemVer](https://semver.org/).

## 0.1.0-alpha (unreleased)

**Release policy:** the full initial PRD product ships as **v0.1.0**. Increments 0.1-A–E are complete in code; 0.1-F–I remain before tagging. See [PRD.md](PRD.md) §11.

### 0.1-I

- `scripts/build.ts --all-targets` emits four cross-compiled artifacts + `SHA256SUMS` (signing hook when `KELI_RELEASE_SIGNING_KEY` set)
- Held-out fixture suite (≥100 cases) under `tests/acceptance/held-out/` with pass-rate report
- `docs/SUPPORT_MATRIX.md`, `docs/BOUNDARY_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`
- **Do not tag v0.1.0** until human gates recorded (notarization, live eval, five-user check, native four-target smoke)

### 0.1-H

- Bounded helper fan-out (`helpers.spawn`, max 4); child runs inherit parent cancel epoch and budget envelope
- Parent cancel propagates to helper tree (A42); job grants apply to spawned children
- Schema v9 `helper_runs` table

### 0.1-G

- Configurable provider routing roles (`cheap` / `strong` / `task` / `agent` / `provider`)
- Run request/token/tool-call budgets on capability path; job mutate grants for recurring writes
- Durable skill pins in SQLite with activate/rollback; compact index summaries (A41)

### 0.1-F

- Schema v8: local `notes` FTS, `conversations`, `task_checkpoints`, `skill_pins`
- `keli notes add|list|search`; optional Honcho fixture adapter (`KELI_HONCHO_*`)
- Provider registry with fixture default; Grok fixture override (A05); named-later providers unavailable
- `browser.session` via credential reference; `keli providers list`

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
