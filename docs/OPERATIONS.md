# Operations

## Backup and restore

```sh
keli backup --out ~/keli-backups/$(date +%F)
keli restore --from ~/keli-backups/2026-09-11
```

Backups include `state.sqlite`, sanitized `config.json`, and a checksum manifest. **Credentials are never included.**

Restore behavior (A31):

- All jobs are set to `paused`
- Global autonomy is paused (`stopAllExecution`)
- Outbox is not replayed automatically
- Resume only after routes/grants are revalidated: `keli resume --revalidated`

## Global pause / stop / resume

```sh
keli pause          # block scheduler + effectful capabilities
keli stop           # stronger stop-all
keli resume --revalidated   # after restore or manual reconnect
```

While paused:

- `keli doctor`, `keli inspect`, and conversation-style commands still work
- Scheduled jobs do not tick
- Effectful capabilities (`mutate`, `effect`) are blocked at the gate

## Structured domain tools

Rocket and other CLIs stay outside Keli. Configure the executable and private state with
environment variables or config; never commit wallet inputs.

```sh
export ROCKET_BIN=/path/to/rocket
export ROCKET_STATE_DIR=/path/to/private-rocket-state
keli config set tools.rocket.revision <tested-git-sha>
keli invoke tools.rocket --workflow health --json
```

`tools.rocket` is read-only. A successful command is not a sufficient research result and
does not close a responsibility. Default source-collection research watches cannot call it.
Approve a `kind: responsibility` watch that lists `tools.rocket` (and use
`capabilities.lookup` to load its schema). A missing binary is reported as
`integration_gap`.

```md
## portfolio-daily
- kind: responsibility
- objective: Maintain a current assessment with approved tools only
- capabilities: tools.rocket
- notify: daily-brief
```

`keli watches import` compiles that as a proposal. Nothing runs until `keli watches approve`.
Daily 09:00 UTC is this watch's schedule, not Keli-wide behavior. `verified` still means the
declared evidence contract passed, not that the investment thesis is true.

## Known limits (current increments)

- **0.1-A–E shipped:** packaging, backup/restore, global pause, fixture-backed transports in CI
- **0.1-F–I remaining** before `v0.1.0` tag: Honcho adapter, broader providers/delegates, routing/budgets/skills, helper fan-out, release evidence
- Discord/Telegram live tokens optional until integration validation in 0.1-F
- Held-out correction eval, five-user usability check, and macOS notarization are **0.1-I** human gates
