# Agent and contributor boundaries

## Authority

- Only `src/core/gate.ts` and `src/core/behavior.ts` commit durable behavior and terminal action truth.
- Model output and tool responses are proposals only; never trust them for authorization.
- Adapters under `src/adapters/` (future) must not write canonical state directly.

## Reuse

Follow **ADOPT → ADAPT → BUILD** per capability. Record upstream pin, license, and PRD trace IDs (I1–I10, A01–A46) in integration notes.

## Evidence

Spike reports live in `docs/evidence/`. Architecture B (`personal-agent-b`) and native spike patterns inform the gate; E1 is a rejected foundation path.

## Secrets and tests

- No secrets in logs, skills, or committed fixtures.
- Tests use temporary `KELI_STATE_DIR`; never run invariant tests against production state.

## Sensitive paths

Changes to `src/state/`, `src/core/gate.ts`, `src/execution/` (future), `scripts/build.ts`, and `install/` require extra review.
