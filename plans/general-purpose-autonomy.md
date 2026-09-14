# Plan: finish Keli through reuse and focused autonomy improvements

Status: current development plan on `feat/v0.1.0`. Continues the general-purpose
autonomy work; does not start another architecture proposal. The PRD remains the
product completion contract. Compact ledger:
[docs/evidence/COMPLETION_LEDGER.md](../docs/evidence/COMPLETION_LEDGER.md).

Implementation baseline: `d9e51d2` on `feat/v0.1.0` (clean primary worktree). That
commit already contains structured CLI tools, the general responsibility controller,
and three scripted cross-domain scenarios. This plan completes ordinary capabilities
by **ADOPT → ADAPT → BUILD**, then evaluates usefulness on the same controller.

Validation at `d9e51d2`: `bun test` is the regression baseline (temporary
`KELI_STATE_DIR`). Those checks do not certify live providers, transports, or Rocket.

Provider expansion is implemented in the shared setup/auth/factory path. See the
[connection guide](../docs/providers.md) and
[provider evidence](../docs/evidence/HERMES_PROVIDERS.md). Continue with real user
onboarding and observed failures; no additional provider architecture or portfolio
implementation is required by this slice.

## Product direction

**Keli is the general-purpose agent. Rocket and other tools provide domain capabilities.**
Portfolio management, Augustine/Shaul research, and software-maintenance triage are examples
used to expose failures in memory, analysis, initiative, and follow-through.

This replaces the previous proposal to build wallet adapters, portfolio calculations, and
protocol decoding inside Keli.

The intended boundary is:

**User responsibility → Keli investigates and coordinates → domain tools return evidence →
Keli evaluates progress and reports**

Rocket already documents a bot-independent interface: `rocket <workflow> --json →
ResearchResult`. Its results distinguish operational health from research outcomes. Preserve
that distinction.

## What is already implemented

The following is current runtime truth. Historical spike documents remain dated snapshots.

| Capability | Status | Where |
|---|---|---|
| Approved watches, fingerprints, HEARTBEAT import, pause/approve | implemented, fixture-verified | `src/watches/` |
| Resumable research occurrences, cumulative budgets, dependency waits | implemented, fixture-verified | `ResearchResponsibilityService` in `src/core/behavior.ts`; `src/watches/occurrences.ts` |
| Inspect/retrieve/verify research loop, addressed observations | implemented, fixture-verified | `src/conversation/`, `src/watches/autonomy.ts` |
| Evidence-bound occurrence completion; invocation ≠ verified | implemented, fixture-verified | `src/core/evidence.ts`, `ResearchResponsibilityService.finish` |
| Material-change outbox; delivery retry does not repeat research | implemented, fixture-verified | `src/watches/autonomy.ts`, `src/transports/outbox.ts` |
| Augustine/Shaul and Cava source-collection scenarios | implemented, fixture-verified | `tests/integration/`, `docs/evidence/research-autonomy/` |
| 2026 mechanism matrix, A–J micro-tests, Hermes/Nanobot probes | historical research evidence | `docs/research/`, `docs/evidence/2026-fast-spike/`, `experiments/2026-fast-spike/` |
| Generic structured external-CLI tools (Rocket profile) | implemented, fixture-verified | `src/tools/`, `tools.rocket`; live Rocket deferred |
| General responsibility contract beyond source-collection watches | implemented, fixture-verified | `kind: responsibility`, `src/watches/review.ts`; live cadence deferred |
| Evidence-directed investigation across domains | implemented, fixture-verified | same occurrence controller; cross-domain live use deferred |
| Cross-domain portfolio / Augustine / maintenance scenarios | fixture-verified (scripted) | `tests/integration/responsibility-scenarios.test.ts`; live use deferred |
| Operating guide | implemented | [docs/responsibilities.md](../docs/responsibilities.md) |
| Live provider / live Rocket evaluation | deferred onboarding milestone | section 3 |
| Learned memory policies, RL controllers, general world models | deferred | research matrix M06–M08, M12 |

`verified` still means the declared evidence/coverage contract passed. It is not semantic
truth.

## 2. Completion stages (this work)

Follow ADOPT → ADAPT → BUILD per [ledger](../docs/evidence/COMPLETION_LEDGER.md) row.
Preserve working Keli implementations. Do not import Hermes/Nanobot as a second runtime.

1. **Ledger and product defaults.** Neutral project name (`personal`) unless supplied;
   preserve existing names; Rocket stays an optional tool profile.
