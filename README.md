# Keli

Keli (כלי) is a personal-first agent: teach it how to work once, and durable scoped corrections govern future execution across restarts and upgrades.

This repository implements the **v0.1.0** product on branch `feat/v0.1.0` in vertical increments. **0.1-A through 0.1-I** are implemented in code (core runtime, capabilities, jobs/transports, packaging/ops, memory/providers, routing/budgets/skills, helper fan-out, release harness). **Do not tag `v0.1.0`** until human gates are recorded (notarization, live held-out eval, five-user check, native four-target smoke).

Current code includes: Bun runtime, SQLite state, authority gates, Linux Landlock sandbox, capability dispatch (files/shell/HTTP/web/search/browser/MCP/delegate/jobs/helpers), local notes and optional Honcho fixture adapter, provider routing and run budgets, durable skill pins, durable jobs and transports (Discord/Telegram stubs), install/update/backup/restore, global pause, delegate conformance in the gate loop, fixture provider, and a Grok Build-style CLI.

Human-only release gates (increment **0.1-I**): macOS notarization, held-out correction eval, five-user usability check.

## Quick start

```sh
bun install
bun run check
bun test
bun run build

# Initialize user state (outside this repo)
./dist/keli init
# or: ./dist/keli init --project emunah
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
| `keli init` | Create state, run migrations, seed owner/project (`personal` unless `--project`) |
| `keli setup` | Registry-driven wizard: project name, provider round-trip, one transport, optional delegate; `--quick` / `--minimal` |
| `keli doctor [--fix]` | Health checks plus integration probes (safe repairs only) |
| `keli integrations` | `list [--kind]` and `discover` (static catalog; never installs) |
| `keli auth` | `add` / `list` / `status` / `remove` / `logout` (keychain refs) |
| `keli config` | `get` / `set` — single config mutation path |
| `keli chat` | CLI recovery REPL over the model loop |
| `keli skills` | `list` / `show` / `pin` / `activate` / `rollback` |
| `keli memory` | `compact` / `conversations` |
| `keli inspect [--json]` | Rules, projects, schema version |
| `keli -p "..."` | Headless one-shot turn |
| `keli run -p "..."` | Same as `-p` |
| `keli capabilities` | List indexed capabilities |
| `keli invoke <cap>` | Run a gated capability (`--path`, `--url`, `--command`, etc.) |
| `keli jobs` | Scheduled jobs: `list`, `add`, `tick`, `occurrences`, `pause` |
| `keli discord` | Discord transport: `send`, `ingest`, `process`, `poll` |
| `keli telegram` | Telegram transport: `send`, `ingest`, `process`, `poll` |
| `keli service` | `install` / `status` / `run` (systemd user or launchd unit; tick loop) |
| `keli routes` | Transport route bindings: `list`, `bind` |
| `keli notes` | Local advisory notes: `add`, `list`, `search` |
| `keli providers` | Alias of `integrations list --kind model-provider` |
| `keli version` | Version and build metadata |
| `keli update` | Check (`--check`), install (`--install`), or rollback |
| `keli backup` / `keli restore` | State backup/restore (no credentials; restore pauses jobs) |
| `keli pause` / `keli resume` / `keli stop` | Global execution control |

`login` / `logout` alias `keli auth`. `sessions list` is live. `agent stdio` remains post-v0.1.0.

See [docs/INSTALL.md](docs/INSTALL.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Development

```sh
bun run dev    # supervised dev with temp state
bun run release  # local build + smoke
```

See [PRD.md](PRD.md), [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md), and [CONTRIBUTING.md](CONTRIBUTING.md).

Current development plan: [plans/general-purpose-autonomy.md](plans/general-purpose-autonomy.md).
Keli is the general-purpose agent; Rocket and other tools provide domain capabilities.
The earlier in-Keli wallet/portfolio-engine proposal is superseded.

## Evidence

Sanitized architecture spike reports are in [docs/evidence/](docs/evidence/). Production code adapts Architecture B gate patterns; spike source is not imported. The 2026 mechanism matrix and fast-spike evidence now live in-tree under [docs/research/](docs/research/2026-agent-architecture-matrix.md) and [docs/evidence/2026-fast-spike/](docs/evidence/2026-fast-spike/README.md).
