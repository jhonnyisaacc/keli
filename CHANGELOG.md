# Changelog

All notable changes to Keli follow [SemVer](https://semver.org/).

## 0.1.0 — 2026-09-15

**Release policy:** the full initial PRD product ships as **v0.1.0**. Increments 0.1-A–I are complete in code, including the integration/onboarding layer. **Tagged by owner decision with fixture-only evidence.** [PRD.md](PRD.md) §11/§14 asked for live evidence before the tag; the owner accepted tagging without it. The open PRD §14 items are listed in [RELEASE_REPORT.md](docs/evidence/RELEASE_REPORT.md) and stay open owner milestones; a later live check may move a ledger row to live-verified but does not reopen the architecture.

### Release close-out (this tag)

- Held-out correction fixture suite: 105/105 after aligning H025/H026 with PRD A05 ("Use Grok only this time" is one run override). The fixture rate is not the live ≥95% target.
- [Release checklist](docs/RELEASE_CHECKLIST.md) rows 1–10 executed against the bootstrap-installed Linux binary with fixture servers; two defects found and fixed: `keli notes search` passed raw text to FTS5 (punctuation raised `SQLiteError`), and a binary-only install had no `landlock-worker.py`, so `doctor` failed its sandbox probe. The worker is now embedded in the executable.
- `bun run release` seeds the smoke project explicitly (new installs default to `personal`) and always stops its fixture servers.
- Four cross-compiled artifacts (`linux`/`darwin` × `x64`/`arm64`) with `SHA256SUMS` and a manifest carrying the tagged git SHA. Native smoke and notarization remain owner milestones.

## Completion pass (reuse + onboarding)

- Completion ledger: [COMPLETION_LEDGER.md](docs/evidence/COMPLETION_LEDGER.md). Codex App Server ChatGPT auth cannot be a conversation provider: [CODEX_APP_SERVER.md](docs/evidence/CODEX_APP_SERVER.md).
- New installs default the project name to `personal` (or `--project`); existing names are preserved. Rocket is not a product default.
- Telegram Bot API getUpdates/sendMessage connected to inbox/outbox; `keli telegram poll`. Shared reconnect backoff with Discord poll (Nanobot 5–300s).
- Search and MCP use configured HTTP/stdio JSON-RPC when fixture env is absent. Codex app-server is a gated coding delegate only.
- `keli service install|status|run` writes systemd/launchd units. Setup records `setup.providerConnected` from a live `/models` probe.

### Cross-domain responsibility scenarios

- Same controller covers portfolio (Rocket fixture), Augustine/Shaul sources, and read-only maintenance triage. Scripted measurements and status labels: [evidence](docs/evidence/general-purpose-autonomy/README.md). Operating path: [responsibilities](docs/responsibilities.md).
- A scheduled responsibility waiting on evidence can open the next UTC review slot; unchanged holdings do not cancel tomorrow's brief.

### General responsibilities

- Approved watches may be `kind: responsibility` with scheduled review slots, objective/constraints, and an allowlisted capability set. Source-collection research remains the event-driven specialization.
- Default responsibility cadence is the watch's own schedule (`daily:09:00` only when that contract says so). Repeated ticks in the same UTC slot do not open a second occurrence.
- `capabilities.lookup` returns schemas for approved ids only. `tools.rocket` stays refused on default research watches.
- Investigation attempts persist on `watch_occurrences.investigation_json` (schema v13). A healthy tool with no finding cannot verify the occurrence. `daily-brief` notifies on verified reviews even when the thesis is unchanged.

### Structured external tools (Rocket profile)

- `tools.rocket` is a read-only structured CLI capability. The executable and argv template come from `ROCKET_BIN` / `tools.rocket.bin` and config; the model may pass only a declared `workflow`.
- Command success, acquisition health, evidence sufficiency, and domain findings are mapped separately. Missing binaries are `integration_gap`, not invented results.
- Owned process timeout, cancellation, and output limits are enforced. Research turns still cannot call this capability until a responsibility approves it.

### Current plan (general-purpose autonomy)

- Current development plan is [general-purpose autonomy](plans/general-purpose-autonomy.md). Bounded capability slices land as independently reviewable commits on `feat/v0.1.0`.
- Provider onboarding is adapted from Hermes/OpenCode **setup behavior** into Keli flows (`src/setup/flows.ts`): API-key, OAuth/device, external CLI, and keyless local endpoints. `keli setup` bootstraps one model; `keli connect` / `keli setup advanced` configure optional tools. Ledger: [UPSTREAM_COMPAT.md](docs/evidence/UPSTREAM_COMPAT.md). Fixture success is not live-verified.
- 2026-fast-spike matrix, experiments, and architecture decisions are imported onto `feat/v0.1.0` as historical evidence. The research-watch slice remains implemented; its plan is retained as history.
- Tracked docs no longer embed personal-home paths. Sanitized spike artifacts are labeled derivatives. `bun run check` rejects home-path leaks and broken local documentation links.

### Evidence-driven research autonomy (opt-in)

- Approved `autonomy: yes` source-collection watches retain occurrences, evidence dependencies, phases and cumulative budgets across waits/restarts.
- Research recovers addressed observations, suppresses duplicate inspections, checks current authority at dispatch, and verifies required subjects/collections against current quoted passages.
- One transactional outbox intent per report; changed supported findings notify, irrelevant additions remain quiet, and delivery retry does not repeat research.
- Schema v12; `watches occurrences` and `watches resume`; owner-bound Discord `/watch-input`; active research participates in update-idle checks.
- Scripted paired demonstrations and limitations: [evidence](docs/evidence/research-autonomy/README.md). [CLI walkthrough](docs/research-autonomy.md). Live-provider quality remains a separate milestone.

### 0.1-J (integration readiness; plan: `plans/integration-readiness.md`)

Foundation
- Provider creation is config- and credential-aware (`provider-factory.ts`): saved model, credential ref, and `api_mode` feed one path; unsupported protocols fail with an accurate message; `listProviders(config)` reflects real availability
- Budgets are enforced per attempt: a run per turn, token reserve/reconcile, every retry recorded in `request_usage` (`run_id`, `attempt`, `model`, `outcome`); typed retryable errors, bounded backoff, cancellation, reachable no-progress stop
- Live probe performs real round trips (`/models`, `/getMe`, `/users/@me`); required vs optional integrations; skipped required checks never count as passes; `EnvCredentialSource` for CI

Conversation and research
- `ConversationLoop`: one JSON decision per step (tool_call | answer | missing_evidence | clarify) over any OpenAI-compatible chat endpoint; tool calls run through the capability gate; answers pass a deterministic evidence check (cited sources must have been retrieved this turn, attributed positions need evidence or an explicit `no-coverage` stance, required collections must be cited)
- Durable, scoped research corrections (`research.requiredCollections`, `research.citationsRequired`) via generic `BehaviorService.reviseRule`/`undoRule`; quoted text never changes policy; undoing a first revision retires the rule
- Read-only source collections (markdown + frontmatter, FTS5): `keli sources add|index|list|search`; `sources.search|read|collections` capabilities receive a narrow `SourceReader`, never the database
- Schema v11: `conversation_turns` (idempotent by source message), `watches`, `watch_events`, `source_documents`, `archived_at`
- Discord: `DiscordBackend` seam (fixture + REST v10 polling, no gateway); thread-exact conversation binding; `keli discord poll` runs receive → converse → reply with inbox dedupe, per-route cursors, and stored replies on restart
- Compaction verifies each archive (hash) before marking rows, journals the pass, and is idempotent
- `keli chat` runs the research loop; `--legacy` keeps the coding-delegate loop

Watches and heartbeat
- Watches are compiled records (trigger, budget, evidence, notify); `HEARTBEAT.md` compiles to *proposals* (`keli watches import`), approval is explicit (`keli watches approve`)
- `keli watches tick`: cheap fingerprint first (collection hash / URL body hash); unchanged sources cost zero model calls; changed sources run one research turn keyed by fingerprint (never repeated after restart); one notification per material change, failure, or needed input; consecutive failures pause the watch and say so once

Updates
- `keli update --mode off|notify|auto` (default off); `keli update --scheduled` runs the daily policy: notify announces a version once; auto installs only at an idle boundary (no active runs, occurrences, or unprocessed inbox) and never while paused
- Rollback bookkeeping repaired: the previous release binary is retained (bootstrap installs are copied into `versions/`), `previous-version` pointer, staged pointer cleared after activation; `--rollback` restores binary and pre-update SQLite snapshot together
- Install takes a WAL-safe `VACUUM INTO` snapshot, rehearses migrations on a copy with `integrity_check`, verifies size + SHA-256, checks the candidate's schema write range against live state, and records the outcome in config

Replays (fixture corpora + scripted model): Augustine vs Shaul (thread 1548168218445873263 failure mode is withheld as missing evidence; correction → cited answer; correction stays in its project) and Cava thesis watch (unchanged → silent; new video → one cited answer with invalidation conditions, one notification; restart → no repeat)

### 0.1-I

- `keli chat` CLI recovery REPL; `keli sessions list` over runs/conversations
- `scripts/bench-control.ts` writes `docs/evidence/TIMING.md`; `CODEOWNERS`; `integration-live.yml` (workflow_dispatch, skipped live reported not-green)
- `scripts/build.ts --all-targets` emits four cross-compiled artifacts + `SHA256SUMS` (signing hook when `KELI_RELEASE_SIGNING_KEY` set)
- Held-out fixture suite (≥100 cases) under `tests/acceptance/held-out/` with pass-rate report
- `docs/SUPPORT_MATRIX.md`, `docs/BOUNDARY_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`
- **Do not tag v0.1.0** until human gates recorded (notarization, live eval, five-user check, native four-target smoke) — superseded by the 2026-09-15 owner decision recorded at the top of this release

### 0.1-H

- Transport/memory/delegate/MCP/search/browser profiles consume the resolver; adapters no longer read ambient env directly
- Bounded helper fan-out (`helpers.spawn`, max 4); child runs inherit parent cancel epoch and budget envelope
- Parent cancel propagates to helper tree (A42); job grants apply to spawned children
- Schema v9 `helper_runs` table

### 0.1-G

- Configurable provider routing roles (`cheap` / `strong` / `task` / `agent` / `provider`) validated against the registry
- Run request/token/tool-call/monetary budgets; `request_usage` accounting; 2-retry / 3-no-progress in the loop
- `keli skills` CLI; two-comparable-use auto-activation; active skills in bounded advisory context; `job_skill_pins`
- Durable skill pins in SQLite with activate/rollback; compact index summaries (A41)

### 0.1-F

- Integration registry (`src/integrations/`): one profile list drives setup, auth, doctor, resolve, and `keli integrations discover` (never installs)
- `keli auth` / `keli config get|set` as the single mutation path; secrets stored as `CredentialRef` in the keychain
- Setup wizard is registry-driven (sections, `--quick`, `--minimal`); login/logout alias `auth`
- Schema v8–v10: local `notes` FTS, `conversations`, `task_checkpoints`, `skill_pins`, `job_skill_pins`, `request_usage`, retention columns
- `keli notes` / `keli memory compact`; optional Honcho behind `memory.provider` (A29)
- Provider registry facade over the integration layer; Grok run override (A05); named-later providers unavailable
- `browser.session` via credential reference; `keli providers list` remains an alias

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
