# Plan: evidence-driven research autonomy

Status: **implemented** on `feat/v0.1.0` at `f8eafd7` / `e32b2ad`. **Superseded as next
work** by [general-purpose-autonomy.md](general-purpose-autonomy.md). Keep this file as the
historical implementation sequence and measured research-watch contract.

The following preamble is the original plan text. Its “ready for implementation” status and
`4bd3b9e` starting pin are historical. The current runtime already contains the watch
occurrence slice; do not re-implement it.

Implementation baseline: `4bd3b9e28f9c64ff3166003bbae9f0bfc4d87d10` on `feat/v0.1.0`, committed after Fable completed integration readiness. Validation at that commit: `bun run check` passed; `bun test` reported 182 pass, 1 platform skip, 0 fail, using temporary `KELI_STATE_DIR`. These checks do not certify live providers or transports.

This plan lives on `research/2026-fast-spike`. That branch retains the older experimental baseline; it has not been merged or rebased onto the implementation. Implement from the pinned implementation commit or its reviewed successor, not from the research branch's runtime files.

## Decision and user-visible result

Build one continuing research responsibility on top of approved watches and the research conversation loop. Keli should notice a relevant change, investigate within existing authority, remember unresolved evidence, resume when that evidence becomes available, and report a supported change or an actionable blocker.

Example: “Keep following the Cava thesis in this collection. Tell me when new evidence changes the thesis or its invalidation conditions. If evidence is missing, recover what you can from the approved sources and remember what remains unresolved.”

This increment uses the existing Cava and Augustine/Shaul scenarios. Repository repair, additional transports, learned memory policies and general autonomous coding are later scope. This replaces the repository-repair demonstration in the previous implementation prompt: Fable's research path now gives us a smaller, relevant integration target.

The proposed differentiator is the connection between **ongoing commitments, recoverable evidence, adaptive continuation, and evidence-bound completion**. Goals, heartbeat scheduling, tool loops and verification individually already exist in Keli or the reference agents. We have enough evidence to implement this connection; another literature survey or broad benchmark is not a prerequisite.

## What is already present, and what needs connecting

The observations below come from source inspection at the pinned commit, not newly reproduced runtime failures.

| Existing implementation | Remaining work |
|---|---|
| `src/watches/heartbeat.ts` fingerprints sources before invoking the model; approved versioned records live in `src/watches/store.ts`. | The replay key contains watch ID and source hash, but not watch version or dependency revisions. An edited question or newly available supporting collection must not replay an old answer. |
| `ConversationLoop` persists tool turns, retries insufficient evidence, and replays stored outcomes by `sourceRef`. | `missing_evidence` and `clarify` end runs as completed; heartbeat also records their fingerprints as successfully observed. Distinguish a finished invocation from a fulfilled responsibility occurrence, and persist a resumable dependency. |
| Checkpoints, journals, source documents and conversation turns already exist. | Checkpoints are best-effort and scope-based. Persist the active occurrence's phase, evidence addresses and next eligible transition as required recovery state. Do not create a competing transcript store. |
| `src/core/evidence.ts` rejects unknown citations and missing required collections. | Search hits can qualify as known sources; checks do not establish passage support, source revision, or prose claim coverage. Empty citation/attribution arrays can pass with no required collections. Make the research completion contract explicit. |
| Watches declare request/token/tool/money budgets. | Heartbeat does not forward those limits to the research turn. Enforce cumulative occurrence budgets across retries and restarts, including fingerprint fetch work where applicable. |
| Heartbeat records success before invoking notification delivery. | A delivery failure can leave the fingerprint observed and the next tick quiet. Persist notification intent and retry delivery independently of research. Reuse the existing outbox. |
| `material-change` is a notification policy. | Its current answer path sends on any new fingerprint. Compare supported thesis changes, not just changed bytes. Apply consecutive-failure policy consistently across fingerprint and research failures. |

Keep existing source indexing, Discord thread binding, approval flow, capability restrictions, provider retry handling, compaction and update machinery. The work is an extension of those paths.

## Implementation sequence

### 1. Persist resumable occurrences and enforce budgets

Extend the existing jobs/occurrence machinery where compatible, connecting watches to it; if its contract cannot represent research waits, document that mismatch before adding the smallest watch-specific state. Never maintain two authoritative occurrence ledgers.

A responsibility is the approved watch. An occurrence is a bounded attempt to answer its question for a particular relevant change. Persist watch version, owner/scope, trigger identity, policy revision, completion criteria, phase, dependency conditions, evidence references, remaining budget and delivery reference. Keep ongoing watch status separate from occurrence status.

