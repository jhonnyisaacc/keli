# Boundary coverage matrix (0.1-I)

| Execution path | Gate authority | Fixture test | Notes |
|----------------|----------------|--------------|-------|
| Durable corrections | `gate.ts` / `behavior.ts` | `tests/invariants/correction.test.ts` | Model proposes only |
| Capability dispatch | `capability-gate.ts` | `tests/invariants/capability-gate.test.ts` | Adapters propose |
| Delegate handoff | `gate.actWithDelegate` | `tests/invariants/delegate-fallback.test.ts` | Fence + cancel epoch |
| Helper fan-out | `helpers.spawn` + `run-control` | `tests/invariants/acceptance-0.1h.test.ts` | A42 parent/child cancel |
| Job grants | `jobs/grants.ts` | `tests/invariants/acceptance-0.1g.test.ts` | Mutate/deploy gated |
| Global pause | `ops/control.ts` | `tests/invariants/global-pause.test.ts` | Effectful blocked |
| Transport outbox | `transports/outbox.ts` | `tests/integration/*-transport.test.ts` | Unknown ≠ delivered |
| Backup/restore | `ops/backup.ts` | `tests/invariants/backup-restore.test.ts` | Credentials excluded |
| Local memory | `memory/notes.ts` | `tests/invariants/acceptance-0.1f.test.ts` | Advisory only |
| Honcho adapter | `adapters/honcho.ts` | outage/delete fixture | Absent when disabled (A29) |
| Provider registry | `model/provider-registry.ts` | list + Grok fixture | Named-later unavailable |
| Routing/budgets | `routing.ts` / `budgets.ts` | `acceptance-0.1g.test.ts` | Pre-dispatch enforcement |
| Held-out corrections | `correction.ts` parser | `tests/acceptance/held-out/` | Fixture ≥95%; live leftover |
