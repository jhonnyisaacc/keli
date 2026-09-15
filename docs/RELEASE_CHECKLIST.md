# Five-user release checklist (0.1-I, not executed in CI)

Record results before tagging `v0.1.0`. Each row is pass/fail with date and operator initials.

Executed 2026-09-15 by the release agent against the compiled Linux x64 binary installed by
`install/bootstrap.sh` from the local `dist/manifest.json`, with a temporary `KELI_STATE_DIR`
and the fixture provider/integration servers. Operator `AG` denotes an agent-run fixture pass
on one host; it is not a five-user or second-OS result.

| # | Scenario | Pass | Date | Notes |
|---|----------|------|------|-------|
| 1 | Fresh `install/bootstrap.sh` on Linux | pass (AG) | 2026-09-15 | Checksum verified from manifest; symlink installed under a temporary `KELI_INSTALL_BIN` |
| 2 | `keli init` + teach one project rule | pass (AG) | 2026-09-15 | `init --project Rocket`; "Rocket changes use Codex" committed as `coding.delegate=Codex` revision 1 |
| 3 | Headless action with fixture provider | pass (AG) | 2026-09-15 | `-p "Perform the next Rocket coding action." --fixture` executed with delegate Codex |
| 4 | `keli backup` / `keli restore` round-trip | pass (AG) | 2026-09-15 | Rule present after restore; jobs paused until `resume --revalidated` |
| 5 | `keli pause` blocks effectful invoke | pass (AG) | 2026-09-15 | `files.write` inside the allowed root returned `autonomy_paused`; no file written |
| 6 | Discord or Telegram fixture route bind | pass (AG) | 2026-09-15 | `routes bind --transport discord --id 123456` listed for the default scope |
| 7 | `keli notes add` + search finds entry | pass (AG) | 2026-09-15 | First run failed: hyphenated query reached FTS5 raw (`SQLiteError`). Fixed by quoting terms; re-run passed |
| 8 | Job with mutate grant runs `files.write` | pass (AG) | 2026-09-15 | No CLI grant command; covered by `tests/invariants/acceptance-0.1e.test.ts` A12/A13 (`grant_required` then success) |
| 9 | `keli doctor` clean on supported OS | pass (AG) | 2026-09-15 | First run failed: binary-only install had no `landlock-worker.py`. Worker is now embedded; re-run reported all checks passed |
| 10 | `keli update --check` reads manifest | pass (AG) | 2026-09-15 | Local `dist/manifest.json`; reported up to date |

**Leftover (owner milestones, not engineering):** five-user or assisted usability check on both
OS families, live provider held-out eval ≥95%, macOS notarization, four-target native smoke on
real hardware.