2. **Transports.** Telegram Bot API receiver/sender/reconnect connected to existing
   inbox, pairing, and outbox. Discord poll uses the same reconnect helper.
3. **Model onboarding.** Successful OpenAI-compatible / Grok round-trip is an ordinary
   setup outcome. ChatGPT-account via Codex App Server is assessed in
   [CODEX_APP_SERVER.md](../docs/evidence/CODEX_APP_SERVER.md): **not** a conversation
   provider; optional gated coding delegate only.
4. **Tools, search, MCP, delegates.** Replace fixture-only dispatch with resolved
   integrations; keep fixture paths. MCP JSON-RPC (HTTP + stdio); search HTTP/Brave;
   Codex app-server JSON-RPC behind `delegate.run`.
5. **Operational lifecycle.** systemd user unit and launchd agent; `keli service run`
   composes existing job/watch/transport ticks.
6. **Evaluation.** One bounded round of the three scenarios (scripted always; live when
   binaries/keys exist). Open a paper only if a listed failure appears.
7. **Release report.** Implemented/fixture-verified vs live vs awaiting owner/hardware.

## 2b. Already implemented: responsibilities that use tools intelligently

### A. General responsibility contract

Extend the existing approved-watch/occurrence machinery with a reusable responsibility
definition containing:

- Objective, scope, current constraints, and completion criteria.
- Approved capabilities and action boundaries.
- Event triggers and scheduled review cadence.
- Investigation budget, unresolved dependencies, and reporting preference.
- Current hypotheses, previous findings, and next-review conditions.

Support event-driven work and scheduled reassessment through the existing scheduling system.

The portfolio example uses **a daily brief plus meaningful event alerts**. Default its daily
review to 09:00 UTC until configured otherwise. This is an explicit scheduled occurrence, so
it can reassess a thesis even without a changed feed. Repeated ticks within that period must
not duplicate the review.

Other responsibilities choose their own cadence and reporting policy. Daily financial
reporting must not become Keli’s universal behavior.

### B. Structured external-tool integration

Extend the existing capability registry and gated dispatch path to support bounded,
structured research tools beyond the current source-tool allowlist.

Introduce a generic external-CLI adapter with:

- Configured executable and argument arrays; no model-generated shell command.
- Declared input/output schemas, version, action class, and resource boundaries.
- Owned process lifetime, timeout, cancellation, output limits, and usage accounting.
- Recoverable raw-result artifacts and a compact model-visible projection.

Use Rocket as the first integration profile. Configure its executable and private state paths
externally (`ROCKET_BIN`, `ROCKET_STATE_DIR`, or equivalent config keys). Record the tested
Rocket revision and supported workflows.

Map Rocket’s existing `ResearchResult` into Keli’s evidence contract without conflating:

- Successful command execution.
- Healthy or unavailable data acquisition.
- Sufficient or insufficient research evidence.
- A domain finding.
- Fulfilled responsibility.
- Delivered notification.

Keep wallet discovery, chain support, Ondo interpretation, Reserve look-through, valuations,
macro acquisition, and financial calculations in Rocket or other domain tools. Do not
duplicate those engines in Keli.

A missing domain capability becomes an explicit integration gap. Keli must not silently
replace unavailable calculations or retrieval with invented model output.

### C. Evidence-directed investigation

Build on the current occurrence state and recoverable observations. The general controller
should:

1. Establish current objective and constraints.
2. Inspect available capabilities and evidence.
3. Identify the most consequential unresolved question.
4. Retrieve or calculate through approved tools.
5. Challenge the emerging conclusion with relevant counterevidence.
6. Verify completion criteria and report or persist a targeted wait.

Persist attempted questions, evidence references, observed failures, and the reason for
changing approach. Suppress equivalent unsuccessful attempts on unchanged inputs while
retaining bounded transient retries.

A tool reporting “no finding” does not automatically complete the responsibility. Keli must
establish whether the tool answered the relevant question, had adequate coverage, and used
sufficiently current inputs.

Likewise, unchanged holdings do not establish an unchanged investment assessment; unchanged
source files do not establish that a scheduled review is unnecessary.

### D. Current context, verification, and reporting

Route a compact projection of current commitments and constraints into each decision.
Retrieve detailed history on demand. Old summaries must not override corrected rules.

Extend evidence records with optional source-defined coverage, freshness, effective-time, and
verification metadata. Preserve unknown values rather than inventing generic freshness rules
for every domain.

Keep these separate:

- Provenance and quote checks.
- Deterministic calculation or execution checks.
- Analytical interpretation.
- Completion and delivery status.

