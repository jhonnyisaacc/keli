# Contributing to Keli

## Development setup

```sh
bun install
bun run check
bun test
bun run build
```

## Dependency updates

Keli does **not** use Dependabot. Dependency and GitHub Actions updates are intentional, reviewed PRs that regenerate `bun.lock`.

Run `bun audit` before release; critical/high exploitable findings block publication.

## Tests

Use an isolated state directory:

```sh
KELI_STATE_DIR=/tmp/keli-test-$$(date +%s) bun test
```

Never commit credentials or real user state.

## Architecture

See [AGENTS.md](AGENTS.md) and [PRD.md](PRD.md). Adapt spike patterns from `docs/evidence/`; do not import disposable experiment code into `src/`.
