# 2026 fast spike results

Follow-up: [21 exact-source reference probes and revised implementation decision](hermes-nanobot-reference-findings.md). The original A–J results below remain unchanged. The follow-up executes reference definitions with fixture boundaries; it is not a full agent deployment test.

**The local evidence supports narrow evidence/retrieval/verification improvements, not the full proposed architecture.** All ten experiments completed with 63/63 contract checks. This is not a 100% agent task-success result. No live-model episode, RL training, official paper benchmark, or end-to-end Hermes/Nanobot comparison was run.

Frozen Keli baseline: `40743b53fa884a2eec00bfdf5aebc432f97967fa`. Final benchmark source commit: `9f3898f80aa5b9eac68e0c72483238ebcc3fa9d5`. Original research worktree is recorded as `$HOME/keli-research-2026-fast-spike` on `research/2026-fast-spike`; these files now live in this repository as sanitized historical evidence. The primary Cursor worktree was inspected initially and left out of scope thereafter. No runtime files were changed by the spike. Research date is 2026-09-14 Europe/Berlin; UTC timestamps in artifacts can be September 13.

## Exact evidence

[Final summary](../evidence/2026-fast-spike/run-final/summary.json), [complete final trace](../evidence/2026-fast-spike/run-final/trace.jsonl), [final validation](../evidence/2026-fast-spike/validation-final/summary.json). Initial run and its traces remain under `run-001`; it predates the replacement-insert guard. Final source SHA-256 values are recorded in the final summary. UUIDs, timestamp fields and latency vary on replay; fixtures, decisions and contract verdicts should agree.

| Experiment | Measured outcome | What it does and does not establish |
|---|---|---|
| A addressed history | 250 event writes, one derived-state write; full history 114,749 bytes, projection 80 bytes; exact source recovered after reopen; tail lost it; 7 checks | Bounded view can preserve access to exact source. Full transcript also succeeds. This is not a token measurement, quality comparison to Keli compression, crash test or executable-kernel result. |
| B raw search controls | One positive target: actual Keli notes FTS recall 0, time-filtered/expanded history recall 1; target-bearing-row precision 0.5 (1 of 2 returned rows); 8 adapter searches plus one Keli notes call; 10 checks | Time/expansion interface can help a constructed case. No RRF advantage measured. Paraphrase and premature seen-session exclusion both fail, intentionally retained. |
| C phase failure memory | Fixed retry: 5 deterministic failures / 4 repeats; phase/revision policy: 2 failures / 1 repeat, then one proposed replan; 4 checks | A 75% reduction in scripted repeated failures; not demonstrated successful repair. Useful replans remain null. A simple per-action retry limit is a competing explanation. |
| D current scoped constraints | Query-only recall 0; authoritative rule retrieval 1; newest value OpenCode, old cached value Codex; 283-byte current rule; foreign scope absent; 5 checks | Existing canonical state beats query-only memory for this policy. No novel router or world-knowledge bridge demonstrated. |
| E transition cache | One cache hit after two consistent scoped observations; none across scope, low confidence/transient controls; contradiction invalidates; 5 checks | Cache behavior only. Semantic learning, downstream success and prediction accuracy unmeasured. |
| F map before acting | One actual wrong test command fails, manifest-derived command passes. Analytical calls for five repeated tasks: blind 10, map 6; one unfamiliar task 2 vs 2; easy known task 1 vs 2; 4 checks | Real command evidence but analytical amortization, not five measured agent tasks. Mandatory mapping loses on easy known tasks. |
| G procedural hook | Six fixed-hook behavior checks pass, including unverified finish→verify, repeat→replan and idempotent verify | Same behavior can be expressed with ordinary predicates. No evidence for general executable or self-evolving skills. |
| H composition | Byte budgets: none 0, top-k 400, dynamic-only 100, dependency-ordered 280; rejects missing/outdated/cyclic/overbudget dependencies; 5 benchmark checks | Explicit dependency closure validates structure. Skill IDs and dependencies were provided, so no selection-quality or model-success gain measured. |
| I typed uncertainty | Nine supplied evidence-state cases select expected next action; two require clarification; 9 checks | Labels are fixture inputs; no calibrated model uncertainty or actual human intervention measured. Generic numeric confidence adds nothing demonstrated. |
| J process verification | Six claimed-complete fixtures: five invalid and one complete. Claim-only false completion 5/6; independent verifier false completion 0/6, accepts complete 1/1 and rejects invalid 5/5; 8 checks | Actual file, subprocess, freshness and changed-file checks distinguish these cases. Keli GateService proposal-only action still reports `executed`; no production fix made. |