Models may propose conclusions and next actions. Authoritative core services commit durable
behavior and terminal truth (`src/core/gate.ts`, `src/core/capability-gate.ts`,
`ResearchResponsibilityService` in `src/core/behavior.ts`).

Reports must explain implications and next steps, not merely list retrieved content. A valid
“no change recommended” conclusion includes what was examined, why the previous assessment
still holds, limitations, and what would change it.

Continue using the existing outbox so delivery retries never repeat analysis.

## 3. Research hypotheses and acceptance scenarios

Use the existing paper research selectively. Each experiment compares the current
implementation with one bounded change on identical inputs.

| Direction | General capability to test | Acceptance evidence |
|---|---|---|
| InMind-inspired context routing | Apply a relevant constraint even when the new request does not repeat its wording. | Correct, current constraint used; no cross-project leakage. |
| Scroll/ReFind-inspired retrieval | Recover exact earlier evidence omitted from recent summaries. | Relevant passage recovered within a fixed retrieval budget. |
| PMCoder-inspired phase/memory coupling | Use prior observations to choose a better next investigation after failure. | Useful changed approach and reduced need for user steering—not merely earlier stopping. |
| Typed uncertainty | Distinguish unavailable tools, missing evidence, stale inputs, conflicting evidence, and unresolved interpretation. | Each condition produces an appropriate investigation, wait, or qualified conclusion. |
| Bounded capability discovery | Find a necessary approved tool that was initially absent from model context. | Successful discovery without loading every schema or expanding authority. |
| Verification-grounded completion | Reject plausible completion claims unsupported by required receipts or evidence. | Unsupported results remain unverified; valid evidence closes the occurrence. |

These are narrow engineering hypotheses informed by the [research matrix](../docs/research/2026-agent-architecture-matrix.md),
not reproductions of complete paper systems. Defer learned memory policies, RL controllers,
general world models, and another broad literature survey.

### Scenario 1: portfolio analyst using Rocket

Configure the wallet privately and let Rocket or the selected tools retrieve its positions
and domain evidence.

Use Solana/Ondo and Base/Reserve examples to exercise different data requirements—not to
hard-code blockchain concepts into Keli.

Reproduce the combined failure pattern described by the user:

- Holdings are remembered, but new macro evidence changes their interpretation.
- X/Grok, Cava, and macro inputs conflict or have incomplete coverage.
- A tool returns “nothing new,” despite an unresolved analytical question.
- Keli must investigate, explain implications, retain constraints, and identify the next
  meaningful check.
- Produce paper options only when domain capabilities and evidence support them. No signing,
  orders, swaps, or approvals.

### Scenario 2: Augustine/Shaul research

An older correction and missing source determine whether an attribution is justified. Keli
retrieves the relevant evidence, preserves disagreement, resumes after the dependency
arrives, and does not leak the correction into another project.

This scenario already has a fixture path for source-collection watches. The same
responsibility controller must also cover it after the generalization.

### Scenario 3: software-maintenance triage

An approved read-only maintenance responsibility receives a failure report. The first
diagnostic is misleading or unavailable. Keli discovers the appropriate tool, retrieves
previous evidence, performs a bounded authorized check, and reports a verified diagnosis or
concrete blocker.

No automatic code edits or deployment are required for this scenario.

**All three scenarios must use the same responsibility controller.** Domain changes should
require tool/configuration changes, not branches in Keli’s core.

Measure steering turns, relevant evidence recovered, repeated failed attempts, unsupported
conclusions, duplicate work/reports, and budget consumption. Use scripted providers for
deterministic failures and label them clearly.

Real-model evaluation remains a later onboarding milestone. Preserve the intended
ChatGPT-account connection and Grok access requirements without assuming subscription access
automatically provides every needed integration.

## 4. Repository portability and private-data boundaries

Remove personal-device paths from all tracked current content, including imported research
files and generated evidence.

- Repository material uses relative references.
- External repositories, executables, private state, and wallet inputs use configuration or
  named environment variables.
- Private-source hyperlinks become stable evidence IDs with source descriptions and version
  pins. Do not fabricate public replacements.
- Sanitized historical artifacts must be labeled as derivatives. Preserve provenance and
  original hash references where applicable; do not describe changed bytes as original
  evidence. See [docs/evidence/2026-fast-spike/ORIGINAL_HASHES.json](../docs/evidence/2026-fast-spike/ORIGINAL_HASHES.json)
  and [docs/evidence/PORTABILITY.md](../docs/evidence/PORTABILITY.md).