Use explicit occurrence states such as `active`, `waiting_for_evidence`, `waiting_for_user`, `verified`, `failed` and `cancelled`. Existing run `completed` may continue to mean “this invocation ended”; it must not imply the occurrence was verified. A missing source is an unmet dependency, not success. Exhausted budget ends or blocks work truthfully; resuming must not refill the budget silently.

Atomically claim occurrences and fence stale workers using existing ownership primitives. Duplicate ticks or restart must not create another active occurrence for the same event. A dependency arrival resumes the same waiting occurrence; a new approved watch version creates a new contract and supersedes incompatible old work. Define those identities explicitly instead of stuffing every revision into one opaque dedupe key.

Check cheap eligibility before model calls: unchanged inputs with no resolved dependency, paused watches, cancellation and waiting-for-user all stay quiet. Indexing an eligible missing source or receiving the owner's answer supplies a persisted wake signal. New watch proposals remain inactive until approval.

Acceptance: one occurrence across concurrent ticks/restart; a waiting occurrence wakes once on its matching dependency; unrelated changes do not wake it; all usage remains charged to its original budget.

### 2. Connect phase-relevant evidence to recovery

Use a small `inspect → retrieve → verify` controller around the existing research loop. Persist the current hypothesis/question, attempted action signature, observed result, failure category, next discriminating step and exact supporting evidence IDs. Required continuation state must be committed before it is advertised as recoverable.

Reuse stored turns and indexed source records for addresses containing scope, occurrence/run, source identity, content revision/hash and locator. Preserve full evidence in the existing recoverable storage; send bounded passages and references to the model. Search results are discovery evidence; they are support evidence only when they contain a retained, addressable passage sufficient for the stated criterion. Expanding the source is the normal next step when they do not.

Before each consequential dispatch, resolve current canonical rules and grants and check the remaining budget. A recalled rule or model-authored trust flag cannot authorize a tool. Keep the research capability allowlist intact.

For equivalent deterministic failures on unchanged inputs, require a discriminating inspection, different query or revised hypothesis before retrying. Include relevant input revisions in the attempt signature so new evidence can justify reconsideration. Reuse existing bounded transient provider retries; do not introduce another retry engine.

Acceptance: a deliberately misleading first retrieval leads to a different useful retrieval without another user prompt; exact evidence remains accessible after context reduction/restart; a corrected rule governs the next action.

### 3. Make research completion evidence-bound

Extend the current evidence checker with a task-specific contract: required subjects/collections, claims requiring support, passage references and source revisions, explicit unresolved conflicts, and requested assumptions/invalidation conditions. Derive required coverage from the approved question and policy; do not let the model omit the attribution list to bypass an obligation.

Deterministic checks can establish reference existence, scope, revision, passage availability, exact-quote matching and declared coverage. They cannot prove arbitrary semantic entailment or truth. A model may propose a claim-to-passage mapping and relevance assessment, but its “supported” label is not a verification receipt. Report `verified` as “the declared evidence contract passed,” never as absolute factual certainty. Unsupported interpretation remains explicitly unresolved; a bounded cited partial answer is allowed without falsely fulfilling the full occurrence.

Only the established authoritative core service may commit terminal truth. Reconcile the existing `CapabilityGate` terminal-writer responsibility with AGENTS.md before extending it. Verifiers and adapters return verdict proposals and evidence; they do not independently close occurrences. Policy/source revisions used for verification must match the occurrence being closed.

Acceptance: search-only IDs without a sufficient retained passage, absent required coverage and stale source evidence cannot close the occurrence. Current required evidence can close it, with persisted criteria and evidence references explaining why.

### 4. Deliver meaningful changes and integrate the existing interfaces

For changed source bytes, compare the new supported findings with the last verified thesis: changed claim, support, contradiction, uncertainty or invalidation condition. Keep this assessment bounded and evidence-linked. A model's significance assessment is a proposal; require referenced differences before delivering it as a material change. The first verified answer can establish and report the baseline.

Unchanged fingerprints cause zero model calls. New but irrelevant content may require a bounded research call, but should produce no material-change notification. Distinguish those two promises in docs and counters. Preserve explicit `always` and `silent` preferences.

Persist one notification intent per occurrence/outcome transition through the existing outbox, with the approved destination and thread. Delivery failures remain pending/failed independently of research success; retries must not rerun research. Do not promise exactly-once external delivery where a transport cannot reconcile an ambiguous acknowledgement: retain `unknown` and use existing reconciliation behavior.

