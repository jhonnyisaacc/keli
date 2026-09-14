# Isolated deterministic architecture spike

Historical A–J harness imported from `research/2026-fast-spike`. Replay from this
repository; do not overwrite committed evidence directories.

```sh
bun test experiments/2026-fast-spike/contracts.test.ts
# optional new replay directory only:
bun run experiments/2026-fast-spike/run.ts --out docs/evidence/2026-fast-spike/run-local-replay
```

`--only A,B` selects experiments. `--out` must be a new directory beneath
`docs/evidence/2026-fast-spike`; existing runs are never overwritten. A private temporary
`KELI_STATE_DIR` is created automatically; only its own temporary files are removed. No
environment credentials or production databases are read. Reference agents are inspected
statically, not launched.

Pinned Hermes/Nanobot unit probes:

```sh
KELI_HERMES_ROOT=/path/to/hermes-agent \
KELI_NANOBOT_ROOT=/path/to/nanobot \
python3 experiments/2026-fast-spike/reference-probes/run.py --check
```

`--check` replays contracts against saved evidence and does not require the reference
checkouts unless units need to be reloaded. To regenerate probes, both roots must point at
the recorded pins.

Adapters are independent and have no production imports pointing at them. A/B/D/J call
actual Keli storage/gate primitives where stated. All other baselines are scripted
controls, never reported as Hermes/Nanobot/Keli end-to-end results. A is not a persistent
Python kernel. B is SQLite FTS5 with fixed corpus statistics and no Porter stopword
pipeline, not exact ReFind. C/E/H/I are fixed policies, not model planning, learned
semantic rules or trained skill decoding. G is a typed fixed hook, not arbitrary generated
code. This deliberately exposes how much of a plausible gain is merely harness behavior.
