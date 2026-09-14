# General-purpose autonomy: evidence and status

Implementation lives on `feat/v0.1.0`. This report distinguishes **implemented**,
**fixture-verified**, **live-verified**, and **deferred**. It is not a live-provider
evaluation.

Validation for the responsibility and scenario slices: `bun run check` passed;
`KELI_STATE_DIR` temporary `bun test` is recorded with the slice commits. Playwright
browser coverage may flake under load; isolate `tests/platform/playwright-browser.test.ts`
if needed. Those checks do not certify live models, transports, or Rocket.

## Status

| Capability | Status | Evidence |
|---|---|---|
| Approved watches, fingerprints, HEARTBEAT import | implemented, fixture-verified | `src/watches/`, [research-autonomy](../research-autonomy/README.md) |
| Resumable occurrences, budgets, waits, outbox | implemented, fixture-verified | `ResearchResponsibilityService`; research-autonomy tests |
| Structured CLI tools / Rocket profile | implemented, fixture-verified | `src/tools/`, `tests/unit/structured-tools.test.ts`; live Rocket deferred |
| Responsibility contract and scheduled slots | implemented, fixture-verified | `src/watches/review.ts`, `tests/integration/responsibility.test.ts` |
| Bounded capability discovery | implemented, fixture-verified | `capabilities.lookup`; responsibility + scenario tests |
| Portfolio / Augustine / maintenance scenarios | fixture-verified (scripted) | `tests/integration/responsibility-scenarios.test.ts` |
| Provider inventory and setup | fixture-verified | `provider-manifest.json`; `keli setup`; contract suites under `tests/unit/*-providers.test.ts` |
| Live Rocket daily brief | deferred | needs `ROCKET_BIN` / private state |
| Live-model quality | deferred onboarding milestone | ChatGPT-account and Grok access remain intended, not assumed |
| In-Keli wallet / portfolio engines | rejected | superseded by Rocket-as-tool |

`verified` means the declared evidence/coverage contract passed.

## Scenario measurements (scripted)

Providers are scripted. The CLI fixture is not a live Rocket binary. Counts below are
the scripted path, not model quality.

| Scenario | Steering / model calls | Recovered evidence | Repeated failed inspections | Unsupported close | Duplicate same-slot work | Notes |
|---|---|---|---|---|---|---|
| Portfolio analyst | 3 then 4 then 4 | Day-2 prompt retains prior hold claim | macro no-finding withheld twice | Day-2 stay `waiting_for_evidence` | Same UTC day is `not-due` | Swap workflow denied; holdings remembered; later `risk-off` after `macro-shift` |
| Augustine / Shaul | 2 then 0 then 2 | Same occurrence resumes after Shaul arrives | none required | First close withheld as missing Shaul | Unchanged wait makes 0 calls | `research.*` correction stays out of `project:other` |
| Maintenance triage | 5 | Lookup then second diagnostic | write denied once | First `diag-wrong` not used as the verified claim | one occurrence | `files.write` refused; verified text forbids deploy |

## Remaining blockers

- Pin and run a real Rocket revision against private wallet state.
- Live-model evaluation of daily briefs and maintenance triage.
- Transport acknowledgement of `daily-brief` on a dedicated Keli bot identity.

See the [operating guide](../../responsibilities.md),
[completion ledger](../COMPLETION_LEDGER.md),
[release report](../RELEASE_REPORT.md), and
[current plan](../../../plans/general-purpose-autonomy.md).
