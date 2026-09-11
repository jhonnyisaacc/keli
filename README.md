# Keli

Keli (כלי) is a personal-first agent: teach it how to work once, and durable scoped corrections govern future execution across restarts and upgrades.

This repository implements increments **0.1-A** through **0.1-E** (code complete for v0.1.0): Bun runtime, SQLite state, authority gates, Linux Landlock sandbox, capability dispatch (files/shell/HTTP/web/search/browser/MCP/delegate/jobs), durable jobs and transports (Discord/Telegram stubs), install/update/backup/restore, global pause, delegate conformance in the gate loop, fixture provider, and a Grok Build-style CLI.

Human-only v0.1.0 gates remain: macOS notarization, held-out correction eval, five-user usability check.

## Quick start

```sh
bun install
bun run check
bun test
bun run build

# Initialize user state (outside this repo)
./dist/keli init
./dist/keli doctor
./dist/keli inspect --json

# Headless one-shot (fixture provider for local dev)
./dist/keli -p "Rocket changes use Codex" --fixture
./dist/keli -p "Perform the next Rocket coding action." --fixture
```

## State directory

User state lives outside the release tree:

- Linux default: `~/.local/share/keli`
- Override: `KELI_STATE_DIR=/path/to/state`

Contains `state.sqlite`, `config.json`, and cache subdirectories.

## CLI (Grok Build-style)

| Command | Purpose |
|---------|---------|
| `keli init` | Create state, run migrations, seed owner/project |
| `keli setup` | Explained wizard: models, one transport, route binding, optional test |
| `keli doctor` | Health checks (schema, paths, readiness) |
| `keli inspect [--json]` | Rules, projects, schema version |
| `keli -p "..."` | Headless one-shot turn |
| `keli run -p "..."` | Same as `-p` |
| `keli capabilities` | List indexed capabilities |
| `keli invoke <cap>` | Run a gated capability (`--path`, `--url`, `--command`, etc.) |
| `keli jobs` | Scheduled jobs: `list`, `add`, `tick`, `occurrences`, `pause` |
| `keli discord` | Discord transport: `send`, `ingest`, `process` (fixture-backed) |
| `keli telegram` | Telegram transport: `send`, `ingest`, `process` (fixture-backed) |
| `keli routes` | Transport route bindings: `list`, `bind` |
| `keli version` | Version and build metadata |
| `keli update` | Check (`--check`), install (`--install`), or rollback |
| `keli backup` / `keli restore` | State backup/restore (no credentials; restore pauses jobs) |
| `keli pause` / `keli resume` / `keli stop` | Global execution control |

Stubs reserved for later: `login`, `logout`, `sessions`, `agent stdio`.

See [docs/INSTALL.md](docs/INSTALL.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Development

```sh
bun run dev    # supervised dev with temp state
bun run release  # local build + smoke
```

See [PRD.md](PRD.md), [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md), and [CONTRIBUTING.md](CONTRIBUTING.md).

## Evidence

Sanitized architecture spike reports are in [docs/evidence/](docs/evidence/). Production code adapts Architecture B gate patterns; spike source is not imported.