Wire owner replies through the existing Discord inbox and correction path, and expose occurrence status, unmet dependency and pause/resume through the existing watches CLI. Apply one consistent bounded research-failure policy; notification failures must not masquerade as research failures. Ensure active occurrences participate in update idle checks so an automatic update cannot interrupt or resurrect work.

Acceptance: supported material change creates one outbox intent; delivery retry makes no model call; one blocker notification is emitted per relevant state transition; cancellation and watch-version changes prevent stale dispatch.

## Three demonstrations, then stop

Use temporary state and fixture sources through the real conversation loop, capability gate and heartbeat entry points. Extend existing integration tests rather than build a benchmark platform. Scripted providers are appropriate for controlled failure cases and must be labelled. Use actual indexed passages and persisted receipts, not a fake controller that simply returns the expected state.

| Scenario | Required observation |
|---|---|
| Augustine/Shaul recovery | Initial retrieval is insufficient. Keli changes retrieval strategy within budget. If a required document is genuinely absent, it persists a wait and stays quiet. Indexing that document resumes the same occurrence without a new “continue” prompt; current citations fulfill the criteria. A scoped owner correction affects the next step and does not leak to `finanzas`. |
| Cava continuing thesis | Initial supported thesis establishes the baseline. Identical fingerprints use zero model calls. Irrelevant new content gives no material-change alert. New contradictory evidence updates the relevant claim/invalidation condition with supporting passages and one outbox intent. Restart and notification failure do not repeat research. |
| False completion and recovery boundary | A model claims completion with missing/stale evidence; the occurrence stays unverified. Interrupt after a persisted observation, then resume under the same cumulative budget. Concurrent ticks cannot duplicate work; cancellation or revised authority blocks a stale worker. |

Record a compact baseline/intervention table against `4bd3b9e`: steering turns after authorization, model/tool requests, repeated deterministic failures, duplicate occurrences/outbox intents, recovered evidence IDs and completion verdict. Run the same bounded inputs against both paths; mark unsupported baseline behavior honestly. A scripted-provider comparison demonstrates control flow, not live model quality or broad superiority.

Run `bun run check`, the focused integration scenarios and the existing suite using temporary `KELI_STATE_DIR`. Review changed state, authority and execution paths separately, including crash boundaries and migration/update compatibility. One bounded live run is useful when credentials, network hosts and destination are already authorized; it is a distinct milestone and must not be implied by fixture results.

Stop when these scenarios and required checks pass. Deliver working code, one documented CLI flow, a short evidence transcript and scoped commits. Do not require a 30-task study, more paper reproductions or new transport support. Pause/disable the new mode for rollback while retaining evidence, occurrence history, grants and outbox truth; do not rewind state and replay effects.

## Reuse and research trace

| Capability | Decision | Source / trace |
|---|---|---|
| Approved watch, scoped dispatch, budget, occurrence ownership, outbox | ADOPT existing Keli; adapt missing connections | Implementation pin above; I1–I5, I9–I10; A11–A16, A19–A22, A32, A39 |
| Addressed evidence and current canonical context | ADAPT the narrow Scroll/InMind directions using existing Keli stores | [Decision matrix](../docs/architecture/keli-agent-architecture-proposal.md), M01/M05; I1, I6–I7; A30, A40, A43, A45 |
| Phase/evidence-guided continuation | BUILD the small connection after reuse; adapt PMCoder direction | Matrix M03; [reference findings](../docs/research/hermes-nanobot-reference-findings.md), R4/H11; I3, I5; A21–A22, A39 |
| Evidence-bound terminal status | ADAPT verification principle, extend existing checker/core | Matrix M17; reference R3–R5; I9; A24 as the analogous false-completion contract, not proof of the full delegate release gate |

Reference pins: Hermes `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` and Nanobot `f49965445152361b779b465e8a5111549ac934c4`, both MIT. No upstream code copying is required. Record exact file/license attribution if implementation does copy code. Paper/source links and the full 17-mechanism disposition remain in the [research matrix](../docs/research/2026-agent-architecture-matrix.md) and architecture proposal; this plan changes implementation order, not the measured evidence.

The reference probes exercised pinned original methods with synthetic storage boundaries. They establish specific limitations, not that Hermes or Nanobot globally lack autonomy, evidence or verification. The plan tests the integrated Keli hypothesis H11; it does not claim historical novelty, paper reproduction, semantic truth guarantees or satisfaction of every PRD release gate.
