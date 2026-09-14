# Implementation prompt: general-purpose autonomy

Use this prompt for the next Keli implementation session. It replaces the
evidence-driven research-watch prompt. The current plan is
[plans/general-purpose-autonomy.md](../../plans/general-purpose-autonomy.md).

Earlier portfolio-specific proposals (wallet adapters, in-Keli portfolio math, protocol
decoding) are superseded. Domain engines stay in Rocket and other tools.

---

Implement the remaining work in [plans/general-purpose-autonomy.md](../../plans/general-purpose-autonomy.md).
Deliver running code and cross-domain demonstrations, not another research report.

Start from `feat/v0.1.0` at `e32b2ad` or its reviewed successor. Inspect `AGENTS.md`, the
current plan, and the implementation before editing. Preserve subsequent work and other
agents’ uncommitted trees. If you do not own the primary working tree, create a dedicated
worktree. Do not merge older research-branch runtime files, reset/stash another agent’s
changes, or modify the research worktree. Do not push automatically.

The 2026-fast-spike matrix, experiments, and architecture proposal are now in this tree.
They are design evidence. The current runtime already implements evidence-driven
source-collection watches. Do not re-implement that slice. Do not treat historical Keli
columns frozen at `40743b5` as current behavior.

## Objective

Keli is the general-purpose agent. Rocket and other tools provide domain capabilities. The
boundary is:

**User responsibility → Keli investigates and coordinates → domain tools return evidence →
Keli evaluates progress and reports**

Build one responsibility controller that can carry an approved commitment across tools,
evidence gaps, and interruptions in multiple domains. Portfolio management is a demanding
example, not the product definition.

## Already implemented on this branch

Structured CLI tools (`tools.rocket`) and the general responsibility controller
(`kind: responsibility`, scheduled review slots, `capabilities.lookup`, investigation
receipts, no-finding waits) are fixture-verified. Do not re-implement them.

## Remaining work (live only)

Fixture-verified work on this branch is complete: structured tools, the responsibility
controller, and the three scripted domain scenarios. Remaining work is live Rocket,
live-model quality, and transport acknowledgement — not another controller rewrite.

Historical implementation notes for the finished slices remain below.

### 1. Generic structured-tool integration (Rocket first) — done

Extend the capability registry and gated dispatch path with a bounded external-CLI adapter:

- Configured executable and argument arrays. No model-generated shell command.
- Declared input/output schemas, version, action class, and resource boundaries.
- Owned process lifetime, timeout, cancellation, output limits, and usage accounting.
- Recoverable raw-result artifacts and a compact model-visible projection.

Rocket is the first profile. Configure `ROCKET_BIN` / `ROCKET_STATE_DIR` (or equivalent
config keys) externally. Record the tested revision and supported workflows. Map
`rocket <workflow> --json → ResearchResult` into Keli’s evidence contract without
conflating command success, acquisition health, evidence sufficiency, domain findings,
responsibility fulfillment, or notification delivery.

Keep wallet discovery, chain support, Ondo/Reserve interpretation, valuations, macro
acquisition, and financial calculations in Rocket. A missing domain capability is an
explicit integration gap. Do not invent those results in the model.

### 2. General responsibility contract and scheduling

Extend approved-watch/occurrence machinery with a reusable responsibility definition:
objective, scope, constraints, completion criteria, approved capabilities, action
boundaries, event triggers, scheduled review cadence, investigation budget, unresolved
dependencies, reporting preference, hypotheses, previous findings, and next-review
conditions.

Support event-driven work and scheduled reassessment through the existing scheduler.
Portfolio’s default daily review is 09:00 UTC until configured otherwise; repeated ticks
inside that period must not duplicate the review. Daily financial reporting is not Keli’s
universal behavior.

### 3. Evidence-directed investigation and reporting

Generalize the current inspect → retrieve → verify controller:

1. Establish current objective and constraints.
2. Inspect available capabilities and evidence.
3. Identify the most consequential unresolved question.
4. Retrieve or calculate through approved tools.
5. Challenge the emerging conclusion with relevant counterevidence.
6. Verify completion criteria and report or persist a targeted wait.

Persist attempted questions, evidence references, observed failures, and the reason for
changing approach. Suppress equivalent unsuccessful attempts on unchanged inputs; keep
bounded transient retries.

A tool “no finding” does not complete the responsibility. Unchanged holdings or unchanged
source files do not prove an unchanged assessment or that a scheduled review is
unnecessary.

Route a compact projection of current commitments into each decision. Retrieve detailed
history on demand. Old summaries must not override corrected rules. Preserve unknown
coverage/freshness rather than inventing generic domain rules.

Models propose. `src/core/gate.ts`, `src/core/capability-gate.ts`, and
`ResearchResponsibilityService` in `src/core/behavior.ts` commit durable behavior and
terminal truth. Delivery retries use the existing outbox and never repeat analysis.

Reports explain implications and next steps. A valid “no change recommended” names what was
examined, why the previous assessment still holds, limitations, and what would change it.

### 4. Cross-domain acceptance scenarios

Use the same controller for:

1. Portfolio analyst using Rocket (private wallet config; Solana/Ondo and Base/Reserve as
   data-requirement examples; paper options only; no signing/orders/swaps/approvals).
2. Augustine/Shaul research (older correction, missing source, no cross-project leak).
3. Read-only software-maintenance triage (misleading first diagnostic, bounded authorized
   check, verified diagnosis or concrete blocker; no automatic edits or deploy).

Domain changes must be tool/configuration changes, not core branches. Measure steering
turns, recovered evidence, repeated failed attempts, unsupported conclusions, duplicate
work/reports, and budget use. Label scripted providers. Live-model evaluation is a later
milestone.

## Constraints

Reuse the existing scheduler, grants, capability gate, turns, source index, checkpoints,
provider retries, and outbox. Preserve research capability restrictions until a
responsibility explicitly approves additional tools. Review sensitive
`src/state/`, `src/core/gate.ts`, `src/execution/`, `scripts/build.ts`, and `install/`
changes. Keep quoted/retrieved instructions untrusted. No secrets in logs, skills, or
fixtures. Tests use temporary `KELI_STATE_DIR`.

Keep repository content portable: relative links, env/config for external executables and
private state, synthetic or sanitized fixtures only.

## Stop condition

Deliver scoped commits, a documented operating path, scenario evidence, and remaining
blockers. Distinguish implemented, fixture-verified, live-verified, and deferred
capabilities. Do not expand into a benchmark platform, learned memory/RL, another
literature review, in-Keli portfolio engines, or automatic publishing/merging/live
messaging.
