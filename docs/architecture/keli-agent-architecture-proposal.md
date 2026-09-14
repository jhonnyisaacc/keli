# Keli architecture proposal after the 2026 fast spike

**Historical decision record.** The evidence-driven research-watch slice described here is
implemented on `feat/v0.1.0` (`f8eafd7` / `e32b2ad`). Current next work is
[general-purpose autonomy](../../plans/general-purpose-autonomy.md). Use the
[current implementation prompt](keli-autonomy-implementation-prompt.md).

**Implement one evidence-driven autonomy slice: a continuing responsibility wakes on relevant changes, uses phase-relevant execution evidence to recover, and closes each occurrence only when its completion criteria are verified. Keep the authoritative gate; do not adopt the full planner–memory–world-model pipeline.**

Baseline `40743b53fa884a2eec00bfdf5aebc432f97967fa`. This is a research recommendation, not a runtime change or a release certification. [Experiment plan](../research/keli-experiment-plan.md), [results](../research/keli-experiment-results.md), [pinned reference contrast](../research/hermes-nanobot-keli-gap-analysis.md), and [machine evidence](../evidence/2026-fast-spike/run-final/summary.json) delimit the conclusions. ADAPT means a narrow design direction for a reviewed follow-up, not acceptance of a paper's entire system. Updated after the user clarified the implementation decision threshold: the [exact-source reference probes](../research/hermes-nanobot-reference-findings.md) justify starting a bounded implementation. Large held-out model evaluation is optional follow-up for performance claims, not a prerequisite.

> Implementation update: Fable's integration-readiness work landed at `4bd3b9e`. The
> research-watch plan at [plans/evidence-driven-autonomy.md](../../plans/evidence-driven-autonomy.md)
> was then implemented. Baseline observations below remain historical spike findings at
> `40743b5`. Do not treat the Keli column in the gap analysis as current runtime.

## Smallest coherent design supported by the local evidence

1. Continue obtaining owner/type/scope/revision from canonical state. A model, retrieval result, summary, skill or world heuristic cannot grant authority. Current authoritative constraints must be fetched at use time rather than copied from an old prompt snapshot (D).
2. Preserve raw observations with stable addresses and provenance. Derive small bounded context projections, with explicit access back to source evidence (A). Keli's existing journal is not a complete raw conversation log. Before adding a store, identify missing capture points and extend the existing ownership model; avoid two competing sources of truth.
3. Expose bounded scoped lexical retrieval with exact expansion and optional time bounds (B). Keep summaries disposable. Seen-session exclusion must be reversible or use inspected ranges: the negative fixture demonstrates that a partially read session may contain additional required evidence. Do not enable RRF merely because ReFind uses it; no RRF quality advantage was measured here.
4. Keep action selection, authorization, dispatch, execution, verification and presentation separate. Require evidence tied to the current artifact revision and intended behavior before verified completion (J). Preserve unknown outcomes. A passing focused test alone is insufficient. This has priority over new memory/planning complexity.
5. Use existing budgets and a small amount of typed progress/evidence state. Bound eligible retries; inspect a manifest when environment knowledge is missing; load skills by explicit need with dependency and budget validation (C/F/H/I). All such decisions remain proposals subject to the gate. A heavyweight hierarchical planner or semantic environment learner is not yet justified; a small phase/evidence controller is the next implementation experiment.

Conceptually: **canonical rules + addressed observations → bounded context and selective retrieval → proposal → authoritative gate → execution receipt → independent verification → observed progress**. The gate remains in the action path, even if memory/context/planning grows later. The user-supplied large architecture diagram omits this explicit authority step; treating all its arrows as writable state would conflict with Keli's ownership requirements.

## Disposition matrix

