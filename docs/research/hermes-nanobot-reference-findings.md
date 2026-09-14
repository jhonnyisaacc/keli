# Reference findings → implementation decision

Follow-up to the fast spike, 2026-09-14. The user's decision criterion is now explicit: establish useful reference gaps, then build a bounded innovative Keli implementation. A large model benchmark is not a prerequisite to starting that implementation. A demonstrated reference limitation is sufficient motivation, but is not evidence that the proposed Keli implementation already improves model performance.

## What was actually executed

**21 exact-source unit/API probes, all matching their recorded expectations.** These are neither 21 failed agent tasks nor end-to-end runtime evaluations. [Machine summary and source hashes](../evidence/2026-fast-spike/reference-probes/summary.json), [complete inputs/outputs](../evidence/2026-fast-spike/reference-probes/trace.jsonl), [runner](../../experiments/2026-fast-spike/reference-probes/run.py).

The runner obtains source with `git show` at immutable pins, selects original Python definitions via AST, and executes their unchanged bodies. It omits imports/tool registration that would initialize installed agent runtimes. Storage, listings, session save and notification boundaries are explicit synthetic fixtures. It does not reimplement the search loop, task store, goal-update decision or continuation predicate being tested. No deployment, personal archive, network service, or reference working-tree file was modified. Hermes: `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544`, MIT; Nanobot: `f49965445152361b779b465e8a5111549ac934c4`, MIT. These remain the earlier local variants, not latest upstream.

Reproduce without overwriting evidence:

```sh
python3 experiments/2026-fast-spike/reference-probes/run.py --check
```

## Findings and limits

| Probe | Confirmed behavior at pinned source | Keli implication |
|---|---|---|
| R1 Hermes `tools/session_search_tool.py::session_search` | Calling after, before or exclude_session_ids raises unexpected-keyword TypeError. Existing query/sort/anchor/window parameters are present. | Add explicit temporal/scope/range controls where Keli lacks them. This does not imply Hermes cannot navigate/filter results through several calls or other tools. |
| R2 Nanobot `nanobot/webui/session_access.py::WebuiSessionAccess.search` | Five exact title matches fill a five-result budget; relevant body-only match is not searched into the result set. With six slots, that body evidence appears. Direct read also recovers it. | Reserve evidence-bearing results or expose cursor/reformulation controls. This is a reproducible budget/ranking limitation, not permanent irretrievability. |
| R2 Nanobot `_visible_messages` and `WebuiSessionAccess.read` | The tool-role receipt disappears from visible-history projection. Twelve matching messages with limit eight return indices 4–11; this method exposes no earlier-page cursor. | Preserve/search original tool observations separately from a user-facing chat view. The receipt may remain stored or accessible through another channel. |
| R3 Hermes `tools/todo_tool.py::TodoStore` | Active task is projected after compression. A merged completed status is accepted without a receipt, and a completed-only list no longer projects into active context. | Do not use a model-edited checklist as Keli's completion authority. This is an advisory task store, not proof of false terminal outcomes throughout Hermes. |
| R4 Nanobot `nanobot/session/goal_state.py`, `turn_continuation.py` | An active objective is projected and continued at max-iteration boundaries; the 12-round cap stops continuation. Changing extra trajectory evidence from progress to repeated failure does not alter this predicate. | Durable goals and automatic continuation already exist. The tested predicate is budget/status-driven, not a phase-memory progress detector; other progress paths remain unassessed. |
| R4 Nanobot `nanobot/agent/tools/long_task.py::UpdateGoalTool.execute` | `complete` with recap and no receipt calls the save boundary with completed status. Applied to fixture state, this stops goal continuation eligibility. | Couple terminal goal state to independent evidence. We exercised the original method but mocked actual persistence and delivery; no deployment failure was induced. |
| R5 Hermes `agent/verify/runner.py::PhaseResult/VerifyResult` | Successful phase result is accepted, failed phase result rejected. | Verification already exists; the opportunity is mandatory linkage between goal completion and relevant verification evidence, not inventing verification. Automatic linkage across Hermes paths is still UNKNOWN. |

These probes do **not** prove that either entire agent fails to implement all of PMCoder, Scroll or InMind, and do not establish historical novelty. They establish concrete behavior at named seams and invalidate an overbroad “they have no goals/continuation/verification” story.

## Decision: proceed with one implementation

Build **evidence-driven responsibility execution** in Keli: a user-approved continuing responsibility contains a scoped objective, wake condition, action envelope, budget and completion criteria. A relevant event wakes it; current commitments and phase-relevant evidence guide an authorized action; observations update progress; repeated deterministic failure changes the next step; independent verification closes the occurrence. The responsibility can remain enabled for future occurrences without replaying a completed effect.

This is our engineering synthesis of PMCoder-style plan/memory coupling, Scroll-style addressed evidence, InMind-motivated routed critical state, and verifier-grounded completion. It is a plausible Keli differentiator relative to the tested seams, not a claim that no other system has ever combined these ideas. Existing Keli grants/jobs/runs/outbox and reference-agent strengths should be reused.

Implement the smallest version now. A few acceptance cases must show the integrated behavior works; stop expanding research unless an implementation uncertainty requires a specific experiment. Keep learned memory policies, semantic world models, arbitrary executable skill programs and a persistent Python kernel out of this increment.

The research-watch slice described here is implemented at `e32b2ad`. The current deliverable
is [general-purpose autonomy](../../plans/general-purpose-autonomy.md), using the
[updated implementation prompt](../architecture/keli-autonomy-implementation-prompt.md).
This finding supersedes the earlier proposal's requirement to complete a broad held-out
model gate before starting implementation. Such evaluations remain appropriate before
claiming broad performance superiority.

## Integrated implementation hypothesis H11

**Hypothesis:** tying a continuing responsibility to phase-relevant raw observations and current-revision completion criteria lets Keli progress through a recoverable failure without a new user prompt, while remaining quiet on unchanged signals.

Baseline: the implementation agent's current Keli jobs/run/model path, inspected before edits. Intervention: the integrated responsibility/occurrence/context/evidence controller in the prompt. Measure within the demonstration: user steering turns after initial authorization, unchanged-signal model calls, duplicate occurrences/effects/reports, repeated equivalent failures, recovery outcome and verified completion. Acceptance: the demonstration recovers without additional steering, unchanged signals/waiting spend zero model calls, duplicates produce no repeated effect, and unsupported or stale completion evidence cannot close an occurrence. These are behavioral acceptance checks, not a statistically established comparative gain. Rollback: disable/pause the new responsibility mode while preserving all recorded evidence and existing grants, runs and receipts; never replay effects during rollback.
