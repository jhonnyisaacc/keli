# Pinned repository contrast

**Historical snapshot.** This contrast is frozen at Keli `40743b53fa884a2eec00bfdf5aebc432f97967fa`
(research date 2026-09-14). Current `feat/v0.1.0` (`e32b2ad`) implements conversation turns,
source collections, watches, and evidence-driven research occurrences. Do not treat the Keli
column as current runtime. Hermes/Nanobot pin behaviors and paper dispositions remain valid
design evidence. Current next work:
[general-purpose autonomy](../../plans/general-purpose-autonomy.md).

Follow-up: [exact-source behavioral probes](hermes-nanobot-reference-findings.md) confirm narrow retrieval/completion gaps and explicitly establish Nanobot's existing sustained goals and continuation. The matrix below remains scoped to whole mechanisms; UNKNOWN must not be reinterpreted as ABSENT. The implementation decision now proceeds with bounded phase/evidence coupling rather than waiting for a large benchmark.

Read committed code, not product claims. Evidence inventory: [recon.json](../evidence/2026-fast-spike/recon.json) and [reference-index.json](../evidence/2026-fast-spike/reference-index.json) (file hashes, exact symbols and lines). All claims below are scoped to these pins. `UNKNOWN` means the inspected runtime path does not establish the mechanism; it is not a claim of absence throughout every plugin. No reference runtime or live user history was loaded.

## Repository reconnaissance

| Project | Absolute path / branch / HEAD | Remote and divergence | Runtime / test commands / documentation |
|---|---|---|---|
| Keli | `$HOME/keli-research-2026-fast-spike`; `research/2026-fast-spike`; `40743b53fa884a2eec00bfdf5aebc432f97967fa` baseline | `https://github.com/jhonnyisaacc/keli.git`; isolated from Cursor's `feat/v0.1.0`; baseline clean | TypeScript/Bun; `bun test`, `bun run check`; `PRD.md`, `docs/BOUNDARY_MATRIX.md`, `docs/evidence/REUSE.md`, `docs/evidence/REPORT.md`. Manifest requires Bun ≥1.4.2, host is 1.4.0: passing tests do not certify the declared runtime. |
| Hermes | `$HOME/.hermes/hermes-agent`; detached HEAD; `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` | `git@github.com:NousResearch/hermes-agent.git`; clean committed local variant. Cached `origin/main...HEAD` has 2532 upstream-only / 5 local-only commits; local delivery/Discord/cron fixes. Queried remote HEAD `a7254e2d4c170725a4136591e96efc5066251d2c`, not this pin. Counts refer to cached origin, not queried remote. | Python ≥3.11,<3.14, MIT; pytest (`uv run pytest`, requires its dev environment); `pyproject.toml`, `README.md`, `agent/`, `tools/`. Tests not run against installed deployment. |
| Nanobot | `$HOME/.nanobot/src/nanobot`; `honcho-2183-clean`; `f49965445152361b779b465e8a5111549ac934c4` | `https://github.com/HKUDS/nanobot.git`; clean, shallow history; one local Honcho commit above cached `c4a25c9a0977f5729ffabde0b10f641dae08774d`; remote HEAD `08b130cdd1e8dc221c1a0651b8d18872af121106`. Not vanilla upstream HEAD. | Python ≥3.11, MIT; `uv run pytest` with dev dependencies; `pyproject.toml`, `README.md`, `nanobot/agent`, `nanobot/session`, tests. Tests not run against installed deployment. |

Discovery also found `$HOME/runtime-lab/hermes/src` at `e9bccc90a5e314ddf6dd4bd3772d50cb40027275`, branch `main`, clean, same HTTPS upstream, and multiple older worktrees/backups. `$HOME/runtime-lab/nanobot` is not itself a Git root. The deployed source checkouts above were selected as concrete local references, not assumed to represent every copy. No checkout, fetch, patch or dependency installation was performed in reference trees. No attempt was made to chase upstream movement.

## Runtime subsystem map

Paths are relative to the pinned roots. Within the Nanobot column, bare `context.py`, `memory.py`, `loop.py`, `hook.py`, and `tools/` mean `nanobot/agent/`; `session/` and `cron/` mean `nanobot/session/` and `nanobot/cron/`. qualified symbols and exact line positions are in the evidence index. An entry identifies observed behavior, not proof that every execution follows it.