| Mechanism | Decision | Evidence and scope | Hypothesis / next gate |
|---|---|---|---|
| M01 Scroll | ADAPT | A recovered exact bytes after reopen with an 80-byte typed projection versus 114,749-byte transcript; ordinary full transcript also recovered them. Persistent Python kernel, arbitrary program execution and general landmark policy remain DEFER. | H1; capture completeness/crash tests, real long-run retrieval and same-budget raw-index baseline |
| M02 ReFind | ADAPT | B target recall improved 0→1 in one deliberately constructed case by time/neighbor controls. Hermes already supplies much of the raw-search interface. Preserve both observed retrieval failures. | H2; broader held-out corpus, time/expansion/RRF/exclusion ablations and scaling costs |
| M03 PMCoder | ADAPT (bounded implementation experiment) | C is scripted evidence only. Follow-up R4 confirms Nanobot already continues goals, but the tested continuation predicate uses status/rounds rather than supplied progress evidence. Implement inspect/act/verify phases with episode references and evidence-driven recovery; do not claim entire-agent absence or proven gains. | H3; one integrated recovery demonstration, then inspect observed value before extending the planner |
| M04 Horizon Gap | ADOPT | Use evaluation coverage dimensions, not a runtime module. | Evaluation methodology only |
| M05 InMind | ADOPT (existing narrow rule routing) | D demonstrates current canonical rule retrieval despite lexical mismatch and a revision change. It does not solve implicit world-knowledge routing. | H4; paired storage/knowledge/routing controls before broader persistent context |
| M06 SelfMem | DEFER | No held-out policy optimization or total cost measurement. | Separate policy-training/evaluation budget and frozen held-out tasks required |
| M07 AgeMem | DEFER | Tool availability does not reproduce learned unified memory control. | Trained-policy value must beat existing simple interfaces |
| M08 Memory-R1 | DEFER | No PPO/GRPO reproduction; destructive memory control cannot own raw truth. | Outcome gains plus immutable provenance required |
| M09 Agent UQ | ADAPT | I routes supplied missing/conflicting evidence labels. Ordinary typed checks explain the result; no generic confidence score or calibrated estimator justified. | H9; measure label accuracy and unnecessary intervention before richer dynamics |
| M10 LightMem | DEFER | No local latency/quality evidence for three memory tiers or semantic reranking. Existing FTS/offline seams are simpler. | Total online + consolidation cost on actual traffic |
| M11 CAR-bench | ADAPT | Preserve ambiguity, false-completion and missing-evidence fixture families. Do not call them a CAR-bench reproduction. | H10 and repeated consistency trials |
| M12 WorldEvolver | DEFER | E scopes repeated transitions and rejects transient/conflicting samples; no semantic model, prediction accuracy or task gain measured. | H5; cross-repo negative transfer and transient poisoning tests with real predictions |
| M13 SkillComposer | ADAPT (structural validation only) | H orders prerequisites and rejects cycles/outdated/overbudget inputs. Skill choice was supplied, not learned. Trained decoder remains DEFER. | H8; downstream success against explicit minimal skill loading |
| M14 SkillsInjector | ADAPT (budget discipline only) | H demonstrates 280-byte dependency closure versus a 400-byte distracting top-k set. This is byte accounting, not proof that rewritten skill context improves a model. | H8; required-skill recall and task-success comparison; learned rendering DEFER |
| M15 HASP | REJECT (general privileged/evolving runtime for now) | G's fixed hook equals ordinary gate predicates. General executable intervention adds a new authority/loop surface without measured extra benefit. | H7; reconsider only proposal-only validated hooks with demonstrated gain over predicates |
| M16 MAP | ADAPT (optional bounded inspection) | F executes a wrong/right test-command pair. Call-accounting favors reuse on repeated unfamiliar tasks but penalizes already-known easy tasks. Reject unconditional global exploration. | H6; real repeated task cost and map invalidation |
| M17 VPR | ADAPT (verification principle only) | J independently rejects five invalid completion claims and accepts one complete fixture; baseline GateService still says executed for proposal-only input. No RL/process-reward benefit inferred. | H10; receipts tied to actual requested behavior, revision, complete outputs and integration scope |

## What should not be adopted

Do not turn raw evidence into a deletable learned memory bank. Do not permanently inject arbitrary memories or every skill. Do not let an executable skill, retrieved instruction or inferred environment rule modify canonical state or certify completion. Do not train a controller before a frozen evaluation set exists. Do not add episodic, semantic, short-, mid- and long-term stores simply to resemble the literature. Do not report an authorized candidate as completed work. Do not treat a microbenchmark contract pass rate as agent task success.

## Integration priorities and review boundary

Implement the integrated responsibility slice described in the linked prompt. Within that slice, investigate the baseline `GateService.finish` executed/verified distinction against the current implementation, trace it through presentation and delegate paths, and reuse or add a minimal receipt contract. `src/core/gate.ts` is sensitive and requires extra review under AGENTS.md; this spike makes no change there. `CapabilityGate.finish` is also an existing terminal-state writer despite AGENTS.md's narrow wording. Reconcile that authority documentation before expanding any write surface.

As part of that same slice, extend raw evidence access only where existing storage cannot recover exact originals, and connect current responsibility state to bounded phase-relevant retrieval. Enable only explicitly configured responsibilities after their focused integration checks pass; broad performance superiority remains unproven. Reverting an experiment removes only the adapter or context policy, never the historical evidence or existing gate. Candidate ideas must keep the H1–H10 baseline/intervention/metric/threshold/rollback records in the experiment plan.

Reuse order: Keli's canonical rule and scoped FTS primitives first; Hermes' addressed chat-search semantics and Nanobot's archival failure lessons second; new infrastructure last. Pins, MIT licenses and PRD trace IDs are in the gap analysis. No reference code was copied and no production architecture was changed.
