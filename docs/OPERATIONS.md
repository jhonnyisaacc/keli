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

## Known limits (0.1.0)

- Discord/Telegram use fixture transports in CI; live tokens optional
- Held-out correction eval and five-user usability check are human gates
- macOS notarization requires release signing keys