- Update generators so future reports remain portable.
- Keep real wallet addresses, holdings, credentials, and private reports outside Git. Commit
  synthetic or explicitly sanitized fixtures.
- `bun run check` rejects embedded personal-home paths and broken local documentation links.
  Runtime discovery of a user’s home directory remains valid.
- Verify operation from a differently named temporary checkout with temporary
  `KELI_STATE_DIR`.

Do not rewrite published Git history as part of this cleanup. Report historical references
separately in [docs/evidence/PORTABILITY.md](../docs/evidence/PORTABILITY.md).

## 5. Delivery sequence

Fixture-verified slices 1–4 (research consolidation, structured tools, responsibility
controller, scripted scenarios) are on `feat/v0.1.0` through `d9e51d2`.

This completion pass:

1. Completion ledger, Codex App Server assessment, updated plan.
2. Neutral project default (preserve existing names).
3. Telegram Bot API + shared reconnect; Discord poll backoff.
4. Search/MCP real integration paths; Codex app-server as gated delegate.
5. Setup round-trip; systemd/launchd; operating docs and release report.

Run existing checks and targeted regressions for authority, cancellation, process
ownership, migration, restart, budgets, and outbox. Extra review for `src/state/`,
`src/core/gate.ts`, `src/execution/`, `scripts/build.ts`, and `install/`.

The final handoff on `feat/v0.1.0` must contain:

- One current development plan (this file) and an updated
  [implementation prompt](../docs/architecture/keli-autonomy-implementation-prompt.md).
- The research decision matrix and reproducible supporting evidence.
- Clear distinctions between implemented, fixture-verified, live-verified, and deferred
  capabilities.
- A generic responsibility example plus the three domain demonstrations.
- A short summary of changes, validation, and remaining blockers.

Success means Keli can carry an approved responsibility across tools, evidence gaps, and
interruptions in multiple domains. Portfolio management is the demanding example that
exposes weaknesses—not the definition of the product.

## Generic responsibility example

```markdown
## portfolio-daily
- kind: responsibility
- objective: Maintain a current investment assessment of the configured wallet using approved tools only.
- cadence: daily:09:00Z plus material tool/source events
- capabilities: rocket.research (read), sources.search, sources.read
- notify: daily-brief + material-change
- completion: supported assessment or explicit blocker (missing tool, stale input, unresolved conflict)
- forbidden: signing, orders, swaps, approvals, invented valuations
```

Cadence, capabilities, and notify policy belong to the approved contract. A source-collection
research watch remains one specialization of this shape, not a second product.

## Reuse and research trace

| Capability | Decision | Source / trace |
|---|---|---|
| Approved watch, scoped dispatch, budget, occurrence ownership, outbox | ADOPT existing Keli | `e32b2ad`; I1–I5, I9–I10; A11–A16, A19–A22, A32, A39 |
| Addressed evidence and current canonical context | ADAPT Scroll/InMind using existing stores | [Decision matrix](../docs/architecture/keli-agent-architecture-proposal.md) M01/M05 |
| Phase/evidence-guided continuation | ADAPT the existing research controller; generalize beyond source collections | Matrix M03; H11 |
| Structured external tools | BUILD generic CLI adapter; ADOPT Rocket `ResearchResult` as evidence, not as authority | Section B; keep domain engines outside Keli |
| Evidence-bound terminal status | ADAPT existing checker/core | Matrix M17; A24 analogous false-completion contract |

Reference pins: Hermes `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` and Nanobot
`f49965445152361b779b465e8a5111549ac934c4`, both MIT. Telegram/Discord channel Python
is not copied; Bot API / REST protocols are adopted. Codex App Server is Apache-2.0 and
is used only as a gated coding delegate — see
[CODEX_APP_SERVER.md](../docs/evidence/CODEX_APP_SERVER.md). Paper/source links remain in
the [research matrix](../docs/research/2026-agent-architecture-matrix.md).

## Live account milestone follow-up

The account-backed Keli conversation has now been exercised, along with retrieval,
a durable correction across restart, and bounded scheduled reviews. See
[the live results](../docs/evidence/LIVE_ACCOUNT_RESULTS.md). The previous blanket
ChatGPT incompatibility conclusion is superseded. Reuse is a pinned model/OAuth
library, not an imported second agent runtime.

Live tests exposed budget-terminalization and configured-tool discovery defects;
these are fixed in Keli without changing the responsibility architecture. Rocket
remains an optional external diagnostic scenario, not a product default.