| Subsystem | Hermes evidence and behavior | Nanobot evidence and behavior | Keli evidence and behavior |
|---|---|---|---|
| Main loop | `agent/conversation_loop.py::run_conversation`, `run_agent.py::AIAgent`: iterative conversation harness | `nanobot/agent/runner.py::AgentRunner._run_core`, `loop.py::AgentLoop`: tool/model iterations | `src/model/loop.ts::ModelLoop.runTurn/runViaProvider`: correction or single delegated/proposed action, not general long-horizon planner |
| Prompt/context | `agent/prompt_builder.py::build_context_files_prompt/build_skills_system_prompt`; loop `_restore_or_build_system_prompt` | `context.py::ContextBuilder.build_system_prompt/build_messages/build_transcript`: bootstrap, memory, skills, summary | `src/model/provider.ts::FixtureModelProvider.propose`: request and current rule JSON; `loop.ts` routing |
| Sessions | `hermes_state.py::SessionDB`; messages and compression mixins; parent lineage | `session/manager.py::SessionManager.get_or_create/save/read_session_file` | `src/state/migrate.ts::migrate` actions/runs schema; no conversational Session Environment in `ModelLoop` |
| Persistent state | SQLite `SessionDB`, message rows | `SessionManager` files/checkpoints, `MemoryStore` files | SQLite `src/state/db.ts`, `migrate.ts`; scoped `BehaviorService` |
| Memory storage | `agent/memory_manager.py::MemoryManager` provider abstraction, `on_memory_write` | `memory.py::MemoryStore.write_memory/append_history`, Git-backed memory maintenance | `src/memory/notes.ts::addNote`; rules are separate `BehaviorService` state |
| Retrieval | `MemoryManager.prefetch_all/_prefetch_provider` plus session search | `MemoryStore.read_memory`, explicit session tools; optional local Honcho tool | `searchNotes`: scope-constrained FTS5 notes, no automatic recall call from baseline `ModelLoop` |
| History search | `tools/session_search_tool.py::session_search/_discover/_scroll`; `hermes_state_search.py::SessionSearchMixin.search_messages` | `tools/sessions.py::SearchSessionsTool/ReadSessionTool.execute`; `webui/session_access.py::WebuiSessionAccess.search/read` | Notes search is not raw conversation retrieval; baseline loop does not persist raw chat turns |
| Compression | `agent/context_compressor.py::ContextCompressor.compress`; recover compacted rows via `_discover` | `memory.py::Consolidator`, `MemoryArchiver.archive` with raw fallback on failure/overflow | `src/preservation/cursor.ts::advancePreservationCursor/assertNoPreservationGap` journal primitive; not a conversation compactor |
| Planning | `tools/todo_tool.py::TodoStore.write/read/format_for_injection`; structured tasks | `tools/long_task.py` goal tools; `session/goal_state.py` goal state; exact phase planning UNKNOWN | Baseline `ModelLoop` has no explicit phase planner: ABSENT on this path |
| Replanning | Todo updates and `turn_recovery.py::recover_after_classification`; phase-memory coupling UNKNOWN | `AgentRunner._run_core` recovery/continuation and tool error hints; phase-memory coupling UNKNOWN | `DelegateService.execute` fallback; no phase-memory replan |
| Decomposition | `tools/delegate_tool.py::delegate_task/_build_children`, TodoStore parent IDs | `agent/subagent.py::SubagentManager` and long-task tools | `src/adapters/helpers-spawn.ts::helpersSpawn`; bounded child capability dispatch, not autonomous task decomposition |
| Tool execution | Conversation tool dispatch and `tools/approval.py` guards | `tools/execution.py::execute_tool_calls`, `ToolRegistry.prepare_call/execute`, hook callbacks | `src/execution/dispatch.ts::dispatchCapability`, `CapabilityGate.run` |
| Tool results | Conversation loop observations; `turn_recovery.py::validate_response_shape` | `ToolRegistry.execute` preserves typed errors and attaches guidance; runner result observations | `dispatchCapability` typed results/byte budgets; gate candidate validation |
| Completion | Conversation final response and separate `agent/verify/runner.py::VerifyResult.ok`; universal verifier linkage UNKNOWN | `AgentRunResult.stop_reason`, `_run_core` error/empty/max-iteration handling; generic artifact verification UNKNOWN | `GateService.finish` accepts rule-matching candidate as `executed`; J reproduces no artifact/test evidence |
| Verification | `agent/verify/runner.py::run_verify`: command phase exits and readiness | Runner/tool outcome checks; test-grounded universal completion verifier UNKNOWN | Gate validates authorization/shape; `src/model/delegate-service.ts` execution outcomes; does not establish requested behavioral success |
| Error recovery | `turn_recovery.py::route_classified_error/recover_after_classification/compute_error_backoff` | `AgentRunner._request_model/_try_finalize_after_max_iterations`; archiver raw fallback | `DelegateService.execute`; `src/model/normalize.ts::normalizeProviderFailure`; restart recovery in `src/state/db.ts` |
| Skills | `tools/skills_tool.py::skills_list/skill_view`; `skill_manager_tool.py` management | `agent/skills.py::SkillsLoader.load_skill/load_skills_for_context` | `src/skills/store.ts::pinSkillVersion/activateSkill/rollbackSkill/recordComparableUse` |
| Skill selection | `build_skills_system_prompt`, `skills_list`, `skill_view`: discover then load | `get_always_skills/build_skills_summary/build_explicit_skill_runtime_context` | `listSkillIndex`, `CapabilityRegistry.discover/schemaFor`; no learned joint composition in loop |
| Subagents | `delegate_task` / child modules | `SubagentManager`, `_SubagentHook` | `helpersSpawn`, child run state and fan-out checks |
| Background | `cron/scheduler.py` fire ownership/run/delivery machinery | `cron/service.py::CronService`; dream methods in `MemoryStore` | `src/jobs/scheduler.ts::tickScheduler/reconcileJobs`; grants and occurrences |
| Reflection/learning | `MemoryManager.on_session_end/on_delegation`, skill manager; learned policy optimization UNKNOWN | `MemoryStore.build_dream_prompt/build_dream_tools/dream_run_completed`; offline processing, not proof of trained memory policy | Comparable-use counter and skill version management; no learned strategy optimizer |
| Permissions | `tools/approval.py::check_all_command_guards/request_tool_approval`; command guards, not Keli canonical authority model | `security/workspace_policy.py::resolve_path/is_path_within`, tool guards; module explicitly distinguishes application checks from OS sandbox | `BehaviorService` + `GateService`; `CapabilityGate` is another existing terminal writer, a baseline boundary/documentation discrepancy; no research adapter may gain authority |
| Telemetry | `agent/trace_upload.py::build_trace_jsonl`, SessionDB usage | `AgentRunner._record_request_usage`, `hook.py::SDKCaptureHook`, `AgentProgressHook` | `src/core/budgets.ts` counters, actions/effects/journal, run records; no complete chat trajectory in baseline loop |

