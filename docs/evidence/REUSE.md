# Spike reuse notes (0.1-A)

| Spike | Pin / path | Adopted pattern | Not copied |
|-------|------------|-----------------|------------|
| Architecture B | `personal-agent-b` | Bun-owned gate, SQLite rules/actions/effects, prepare→finish | Python Nanobot child, flat test harness |
| Native slice | `personal-agent-native-spike` | Bun.serve fixture, proposal-only adapter | 29-line spike as production loop |
| E1 | `personal-agent-e1` c4a25c9 | Enum validation, explain projection | Nanobot foundation, tool-local gate |

Contract tests in `tests/invariants/` trace to PRD A01–A11.