Final experiment wall times (ms): A 3401.282; B 630.112; C 0.646; D 97.096; E 0.377; F 60.162; G 0.106; H 1.858; I 0.108; J 506.930. These include each experiment's setup/assertions/log construction; they are single-host observations, not statistically estimated service latencies. SQLite durable writes dominate A. Do not compare these times as rankings of agent architectures.

## Adversarial findings

- **History:** expansion must use session-local positions rather than global event-ID adjacency; an interleaved session must not leak. A SQLite replacement insert can bypass ordinary delete/update assumptions, so the final prototype rejects duplicate-address inserts too. The unit contract verifies replacement rejection. Direct arbitrary database access is not a supported untrusted interface.
- **Search:** zero-overlap wording still misses stored evidence. Excluding a session after reading only its beginning can conceal a later answer. Date filters also apply to neighbors. Scope checks, query quoting and exact expansion are necessary. Full-corpus ranking/scan and storage scaling remain unmeasured; this prototype is not production-sized search.
- **Routing:** a cached prior rule is stale after a correction. D uses the existing authority source at read time. Always-visible generic memory was not evaluated and must not be promoted based on this result.
- **Replanning:** revision/phase changes must not inherit unrelated failure counts. Transient failures remain eligible for bounded retry. The current policy does not prove a useful alternative plan or handle all mixed success/failure trajectories.
- **World heuristics:** one observation, cross-repo transfer, transient outcomes and contradictory new evidence should not become durable rules. The two-observation threshold is a research heuristic, not calibrated confidence. Environment revisions/TTL would be required before a production cache.
- **Skills:** top-k can omit prerequisites while using more context. A cycle/outdated skill/overbudget closure must reject rather than silently remove a dependency. Hand-authored metadata is an important hidden cost and does not solve selection.
- **Verification:** empty/partial implementation, focused-only success, stale generated output and an unexpected dirty file all invalidate the fixture's completion claim. Dirty requested files are allowed: the check rejects unexpected scope, not all legitimate uncommitted edits. The verifier runs only harness-authored commands here; it is not an arbitrary untrusted project sandbox.

The first parser invocation failed before execution because of a TypeScript assertion line break in the new adapter. It was corrected before `run-001`; no evidence-producing run was overwritten. Initial and final successful raw traces are retained. No known benchmark assertion failures were suppressed.

## Validation

Final `bun run check`: pass. Separate research TypeScript project: pass. `bun test`: **131 pass, 1 skip, 0 fail, 303 assertions across 42 files**. This includes nine research contract tests with 17 assertions. The macOS fail-closed test is skipped on this Linux host. Full suite 16.93 seconds (outer process 16.952); benchmark outer process 4.816 seconds. See [raw test output](../evidence/2026-fast-spike/validation-final/tests.log).

Host Bun is **1.4.0**, while `package.json` declares **≥1.4.2**. Tests pass on this host, but declared-version and macOS validation remain pending. Dependencies were installed with `bun install --frozen-lockfile` only in the research worktree; manifest/lockfile unchanged. All stateful tests used temporary KELI_STATE_DIR. Reference trees were read only; their complete suites and deployed services were not launched.

## Answers to the architectural questions

Hermes already offers raw FTS message search, session/lineage grouping, anchor expansion, compacted-history access, task state, skills, retries and an executable verifier. Nanobot offers persistent sessions, literal history search/read, prompt memory, archival fallback, consolidation/dream processing, skills, hooks and subagents. The [gap analysis](hermes-nanobot-keli-gap-analysis.md) identifies exact pinned files/functions and differences. These are convergent mechanisms; historical independent invention is not established.

The largest unproven additions are persistent executable context, bidirectional phase-memory planning, learned memory/composition control and prediction-error semantic learning. None has demonstrated real Keli workload gains in this fast spike. Narrow local effects are demonstrated for exact source access, time/neighbor retrieval controls, current authoritative rule access, dependency validity and deterministic verification. C/F show scripted or analytical efficiency, explicitly not model improvement.

The simplest supported direction is current canonical rules plus recoverable observations, bounded projections/search, existing gated execution and independent verification. Keep a planner/world model/trained memory policy out until it beats simpler controls on the predeclared held-out tasks. The [proposal](../architecture/keli-agent-architecture-proposal.md) contains the full ADOPT/ADAPT/DEFER/REJECT matrix.

## Remaining work beyond the fast spike

This deliverable is a screening and micro-test spike, not completion of the original paper-scale eight-phase program. Abstract-level rows need full method/metric extraction before exact reproduction. Run matched live-model workloads and reference adapters, real implicit-association knowledge controls, long-horizon trajectories, repeated seeds, calibrated uncertainty, corpus-scale retrieval, and a true held-out evaluation before claiming production improvement. Metrics that require those episodes are null in machine outputs. No architecture was accepted because of a paper's reported score or an LLM judge.