## Mechanism gap matrix

M IDs refer to the [research matrix](2026-agent-architecture-matrix.md). FULL requires the whole stated primitive; FUNCTIONALLY_EQUIVALENT only denotes an explicitly narrowed behavior. Naming overlap alone never qualifies. Taxonomies/benchmarks have no direct runtime implementation to classify.

| Mechanism | Hermes | Nanobot | Keli | Evidence / meaningful difference / candidate |
|---|---|---|---|---|
| M01 lossless programmatic session environment | PARTIAL | PARTIAL | PARTIAL | Hermes raw recovery; Nanobot archive/fallback; Keli journals and typed rules. None of inspected loops establishes persistent executable namespace + print projections + landmarks. Candidate A only; kernel DEFER. |
| M02 complete ReFind loop | PARTIAL | PARTIAL | PARTIAL | Hermes FTS/scroll/grouping; Nanobot substring title/history search; Keli note FTS only. Candidate B controls, not new semantic memory stack. |
| M03 bidirectional phase-memory coupling | UNKNOWN | UNKNOWN | ABSENT | Todo/goal/retry infrastructure is not proof of phase-conditioned recall and memory-driven planner transitions. Follow-up decision: ADAPT a bounded phase/evidence controller as an implementation experiment; whole-system equivalence remains UNKNOWN. |
| M04 taxonomy | UNKNOWN | UNKNOWN | UNKNOWN | Evaluation guide, not software component. Adopt coverage dimensions only. |
| M05 critical-state routing diagnostic | PARTIAL | PARTIAL | FUNCTIONALLY_EQUIVALENT (scoped delegate rule only) | Hermes memory provider prompt, Nanobot MEMORY.md/always skills, Keli rule passed every action. Narrow authoritative state already routed; general implicit relevance unsolved. |
| M06 self-optimizing memory strategy | UNKNOWN | PARTIAL | ABSENT | Nanobot dream revises memory, not validated search over memory strategies; Hermes hooks do not prove policy optimization. DEFER. |
| M07 unified learned STM/LTM policy | UNKNOWN | PARTIAL | ABSENT | Nanobot consolidation/dream tools are heuristic surfaces, not step-wise GRPO. No trained-policy claim for Hermes plugins. DEFER. |
| M08 learned manager and answer policy | UNKNOWN | PARTIAL | ABSENT | Memory edits/reads do not establish PPO/GRPO managers. DEFER RL; reject deletion of source truth by memory policy. |
| M09 heterogeneous trajectory uncertainty | PARTIAL | PARTIAL | PARTIAL | Typed errors/budgets/outcomes in all; no calibrated entity-specific uncertainty dynamics demonstrated. Simple known/unknown conditions suffice for current fixtures. |
| M10 three-tier SLM memory | PARTIAL | PARTIAL | PARTIAL | Providers or offline dream/consolidation overlap; local FTS/optional Honcho in Keli does not implement STM/MTM/LTM reranking. DEFER extra stores. |
| M11 reliability benchmark | UNKNOWN | UNKNOWN | PARTIAL | Keli invariant tests cover ambiguity/spoof/failure, not CAR-bench itself. Adapt adversarial completion/ambiguity test methodology. |
| M12 prediction-error semantic world model | UNKNOWN | UNKNOWN | ABSENT | Retry/outcome logs do not establish semantic mismatch learning. E fixed cache does not justify world model. |
| M13 joint learned composition | UNKNOWN | PARTIAL | ABSENT | Nanobot explicit invocation plus always skills; Keli pins/index. H dependency closure helps structural validity, not learned selection. |
| M14 adaptive selection + set-aware rendering | PARTIAL | PARTIAL | PARTIAL | Skill summaries/indexes and bounded tool discovery overlap; jointly learned rendering not established. Keep budget discipline, DEFER learned planner. |
| M15 executable evolving skill programs | PARTIAL | PARTIAL | CONFLICTING_DESIGN (direct action intervention); PARTIAL (fixed guards) | Hooks/guards in references, ordinary gates in Keli. A skill that changes canonical action truth conflicts with ownership; proposal-only predicates are possible. G found no advantage over simple checks. |
| M16 map before action | UNKNOWN | UNKNOWN | ABSENT (automatic mapping) | Inspection tools can construct maps manually; automatic bounded mapping not established. F supports optional inspection only. |
| M17 verifier-grounded process reward | PARTIAL | PARTIAL | PARTIAL | Hermes executable verifier; typed outcomes elsewhere. No local RL reproduction. J supports distinct execution/verification receipts. |

