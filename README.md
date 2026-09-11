# Keli

Keli (כלי) is a personal-first agent: teach it how to work once, and durable scoped corrections govern future execution across restarts and upgrades.

This repository implements increment **0.1-A**: Bun runtime, SQLite state, authority gate, fixture provider, and a Grok Build-style CLI.

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
| `keli doctor` | Health checks (schema, paths, readiness) |
| `keli inspect [--json]` | Rules, projects, schema version |
| `keli -p "..."` | Headless one-shot turn |
| `keli run -p "..."` | Same as `-p` |
| `keli version` | Version and build metadata |
| `keli update --check` | Check for updates (stub in 0.1-A) |

Stubs reserved for later: `login`, `logout`, `sessions`, `agent stdio`.

## Development

```sh
bun run dev    # supervised dev with temp state
bun run release  # local build + smoke
```

See [PRD.md](PRD.md), [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md), and [CONTRIBUTING.md](CONTRIBUTING.md).

## Evidence

Sanitized architecture spike reports are in [docs/evidence/](docs/evidence/). Production code adapts Architecture B gate patterns; spike source is not imported.
