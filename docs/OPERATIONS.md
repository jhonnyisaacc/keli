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

Full operating path: [responsibilities](responsibilities.md). Scenario evidence:
[general-purpose autonomy](evidence/general-purpose-autonomy/README.md).

## Known limits (current increments)

- ChatGPT-account conversation is implemented (pi-ai). Catalog ids are optional; live-verified means the selected model passed a probe, not that every listed provider works.
- Discord/Telegram live tokens are optional. Pair with `KELI-PAIR` from the bound chat, or stay on CLI (`keli setup --transport none`). Fixture and REST backends stay on inbox/outbox.
- Search, MCP, Rocket, and browser captures are optional connections. Missing ones return `missing_access` or `integration_gap` instead of invented results.
- Honcho, OCR, speech, and extra search backends are not v0.1.0 requirements.
- Held-out correction eval, five-user usability check, dual-transport proof, and macOS notarization are owner/hardware gates (ledger L13)

## User service (Linux systemd / macOS launchd)

```sh
keli service install
# Linux (user lingering is the operator's choice):
# systemctl --user enable --now keli.service
# macOS:
# launchctl load ~/Library/LaunchAgents/io.keli.plist
keli service run          # one jobs + watches + transport cycle
keli service run --loop 30
```

Units are **generated** by `keli service install` from `src/ops/service.ts` (systemd user
unit or launchd plist). There are no committed `install/keli.service` templates. Install
writes to `~/.config/systemd/user` or `~/Library/LaunchAgents` unless `KELI_SERVICE_DIR`
is set. This does not enable lingering or pre-login macOS execution.