## Hermes/ReFind detail

At `93e2525`, `_discover` calls `search_messages` (FTS5/BM25), demotes cron noise, deduplicates by lineage and hydrates actual stored messages. `_scroll` reads a bounded anchor window; compacted evidence may remain visible even within current lineage. This is substantial behavioral overlap, not ABSENT. Defaults search user/assistant rows; tool rows require explicit role selection.

Its signature has query, role_filter, limit, current_session_id, session_id, around_message_id, window, sort, profile and detail. There is no after/before interval or arbitrary exclude_session_ids. Sorting oldest/newest is not filtering a requested interval; per-response lineage dedup is not cross-round seen-session exclusion. `_discover` also does not perform ReFind's turn/session-sum RRF or enforce a separate evidence-only answer phase. These differences matter for time-specific recall and repetitive search; they do not mean RRF or a separate model call would help Keli.

Nanobot `WebuiSessionAccess.search` ranks literal case-folded title matches first, then visible message substring matches, taking the last two matching messages; `read` returns the last limited visible messages, optionally substring filtered. It is neither BM25 nor ±N anchored expansion. Title saturation and hidden/tool-message visibility can affect recall. No performance ranking against Hermes is established without running both on a shared corpus.

## Interpretation and reuse

Probable design reasons (inferences): Hermes favors recoverable chat navigation and bounded result hydration; Nanobot reuses its existing session/UI access layer; Keli emphasizes authoritative typed rules and bounded capability dispatch. These explain local simplicity choices but are not maintainer testimony. Shared behavior demonstrates convergence, not historically independent invention.

ADOPT → ADAPT → BUILD: first reuse Keli's rule source, note FTS and gate interfaces; adapt source-addressed retrieval/visibility ideas from Hermes, archival failure handling and compact skill indexes from Nanobot; build only isolated comparison adapters. Hermes pin above: MIT. Nanobot pin above: MIT. No upstream code copied; paper versions are pinned in the matrix, and paper method inspiration grants no runtime authority. PRD traces: A→I1/I6/I7,A30/A40/A45/A46; B→I1/I6/I7,A29/A30/A43; C→I3/I5,A22/A23/A39; D→I1/I2,A01–A11/A30; E/F→I5/I9,A24; G/H→I2/I8,A08/A26–A28/A41; I/J→I9,A07/A19/A20/A22/A24. These are design trace links, not claims that this spike satisfies release gates.
