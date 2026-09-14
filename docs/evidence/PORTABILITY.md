# Portability notes

Current tracked content must not embed personal-device home paths. Runtime discovery of the
current user’s home directory remains valid.

## Sanitized derivatives

Imported 2026-fast-spike artifacts on this branch are **sanitized derivatives** of
`research/2026-fast-spike` commit `a4adf90fafa176df9aa259967d9ff78053de3cf7`. Original
byte hashes are in [2026-fast-spike/ORIGINAL_HASHES.json](2026-fast-spike/ORIGINAL_HASHES.json).
Do not treat sanitized JSON/markdown as the original evidence bytes.

Sanitization rule used here: personal-home prefixes (`/home/<user>`, `/Users/<user>`) became
`$HOME` or named environment variables. Commit pins, measured metrics, and source-file
hashes inside `reference-index.json` were not rewritten.

Private-source hyperlinks in [DISCOVERY.md](DISCOVERY.md) were converted to surrounding
evidence IDs (L1–L22). Sibling spike report links (`personal-agent-e1`, `personal-agent-b`,
and the parallel spike trees) now point at in-repo summaries or [REPORT.md](REPORT.md).
Those original trees were not copied into this repository and have no fabricated public
replacements.

## Historical Git references (not rewritten)

Published history still contains personal-home paths. Do not rewrite it.

| Location | Notes |
|---|---|
| `research/2026-fast-spike` (`45554f3`–`a4adf90`) | Original spike docs, recon, traces, and probe runner |
| `feat/v0.1.0` through `e32b2ad` | [DISCOVERY.md](DISCOVERY.md) and [REPORT.md](REPORT.md) before this sanitization |
| `codex/evidence-driven-autonomy` | Same tip as `e32b2ad`; not a required worktree for this plan |

## External configuration

| Name | Purpose |
|---|---|
| `KELI_STATE_DIR` | Isolated runtime/test state |
| `KELI_HERMES_ROOT` | Optional pinned Hermes checkout for reference probes |
| `KELI_NANOBOT_ROOT` | Optional pinned Nanobot checkout for reference probes |
| `ROCKET_BIN` | Rocket executable (future structured-tool profile) |
| `ROCKET_STATE_DIR` | Rocket private state (future; never commit) |
