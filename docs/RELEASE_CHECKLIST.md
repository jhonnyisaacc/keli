# Five-user release checklist (0.1-I, not executed in CI)

Record results before tagging `v0.1.0`. Each row is pass/fail with date and operator initials.

| # | Scenario | Pass | Date | Notes |
|---|----------|------|------|-------|
| 1 | Fresh `install/bootstrap.sh` on Linux | | | |
| 2 | `keli init` + teach one project rule | | | |
| 3 | Headless action with fixture provider | | | |
| 4 | `keli backup` / `keli restore` round-trip | | | |
| 5 | `keli pause` blocks effectful invoke | | | |
| 6 | Discord or Telegram fixture route bind | | | |
| 7 | `keli notes add` + search finds entry | | | |
| 8 | Job with mutate grant runs `files.write` | | | |
| 9 | `keli doctor` clean on supported OS | | | |
| 10 | `keli update --check` reads manifest | | | |

**Leftover:** live provider held-out eval ≥95%, macOS notarization, four-target native smoke on real hardware.
