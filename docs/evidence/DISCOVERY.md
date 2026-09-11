# Keli — Discovery and Architecture Evidence

## 1. Executive Summary — architecture discovery CLOSED

The product thesis remains reliable scoped correction, configured coding delegation, truthful outcomes and quiet approved autonomy. The owner has closed architecture discovery and authorized a final buildable PRD. [PRD.md](PRD.md) is now the normative initial-product contract; [PRD_INPUT.md](PRD_INPUT.md) is its reconciled handoff.

**Final direction:** native Bun/TypeScript runtime and control plane; one model loop, necessary-only context/schemas and authoritative Bun dispatch gates. OS mechanisms provide execution restrictions. Rust is optional and narrow, never introduced by default. Nanobot and Hermes are reference implementations and sources of useful capabilities, not foundational runtime candidates. Reuse maintained libraries/protocols and port thin integrations after inspection; do not translate entire agents or sacrifice capabilities to minimize code count.

E1 rejected Nanobot as the authority-owning foundation at the tested pin. B demonstrated an owned Bun gate around a proposal engine. The native slice clearly won for that narrow scripted role. The independent OS probe demonstrated Linux Landlock confinement before a Rust broker reproduced it. Section 38 records exact evidence and limits. Mock latency/token figures do not prove live-model quality, provider breadth or a production sandbox.

The broad product capability contract is retained: shell/files, browser/web/search/HTTP, MCP, memory, skills, jobs/triggers, coding delegates, Discord/Telegram, providers, secure onboarding/auth, artifacts and upgrades. The first release is v0.1.0: a minimal coherent build of this capable product, not a featureless foundation.

Broad access remains a preference, not a proof that unrestricted host mutation and destructive interception coexist. PRD §6 states an enforceable mediated build baseline and preserves the incompatible unrestricted profile as unsupported. Linux and macOS remain day-one requirements; actual backend/support tests are release gates. No evidence here establishes network isolation, macOS sandbox parity or protection from a compromised controller.

The historical research/39-issue snapshot and owner input remain below, dated 2026-09-11. Sections explicitly marked historical are evidence of earlier reasoning, not directions to repeat experiments. A01–A46 are all retained and traced into the PRD. No new architecture experiment, production modification or bot implementation was performed in this documentation closure.


**Latest resolved owner addenda (2026-09-11):** the product is **Keli (כלי)**; use `keli` for CLI/repository/package/release identifiers (DEC-NAME-01), while retaining historical experiment names. [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md) is required now and created, superseding its earlier deferral. [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md) adds a current pinned remote Nanobot/Hermes repository audit, lightweight review/security governance and separate Bun-first local/CI/release/install automation. The four documented Bun compile targets are Linux/macOS x64/arm64; actual platform/security tests still gate release. These additions do not reopen architecture or authorize implementation.

## 2. Product Thesis

**Proposed thesis:** a personal agent whose explicit corrections become durable, scoped, explainable working agreements—and whose recurring work stays within those agreements across sessions and upgrades.

The first exceptional capability should be: **“I corrected this once, it now behaves correctly, and I can see or undo what changed.”** The second is truthful completion: a task, stored preference, scheduled job, and delivered message must have distinct verifiable outcomes.

Hermes, Nanobot, OpenClaw, and Letta are credible substitutes. A new project earns its existence only if a correction-and-recovery acceptance suite demonstrates an improvement over supported configurations of these products. A personal fork fixing one owner's deployment is not evidence of a general product opportunity. The initial target should be a technically assisted personal user managing a few projects and routines; whether fully nontechnical self-hosting is a launch promise remains D2.

The likely durable advantage is the correction dataset, regression suite, dependable behavior lifecycle, and understandable controls. A schema or Rust binary is readily copied. There is no demonstrated commercial moat or validated market demand in this investigation.

## 3. Product Principles

**Final authority:** the latest owner direction selects native Bun/TypeScript. Earlier Nanobot-first and new-runtime-last statements below document the superseded evaluation order; they are not current requirements. All non-conflicting product principles remain. PRD §§1–6 and 12 give the active contract and explicit implementation baselines.

**CONFIRMED owner input [L16]:** a basic robust personal foundation whose users compose tasks, prompts, workflows and procedures through conversation. Fully open source from day one, without reserved closed core capabilities; exact license remains open. Linux AND macOS officially supported from day one. Discord/Telegram only initially, no general web UI, CLI/SSH masked input or provider OAuth/device authorization for credentials. Primary and fallback models in an explained interactive wizard; later routing configurable by the user.

Explicit scoped instructions persist; clarify material ambiguity. Inference remains conservative and lower authority. Automatically create appropriate skills with deduplication; never allow a skill to grant itself permissions. Record meaningful durable behavior/permission changes with provenance and undo, not every conversational decision. Local-first memory; optional Honcho never overrides operational rules. New consequential behavior is proposed; approved recurrence runs within its grant and pauses when corrected or stopped. Missed observational runs coalesce and unchanged checks remain quiet. Return useful partial results with limitations; verify consequential effects before claiming completion.

**CONFIRMED preferences, not proven architecture:** Nanobot FIRST for foundation evaluation; avoid private patches; ADOPT → ADAPT → BUILD. Hermes remains a reuse source, especially onboarding/capabilities. Bun/TypeScript remains a serious candidate for our control/core layer; Elysia is optional. Rust is allowed only for demonstrated narrow value, not required. Broad shell/filesystem access by default remains the owner's preference, with destructive approval and reusable scoped grants. Meaningful security complexity is acceptable. Section 18 explicitly challenges whether these promises can coexist; the owner has not approved narrowing default access.

**Additional confirmed input outside a forced D1–D12 mapping:** proactively offer optional, combinable calibration (guided questions, real task, imported LLM summary); explain and correct the result; teach conversational customization early. Inspect capabilities and research reusable solutions before inability or new code. Modular user-selected coding delegates with optional fallback; a sole configured delegate must be used. Deterministic runtime-owned jobs, natural explainability from state/provenance, granular pause/revocation, and a desirable global pause. The three confirmed v1 outcomes are durable corrections, correct configured coding delegation, and reliable quiet approved recurring/proactive research.

**Final architecture clarification [L17]: SMALL CUSTOM CORE + RICH REUSED CAPABILITY SET.** Nanobot/Python is the first foundation candidate, not a commitment that our control layer must be Python. Bun/TypeScript remains a serious control-core candidate if it gives materially cleaner ownership/enforcement while retaining existing capabilities. Elysia only for a needed HTTP/control surface; narrow Rust only for an E2-demonstrated missing boundary. Compact custom infrastructure must not mean removing useful browser/search/MCP/jobs or other maintained integrations.

## 4. Current Environment — david

### Verified inventory

| Area | Observed state | Significance |
|---|---|---|
| Host | Linux host `vmi3366806`, home `/home/david`; direct shell available | Local Grok export README explicitly identifies this host as Nancy's VPS [L11] |
| Active personal agent | `nanobot-gateway.service`, active/running; Python 3.12; working directory `/home/david/.nanobot/workspace`; sampled `NRestarts=0` since service activation Sep 10 | Current Nancy service, not the older Hermes gateway |
| Hermes gateway | `hermes-gateway.service` inactive at inspection | Historical “live Hermes” reports must not be read as current service status |
| Other active user services | Finance statement processor and Hermes finance intake worker | Hermes-adjacent workloads remain even while its gateway is inactive |
| Timers | Nancy health watchdog, crypto scan, crypto delivery retry, Hermes daily update, Abi compatibility check | More than one scheduling mechanism exists; timer presence does not prove workload success |
| Agent deployment repository | `/home/david/agent`, HEAD `e4dba85fa3587bc54722983a2acadd1a024d5756` | Profiles, schemas, policies, adapters, deployment tooling, patches, tests, domain skills |
| Hermes checkout | `/home/david/.hermes/hermes-agent`, HEAD `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` | Local delivery fixes beyond the upstream baseline; source remains relevant |
| Nanobot source | `/home/david/.nanobot/src/nanobot`, HEAD `f49965445152361b779b465e8a5111549ac934c4` | Source checkout is not byte-identical to all installed modules |
| Nanobot release | `/home/david/.nanobot/releases/82a5cb72`; release manifest identifies `82a5cb72277469586aca4bc2d83f8e15a458be95`, Python 3.12, Honcho SDK 2.4.0 | The installed release and source must be distinguished [L3] |
| Local overlays | `/home/david/.nanobot/extensions`, Agent deployment scripts, release-specific repairs | Thread routing/search behavior is partly supplied outside a supported native API [L5, L6] |
| Domain systems | `/home/david/rocket`, `/home/david/nave`, finance repositories, `/home/david/quant-portfolio-manager` | Domain logic should remain separate from a personal-agent core |
| Comparison lab | `/home/david/runtime-lab/bakeoff` | Historical same-task artifacts for Hermes, Nanobot, OpenClaw; limited comparability [L7] |
| Grok environment | `/home/david/grok-bot-parallel` | Specification/export for a separate Grok Agent Computer, not evidence Grok is running here [L11] |

Nanobot's configuration contains Discord and WebSocket channel entries enabled; Telegram was not observed enabled in that inspected config. No general conclusion about all archived Telegram experiments follows. Hermes root contains 147 `SKILL.md` files; Nancy's inspected workspace skill tree contains four. Counts exclude other profile/plugin stores and measure files, not quality or duplication.

### State and infrastructure

Hermes has SQLite session/message state, routing, delivery obligations, compression locks, turn leases, and FTS tables in `state.db`; Kanban stores tasks, runs, events and a notification delivery ledger in `kanban.db`. Other observed stores include projects, verification evidence, memories, profiles, checkpoints, pending messages, cron, browser profiles, objectives, decisions, and budgets. Nanobot has sessions, cron, objectives, watches, rendered context, memory files, and `llm_usage.sqlite3`. This is an inventory, not proof all stores are active or authoritative. [L1, L10]

Systemd supervision, OS cron, Python virtual environments, Bun/Node assets, browser tooling, and multiple application-specific runtimes coexist. No dedicated Redis/Postgres queue was established by the limited inventory; absence is not proven. Raw crontabs, full process arguments, environment dumps, secrets, and full conversation logs were not printed.

Metadata inspection found mode `0600` on the inspected Hermes config/auth/Honcho/.env files and Nanobot config/.env files. **This establishes file permissions only, not encryption, key isolation, or secret safety.** Hermes source documentation explicitly describes secret-source resolution into process environment and the resulting trust in in-process plugins. [L9]

### Version drift verified directly

Compared six installed Nanobot modules against the source checkout. `cron/service.py`, `bus/queue.py`, and `agent/subagent.py` matched. `agent/context.py`, `agent/memory.py`, and `agent/skills.py` differed. Differences include summary-checkpoint handling and opt-in skill filtering. These are not automatically bugs; they demonstrate why inspecting an adjacent checkout is insufficient to identify runtime behavior. The complete running process image and every loaded overlay were not reconstructed. [L1, L3]

## 5. Historical Failure Analysis

| Failure class | Evidence and what happened | Root cause / confidence | Existing fix and assessment | Prevention in proposed product |
|---|---|---|---|---|
| Execution reported as delivery | Hermes commits `b5a7062c0a`, `93e2525a0b`; notification contract distinguishes pending sends [L2, L4] | Acknowledgement and queue acceptance were conflated; high source/history confidence | Durable destination outcomes and unconfirmed timeout state: structural | Separate action result, outbox state, and transport receipt; unknown is not sent |
| Discord origin lost | Hermes `0676c4c8ba`; Agent `44210ff23`; Nancy thread adapter [L2, L5] | Route metadata not preserved/enforced at every boundary; high | Origin preservation is structural; monkey-patching a private handler is compatibility-fragile | Durable conversation/destination IDs passed by runtime, never chosen by LLM |
| Broad searches harm responsiveness | Agent `e2ab9fc44`, `nancy_search_guard.py` [L6] | Broad work needed isolation, timeout and bounded output; medium for historical incident, high for fix mechanism | Ripgrep subprocess, output bound, watchdog; resource bound structural, watchdog only recovery | Run blocking tools out of gateway process, enforce cancellation and output/CPU limits |
| Customizations do not reproduce after update | Sep 2 portability audit reported 11 local commits, stale deployment baseline [L8] | Multiple owners for runtime, patches, systemd and state; high historical documentary confidence | Candidate compatibility/promotion pipeline is structural; repeating local patch chains perpetuates debt | Versioned release manifest, supported adapters, state outside release, restore test |
| Behavior/context changes require patches | Agent `05437b20f`, `690d6eae8`, `44210ff23`; installed skill/context differences [L1, L5] | Visibility, scope and native feature activation split across rendered prompts, source and release | Some prompt repairs improve visibility; do not enforce durable semantics | Atomic behavior commits and runtime consumption, with current revision in each run |
| Duplicate or noisy notifications | Quiet crypto outbox commit `2ef50ed4b`; Abi notification contract [L2, L4] | Work completion was used as attention policy; producer-specific ledgers | Typed notification semantics and durable outbox are structural | Change/urgency gate plus destination-bound identity shared across producers |
| Wrong diagnostics despite work existing | Agent `6811cdbb2` and `9d47f2ad6` | Job ID/name mismatch; user D-Bus context missing | Local patches repair concrete integration assumptions | Stable IDs; report sensor unavailable separately from workload unhealthy |
| Research continuity / unsupported success | Nancy continuity repair and local same-task quality notes [L5, L7] | Incomplete evidence and ambiguous task continuation, with mixed prompt/tool responsibility | Verification contracts improve reliability; not proof all research is correct | Task-specific done conditions and evidence, no universal claim-success heuristic |
| Memory writer/migration ambiguity | Release manifest removed legacy Honcho overlay, migrated 15 JSONL sessions, retained native MEMORY file [L3] | Multiple writers and stores could diverge; causal link to every forgotten preference unproven | Native optional integration reduces duplication | One operational authority; remote memory cannot override it |
| Staged versus live mismatch | Sep 10 repair review explicitly distinguishes deployed adapter from staged jobs and later portfolio activation [L12] | A prepared artifact or passing test is not activation | Review and release targeting helped; still manual coordination | Explicit proposed/validated/active states and activation receipts |

**Important limit:** these findings do not establish that every reported “forgotten instruction” came from a specific mechanism. No controlled replay of the owner's full private conversation history was performed. Frozen context, summary loss, ambiguous scope, omitted retrieval, and multiple writers are hypotheses for individual cases until traced through that case's input, commit, context manifest and action.

Bounded journal analysis examined the most recent 3,000 Nanobot entries since Sep 8. Lexical matches included 52 “error”, 19 “traceback”, and nine “timeout” entries, with overlapping categories. These are **not incident counts**; no reliability rate is derived from them. Raw messages were kept out of this report.

## 6. Hermes Analysis

**OBSERVED SOURCE:** the inspected Hermes tree is broad, with provider adapters, gateway transports, tools, memory/context/browser/secret plugin contracts, CLI setup, cron, and SQLite session state. Its root engineering guide explicitly prioritizes a narrow tool surface and stable per-conversation prompt prefixes. [L9]

| Area | Verdict | Reason |
|---|---|---|
| Onboarding | LEARN FROM / ADAPT | Setup reuses provider/model selection, supports hidden credential input and resumable navigation; do not port all setup code and its dependency graph |
| Memory | LEARN FROM | Bounded memory files, explicit updates and session search are useful; a frozen session snapshot is insufficient as operational authority |
| Skills | REUSE format / ADAPT lifecycle | On-demand procedural instructions already exist; add typed identity, activation and rollback only where missing |
| Context | WRAP or ADAPT | Replaceable context-engine seam, searchable archives, identifiers and user-message anchors are stronger than naive summarization |
| Browser/search/shell backends | WRAP when using Hermes | Reuse existing integrations; preserve isolation caveats and avoid extracting interconnected internals blindly |
| Discord/cron delivery | ADAPT contracts/tests | Current local receipts and origin preservation directly address real failures |
| Plugins | KEEP supported seams; AVOID privilege assumptions | In-process enabled code can observe process secrets; manifest metadata alone is not isolation |
| Updater | LEARN FROM; do not adopt deployment blindly | Existing owner patches and mutable environments have already complicated promotion |
| Whole runtime | E1 candidate, not automatic FORK | Broad ready-made capabilities may be cheaper than a replacement, but product invariants need enforceable seams |

Default persistent memory documentation describes bounded `MEMORY.md` and `USER.md`, frozen at session start, with live changes visible in tool results and next-session prompts. This is an explicit cache strategy, not an accidental bug. Recommendation: durable operational rules should be consulted independently before governed execution; conversational hints may still use a frozen prefix with appended deltas. [L9]

Compression documentation describes a primary compressor plus a gateway safety net; failure cooldown; searchable archived content; identifier anchors; and retention of actual user messages. These address overflow and continuity, but two compression owners require careful coordination. Its reported evaluation improvements were not independently reproduced here; do not transfer benchmark numbers to this product.

The inspected license is MIT. Reusing specific code requires preserving notices and reviewing bundled dependencies/assets separately. Prefer an upstream-supported extension over maintaining a new whole-runtime fork. [L9; S1]

### Reuse without importing Hermes wholesale

For a Nanobot foundation, reuse Hermes' explained provider/model selection, masked credential entry, setup navigation, progressive capabilities and receipt/origin regression contracts. Adapt small MIT components only after checking imports and transitive notices; otherwise reproduce the interaction pattern using Nanobot's existing CLI library. Do not import Hermes' gateway, full configuration tree, second scheduler or memory writer merely to obtain its wizard. Reuse standalone search/browser/MCP integrations where their external contracts suffice.

Hermes' documented ACP mode is a **server for editor clients**. Its local `delegate_task` creates Hermes child agents; it is not evidence of a universal host for Codex/Claude/OpenCode/Grok. Provider-specific ACP clients/bridges exist locally, but general delegate lifecycle equivalence remains E4. [L9, L14; S41]

## 7. Nanobot Analysis

**Historical pre-spike analysis retained for provenance.** Architecture choices and readiness language in this section are superseded by section 38 and PRD.md; factual source observations and confirmed owner input remain evidence.

**OBSERVED SOURCE:** the agent loop remains organized around channels, messages, providers, tools, sessions, memory and skills. However, current Nanobot is not merely the tiny original demo: the inspected tree includes scoped security, plugins, CLI apps, Honcho, background work, WebUI/TUI, session governance, and a substantial dependency set. The package declares alpha status. [L1; S2]

`ContextBuilder` assembles identity, project AGENTS, global SOUL/USER, tool contract, memory, always-loaded skills, a skill summary, and optional session summary. That is readable and useful but does not establish typed precedence among conflicting natural-language rules. `MemoryStore` maintains Git-backed durable files and separate history/checkpoint cursors. This means “version memory with Git” is already implemented; it is not a new differentiator. [L1]

The skill loader resolves workspace before plugin before built-in names and supports aliases. This prevents exact-name collisions, not semantic duplicates. The installed release adds opt-in filtering absent from the adjacent source checkout. The bus uses unbounded `asyncio.Queue` instances. This bus alone is not durable ingress or bounded backpressure, although surrounding features can persist state. Cron includes file locking, atomic writes, recovery from persistence failure, origin metadata and run history; it must not be dismissed as an unsafely rewritten JSON file. [L1]

| Area | Verdict | Boundary |
|---|---|---|
| Repository readability and small loop | KEEP / LEARN FROM | Follow the readable path, not a line-count target |
| Context/skill progressive loading | ADAPT | Exact rules must bypass fuzzy retrieval; skill catalogue growth needs measurement |
| Git-backed memory | LEARN FROM | File history helps audit but does not itself provide scoped atomic behavior transitions |
| Transports and cron | WRAP in a Nanobot-based trial | Preserve native behavior; add missing guarantees through supported APIs |
| In-memory bus | AVOID as sole durable queue | Crash-safe action/outbox persistence belongs below it |
| Custom `.pth` / private-method overlays | AVOID | Local Nancy fixes demonstrate coupling to runtime construction and private signatures |
| Whole fork | Not the default; supported Nanobot integration FIRST | A new fork must beat a supported extension on both guarantees and maintenance |

Inspected root license is MIT. Runtime dependencies include provider SDKs, MCP, Pydantic, filelock, croniter, Git tooling and document parsers. Dependency simplicity must be assessed from the actual release, including third-party notices, not the project's original reputation. [L1]

### Deeper Nanobot foundation assessment — continuation

These are observations of source revision `f49965445152361b779b465e8a5111549ac934c4`, not claims that every feature is active in the installed `82a5cb72` release. [L14]

| Seam / subsystem | Verified mechanism | What it permits / remaining gate |
|---|---|---|
| Python SDK | Documented `Nanobot.from_config`, run/stream, session keys, usage and stop reason | Compose around the existing loop; do not bootstrap live configuration during experiments |
| Runtime context | SDK context-provider registration and turn-persisted callback; unsubscribe support | Inject selected behavior context and observe persistence; atomic operational commits remain product responsibility |
| Hooks | Tool pre-execution hook; default exception isolation; explicit `reraise` option | Ordinary observability hooks are not fail-closed authorization. Hook factory exceptions are also caught; ephemeral paths can omit extra hooks |
| Tool execution | Resolved tools execute directly after preparation/pre-hook | Wrapping only `ToolRegistry.execute` misses the normal resolved-tool branch. Prove all paths in E1 |
| External tools | `nanobot.tools` entry points | Supported additions; loader skips plugin collisions with built-in tool names. Replacing built-in shell through a same-name plugin is not a supported override |
| Agent Plugins | Validated package manifests, explicit enablement and content fingerprints; skill/MCP discovery | Changed package content invalidates activation. Manifest permissions are metadata, not OS enforcement; test version compatibility |
| Context/cache | Progressive skill loading, stable cached schema ordering, provider cache markers and session cache keys | Plausible efficiency mechanisms; mandatory rule deltas must not wait for prefix refresh |
| Tool concurrency | Explicit `concurrency_safe` tools batched with stable result order | Potential latency improvement; unsafe tools remain sequential; measure end-to-end impact |
| Memory/skills | Git-backed files, checkpoints, scoped context and skill precedence | Reuse storage/lifecycle where sound; exact-name dedupe is not semantic dedupe or authority ordering |
| Scheduler | Locked/atomic persisted store, dirty-save recovery; timer awaits due jobs sequentially | Reuse first. Long jobs can delay others; crash after effect before persistence needs reconciliation; verify startup/misfire/DST behavior |
| Services | Documented systemd user service and macOS launchd LaunchAgent installation with dry-run | Reuse service generation; no new service framework. Pin interpreter to active release and prevent duplicate workers |
| Shell sandbox | Inspected `_BACKENDS` contains only `bwrap`; destructive guard calls itself best-effort | Native macOS service support is not macOS security parity. E2 needs a separate enforced backend |

The local Nancy search guard patches `AgentLoop.__init__` via startup injection and replaces a registered grep tool. Discord thread overlay patches the private `_handle_discord_message`. These are concrete fragile seams, not a reason to copy overlays into v1. Replace through a supported public configuration/adapter boundary or obtain an upstream generic extension; otherwise reject that integration path. Installed/source context and skill differences also make release-pinned contract tests essential. [L3, L5, L6, L14]

**Foundation verdict:** Nanobot is the first and credible candidate, not yet approved as a security foundation. E1 must demonstrate mandatory gating for ordinary/ephemeral turns, cron, tools, MCP and delegates, and supported deterministic routing. An SDK makes composition possible; it does not establish complete mediation. Favor a small maintained upstream contribution over ongoing private injection, and a separate restricted execution process over trusting a model hook. No fork or replacement runtime is authorized here.

## 8. Other Existing Systems

**Agent/Abi:** the existing deployment repo already contains explicit ownership, scoped objectives, compare-and-swap revisions, atomic persistence, evidence requirements, compatibility checks and budget accounting. Reuse these contracts and fixtures. Its own ownership document candidly classified one budget guard as advisory because the relevant hook could not stop requests. That is a direct warning against presenting observability as enforcement. [L13]

**Rocket/NAVE/finance:** separate domain engines and structured outputs are a useful existing boundary. The new agent should orchestrate these capabilities, not absorb their business logic. The latest sampled Rocket checkout commit concerns structured research outputs and bounded provider fallbacks. Financial histories and private domain artifacts were not copied into discovery.

**OpenClaw:** local bakeoff notes/artifacts are historical evidence, not a currently verified production installation. They show useful task completion alongside a documented scope misunderstanding and high context use in some runs. Current official sandbox docs explicitly distinguish sandbox modes and access choices; reuse that conceptual separation, not its defaults unquestioningly. [L7; S7]

**Grok Bot:** local files describe a separate cloud computer and read-only migration/export boundary. They specifically warn against duplicated live Nancy schedules. Treat a migration as an ownership transfer with disabled imported jobs, not a bulk copy. Grok Build is a separate coding-delegate product and was researched through its own current documentation. [L11; S6]

## 9. External Landscape Research

The following are documented capabilities and architectural lessons, not a ranking based on stars or vendor benchmarks.

| Candidate/category | Useful lesson | Why not automatically adopt the whole system |
|---|---|---|
| Pi agent harness | Separate multi-provider API and agent-core packages; small composable runtime [S13] | README explicitly says host filesystem/process/network permissions are inherited; permission enforcement must be external |
| Vercel AI SDK | Existing TypeScript provider/tool abstractions [S14] | Must test provider-specific caching, usage and cancellation; don't add Pi and AI SDK simultaneously |
| LangGraph | Checkpoints, resumable state and interrupts [S15] | A graph framework can become unnecessary architecture for short personal routines |
| DBOS TypeScript | Durable steps and queues [S17] | Reviewed TypeScript guide requires Postgres; this changes the installer and operational footprint |
| Temporal | Durable workflow execution [S18] | Useful for sophisticated long-running workflows; excessive default infrastructure for an unvalidated personal agent |
| Honcho | Optional inferred understanding of people/projects, hosted or self-hosted [S19] | Not the canonical authorization or explicit-rule engine; service, privacy and license obligations differ from a local database |
| Mem0 | Extracted/retrieved memory as a replaceable service/library [S20] | Relevance memory does not guarantee an exact operational rule will be applied |
| Letta Code | Stateful harness, versioned context, skills, conversational configuration [S16] | Strong thesis overlap; self-modification directions do not automatically fit a stable-core promise |
| Playwright | Browser engine/library/CLI/MCP reuse [S21] | Browser cookies, downloads and external content introduce a distinct authority boundary |
| ACP | Standard client/agent interaction [S22] | Does not erase differences in resume, permission, cost or remote-side-effect semantics |
| OpenTelemetry | Portable traces and sensitive-data handling [S23] | A remote collector should be optional; tracing is not the canonical audit database |

### Long-running autonomy

Useful mechanisms are durable task state, bounded plans, checkpointed observations, resumable delegate handles, explicit blockers, independent result verification, and cancellation that reaches child processes. A plan is a revisable aid, not proof of progress. Checkpoint storage should contain goal, constraints, completed facts, artifacts, pending actions and uncertain outcomes; it need not persist hidden model reasoning.

For a short task, a normal tool loop is enough. For a multi-hour task, a bounded iteration should end in complete, blocked, waiting, cancelled, or checkpointed-for-continuation. Do not keep an unbounded prompt loop alive simply because the goal is open. Novel opportunities are proposals; retries and approved continuations are execution of existing authority.

Anthropic's context-engineering guidance supports selective context, compaction, external notes and isolated subagents. Its advanced-tool-use work motivates on-demand schemas and processing bulk results outside model context. These are useful mechanisms, not evidence that any model can safely discover its own permissions. [S24, S25]

### Bounded open-issue mining — current GitHub snapshot

**Snapshot: 2026-09-11, approximately 02:15–02:25 UTC.** All 16 requested Nanobot issues, all 14 requested Hermes issues and nine selected Codex issues were individually fetched and were **OPEN**. Bodies and relevant discussion were reviewed; linked PR states were checked where they materially changed reuse conclusions. Open status does not imply the original reproduction remains present on current main or the installed release. Issue authors' observations, maintainer/contributor interpretation, automated triage and our architectural inference are distinct. No reported failure was reproduced on david.

Codex selection used bounded open-issue queries for MCP/processes, context/tokens/compaction, atomic config, and approval/background recovery; concrete logs/reproductions were prioritized over broad feature requests. This is a purposive failure-class sample, not an issue-frequency or cross-product reliability benchmark. Windows-specific reports inform portable invariants but do not add Windows support. Some comments are explicitly AI-generated; their proposed causal explanations or fix status are not accepted without independent metadata/source support.

The compact register below records user pain, local bug versus invariant, current coverage/gap, smallest addition and reuse/architecture consequence. I1–I10 are defined immediately afterward; A/B/C/D in the final column refer to section 27. “Reuse” means candidate code/contracts, not installation or endorsement of a fork.

#### HKUDS/nanobot

| Open issue / last updated (UTC) | Reported pain and evidence class | Design coverage / smallest invariant | Reuse and architecture consequence |
|---|---|---|---|
| [#5510 — feat: zero-token conditional triggers as lightweight alternative to heartbeat polling ](https://github.com/HKUDS/nanobot/issues/5510) · 2026-08-24 | Proposal: idle heartbeat wakes the model without useful work. | I5 strengthens quiet scheduling to zero model calls for false deterministic predicates; no trigger framework. | Reuse CronService/HTTP/file checks; A remains plausible, B only if dispatch cannot be intercepted. |
| [#5511 — feat: crash-safe task ledger for multi-step agent tasks ](https://github.com/HKUDS/nanobot/issues/5511) · 2026-08-24 | Proposal with reported restart pain: multi-step progress disappears. | I3 already intended; require durable run owner/checkpoint and unknown recovery, not a second todo truth. | Reuse native task/session persistence and SQLite; A/B ownership test, not evidence to mandate JSON ledger. |
| [#4467 — Dream should update existing workspace skills instead of creating duplicates on each run ](https://github.com/HKUDS/nanobot/issues/4467) · 2026-08-16 | User report, corroborated in comments: Dream creates overlapping procedures. | I1 strengthens existing A27: identity/dedup before commit, not a prompt-only reminder. | Adapt existing skills loader/Git history; no separate skill platform; A requires supported write boundary. |
| [#5586 — Let a runtime-context block opt out of history persistence (`ephemeral` blocks) ](https://github.com/HKUDS/nanobot/issues/5586) · 2026-09-02 | Measured repetition report plus proposal: runtime riders accumulate in replay. Comments pivot toward a frozen session seam. | I6 adds distinct session-constant and turn-local lifetimes; never silently diverge provider continuation and reconstructed history. | PR #5627 remains open; do not call its ephemeral flag supported. A seam gate; B must preserve provider protocol too. |
| [#5584 — Bound how far back `reasoning_content` / `thinking_blocks` are replayed to the provider ](https://github.com/HKUDS/nanobot/issues/5584) · 2026-08-28 | Source-based proposal: old reasoning fields replay indefinitely. | I6 bounds obsolete reasoning while preserving active tool-loop/provider-required blocks; not unconditional deletion. | Adapt retained provider/session replay policy; A/B test cold reconstruction and resumed provider state. |
| [#5298 — Proposal: budget model-visible MCP schemas for large tool sets ](https://github.com/HKUDS/nanobot/issues/5298) · 2026-08-16 | Proposal with source analysis: large MCP registry eagerly exposes schemas. | I8 requires budgeted discovery and relevant promotion, with a path to find omitted tools; schema hiding is not authorization. | Reuse registry/static filters now; evaluate Hermes Tool Search contract before custom selector. A context seam is unproven. |
| [#5402 — Token consolidation never triggers — tiktoken estimation consistently underestimates actual API token count ](https://github.com/HKUDS/nanobot/issues/5402) · 2026-08-16 | Provider-specific usage/estimator mismatch report; numeric universality unproven. | I6 attributes actual usage to the exact request/model before calibrating compaction; stale previous usage cannot represent a newly built prompt. | Reuse provider usage fields plus estimator with reserve; A/B instrumentation, no new provider framework. |
| [#5377 — Bug: consolidation truncates archive input but advances past the full message batch ](https://github.com/HKUDS/nanobot/issues/5377) · 2026-08-16 | Deterministic marker reproduction: archive cursor passes omitted content. Current fix moved to raw-fallback preservation. | I7 adds cursor-through-preserved-evidence invariant, including oversized single messages and failure between writes. | Open PR #5379 now chunks raw fallback without extra model calls; adapt tests after merge, no parallel compressor rewrite. |
| [#4797 — Bug: No resource limits on shell subprocesses — no ulimit, cgroups, CPU/memory caps ](https://github.com/HKUDS/nanobot/issues/4797) · 2026-08-18 | Source report: timeout/process cleanup lacks CPU/memory ceilings. | I2 adds resource ceilings independently of wall timeout; unsupported enforcement must be explicit. | Reuse OS/backend limits in E2; only a demonstrated missing boundary supports C. |
| [#5278 — [Security] Session history should not live inside the agent workspace ](https://github.com/HKUDS/nanobot/issues/5278) · 2026-08-07 | Source security report; comment corrects relocation as ineffective under unrestricted reads. | I2 already requires control-state exclusion. Issue remains open although relocation PR #5279 merged; do not present its original path as current. | ADOPT merged external session namespace/migration. Strengthens A reuse; broad-default D1 conflict remains, no language fix. |
| [#5276 — Allow enforcing session-level temporary file isolation ](https://github.com/HKUDS/nanobot/issues/5276) · 2026-08-07 | User report/proposal: session artifacts intermingle. Comment notes partial project support and missing cleanup. | I1/I2 add session scratch/artifact scope, explicit retention; never delete a user deliverable as temporary data. | Reuse workspace scoping and temp-directory primitives; test native chat paths, not WebUI-only controls. |
| [#5674 — agent stops working when provider Nvidia NIM returns a specific error ](https://github.com/HKUDS/nanobot/issues/5674) · 2026-09-05 | Concrete logs: provider timeout string becomes response and cron completion. | I9 adds typed provider failure, retry eligibility and truthful terminal state across model/cron boundaries. | Reuse provider retry/fallback adapters with a checked typed contract. Escalate A to B/D only if no supported path. |
| [#5429 — AgentLoop does not retrieve exceptions from background tasks ](https://github.com/HKUDS/nanobot/issues/5429) · 2026-09-10 | Deterministic exception reproduction: task removed without observing its exception. | Local callback bug plus I3 ownership invariant; logging an exception alone is not durable task recovery. | Upstream callback fix reportedly local, not verified merged. Adapt small fix/standard task lifecycle, not a workflow engine. |
| [#5256 — Bug: /goal message produces dozens of repeated replies when waiting for user's answer ](https://github.com/HKUDS/nanobot/issues/5256) · 2026-08-11 | User loop reproduction; triage separates bad goal admission from runner amplification. | I5 stops waiting/no-progress continuation deterministically; recurring cadence is a job, not an endless finite task. | Open PR #5257 idle guard is candidate reuse. A/B must bound wakeups independently of model compliance. |
| [#4290 — cronjob ends early when there's a subagent spawned ](https://github.com/HKUDS/nanobot/issues/4290) · 2026-08-06 | Cron parent ended before child; follow-up reports ordinary cron fixed, other direct-entry paths differ. | I3 tests each entry point: required child completion/aggregation before parent success; unsupported detached work rejected or given durable delivery ownership. | Reuse coordinator/pending queue/inline wait where supported; no blanket claim all cron remains broken. |
| [#1697 — The result wasn’t returned and the output was incorrect. ](https://github.com/HKUDS/nanobot/issues/1697) · 2026-08-30 | Transcript-only report: promised query never dispatched; root cause not demonstrated. | I3/I9 already separate intent from dispatch/effect/delivery; return partial/blocked honestly, discover available capability first. | Reuse capability discovery and receipts; no trading integration or guessed security bypass added. |

#### NousResearch/hermes-agent

| Open issue / last updated (UTC) | Reported pain and evidence class | Design coverage / smallest invariant | Reuse and architecture consequence |
|---|---|---|---|
| [#4379 — Token overhead analysis: 73% of each API call is fixed overhead (~13.9K tokens) — data + suggestions ](https://github.com/NousResearch/hermes-agent/issues/4379) · 2026-08-12 | Older deployment measurement: eager schemas/skill catalogue dominate context. Cache comments qualify monetary claims. | I8/I6 strengthen schema/token/cache accounting without deleting browser capability merely because chat is the transport. | Reuse existing Tool Search first; PR #48622 stub mode remains open and has enforcement concerns. Supports rich reuse, not Hermes-wide cost ranking. |
| [#47349 — Feature: Configurable Memory Backends — disable memory.md, use honcho/fact_store only ](https://github.com/NousResearch/hermes-agent/issues/47349) · 2026-08-08 | Configuration proposal: facts/rules duplicated and eagerly injected. Body conflates characters with tokens. | I1 already separates instructions/facts/procedures; preserve explicit rules outside optional semantic providers. Do not adopt numeric claim. | Adapt native memory provider/skill interfaces; no forced Honcho or literal file rename requirement. |
| [#34352 — Solving the Multi-Tenant Hermes Problem ](https://github.com/NousResearch/hermes-agent/issues/34352) · 2026-08-16 | Fork/operator report plus architecture proposal: global memory bypasses scope hooks. | I1 strengthens storage-level read AND replacement/delete scope; personal projects/groups need this without team tenancy. | Reuse scoped stores/transactions; fork is evidence of seam pressure, not approved dependency. B/D only if A cannot enforce storage scope. |
| [#82936 — Under `gateway.multiplex_profiles`, the default profile's secrets leak into a secondary profile's `terminal` tool and Kanban worker subprocesses ](https://github.com/NousResearch/hermes-agent/issues/82936) · 2026-08-21 | Synthetic profile reproduction: default secrets reach secondary shell/Kanban; comments include snapshots/standalone workers. | I2 rejects ambient environment as authority; all spawn/restore paths use explicit secret provenance and minimum environment. | Open PR #91293 is a candidate, explicitly not OS isolation. Reuse OS facilities; no automatic case for Rust. |
| [#527 — Feature: Gateway Permission Tiers — Role-Based Access Control (Owner/Admin/User/Guest) for Messenger Platforms ](https://github.com/NousResearch/hermes-agent/issues/527) · 2026-08-30 | Role feature proposal; field comment reports permission hook failures opening access. | I2 keeps authentication separate from capability grants and fails closed on policy errors. Existing owner-only v1 remains. | Reuse identity/pairing/gates; do not import RBAC tiers, platform-role engine or WhatsApp gatekeeper. |
| [#10421 — [Feature] Turn-level live time context for current date/time awareness ](https://github.com/NousResearch/hermes-agent/issues/10421) · 2026-09-10 | Live-time proposal with later dated examples of stale clock/job-state inference. | I6 uses fresh turn time/timezone and explicit running job state; frozen session-start timestamp is not current time. | Reuse clock/turn-context seam and native run records; A/B context gate, not a new memory subsystem. |
| [#67442 — Cross-process turn serialization: CLI-continuity sessions need a DB-level lease ](https://github.com/NousResearch/hermes-agent/issues/67442) · 2026-08-14 | Narrow cross-process serialization gap; existing in-process fixes acknowledged. | I4 requires proven exclusion/fencing for mutation. Reject suggested fail-open execution when a write lease is unavailable. | Reuse DB transactions and native lease concepts; bounded queue/busy receipt for interactive work. Strengthens A/B common contract. |
| [#23717 — RFC: Pluggable SessionDB Provider — PostgreSQL, MySQL, and Beyond ](https://github.com/NousResearch/hermes-agent/issues/23717) · 2026-09-06 | Database-backend RFC citing contention/update failures; assertion that SQLite inevitably corrupts is unsupported. | I10/I4 reinforce transactional ownership and compatible update handoff; no database replacement justified by this issue alone. | Keep SQLite candidate and existing backup/locking; do not build provider abstraction/Postgres service without E3 evidence. |
| [#29531 — Per-session working directory for gateway (OpenAI-compatible API) sessions ](https://github.com/NousResearch/hermes-agent/issues/29531) · 2026-09-02 | API working-directory report: process-global cwd fails concurrent project use. | I1/I2 bind cwd/project before execution and context discovery; storing cwd after execution is insufficient. | Existing ACP task-local overrides are reusable contracts; native API exposure still needs conformance, not a new shell. |
| [#5257 — feat: Generalized ACP client for multi-agent CLI orchestration ](https://github.com/NousResearch/hermes-agent/issues/5257) · 2026-08-20 | General ACP client proposal; comments identify limited real-agent conformance and later plugin seam. | I9 selection and lifecycle must be checked, not inferred from protocol names. | PR #68222 closed unmerged as superseded by external-process plugin seam; adapt maintained bridge/client packages. Strengthens B/D reuse option, not five adapters. |
| [#15311 — Add generic action buttons / inline keyboard support for messaging platforms ](https://github.com/NousResearch/hermes-agent/issues/15311) · 2026-08-09 | Generic action-button request; existing built-in buttons do not supply a generic workflow contract. | I9 already binds approval actor/run/grant/expiry; callbacks must use the one transport receiver. | Reuse Telegram/Discord buttons and current approval flow; generic arbitrary action builder is not a new v1 feature. |
| [#4335 — Feature Request: Cross-platform session context sharing (CLI ↔ Telegram) ](https://github.com/NousResearch/hermes-agent/issues/4335) · 2026-09-10 | Continuity request; later comments distinguish explicit handoff/linking from broadcast. | I1 preserves confirmed shared personal memory with separate histories; linking identity is not session merging. | Reuse identity/session lookup contracts; no automatic transcript merge and no reopening D5 accepted portion. |
| [#18715 — Support remote Hermes agent with local tool execution ](https://github.com/NousResearch/hermes-agent/issues/18715) · 2026-09-05 | Remote/local execution proposal: users expect local tools but server executes remotely. | I2 attaches execution host/workspace to grant and receipt. Distributed execution stays later. | Keep runtime/runner boundary clean; supports possible B/D composition, not a v1 remote-brain system. |
| [#52010 — [Bug]: macOS Full Disk Access (Files & Folders) revoked after every Hermes Desktop update ](https://github.com/NousResearch/hermes-agent/issues/52010) · 2026-08-26 | macOS update permission-loss report; original proposed fix is narrowed by later opt-in identity repair. | I10 strengthens A33: verify effective access after update, explain reauthorization; signing is not blanket permission. | Merged #95091 has identity setup/postcondition code. Reuse applicable identity/doctor patterns; Electron remedy not copied blindly into CLI packaging. |

#### openai/codex

| Open issue / last updated (UTC) | Reported pain and evidence class | Design coverage / smallest invariant | Reuse and architecture consequence |
|---|---|---|---|
| [#43015 — Severe CLI reliability failure: 63.8 MB image-history requests before any compaction, WebSocket fallback, and prolonged stalls on Windows ](https://github.com/openai/codex/issues/43015) · 2026-09-11 | Measured image-history/request growth and long retry episodes; proxy/nondefault context settings disclosed. | I6 adds aggregate serialized-byte and artifact budgets independent of token/cache counts, plus bounded retries. | Reuse artifact references, serializers and compaction; no custom media store framework. Neither Python nor Rust inherently prevents amplification. |
| [#38754 — [Windows Codex app] Local stdio MCP servers are repeatedly spawned and not reaped within a single task ](https://github.com/openai/codex/issues/38754) · 2026-09-11 | Repeated Windows stdio MCP process accumulation with live parent; corroborating comments. | I3 gives each connection/process a scope, owner and release path; dead-parent orphan cleanup alone fails. | Reuse MCP clients and OS process groups with explicit disposal; test Linux/macOS analogues, no Windows launch scope added. |
| [#26421 — Desktop: config.toml zero-filled to NUL bytes after ungraceful shutdown — non-atomic write on Windows loses entire file content ](https://github.com/openai/codex/issues/26421) · 2026-09-11 | Repeated NUL-filled config reports after instability; newer comments qualify original non-atomic writer attribution. | I10 demands durable old-or-new config, validation and recoverable failure across every writer; exact upstream cause unproven. | Reuse proven atomic persistence/SQLite; fault-inject disposable copies on launch OSes, no power-cut experiment on david. |
| [#44408 — [macOS] Repeated Bad Request aborts desktop turns after successful commands and on simple follow-ups ](https://github.com/openai/codex/issues/44408) · 2026-09-11 | macOS logged command success followed by turn failure/no final answer; endpoint/cause unknown. | I9 keeps executed effect independent of model/report failure; retry delivery/summary without replaying the action. | Reuse receipts/outbox/checkpoints; no assumption MCP caused it or language rewrite fixes it. |
| [#44401 — [Windows Desktop] 26.903.8094.0 app-server queue blocks plugins and Remote Control; recent history omitted after restart ](https://github.com/openai/codex/issues/44401) · 2026-09-11 | Queue saturation and recent history omitted despite persisted records; causal link unproven. | I3/I9 reserve recovery/control capacity; presentation reads committed state and distinguishes pending display from lost work. | Reuse bounded queues and process lifecycle; completion is not necessarily MCP teardown. Small B must not duplicate authoritative UI/state. |
| [#41220 — [Meta] Abnormal Codex usage/quota depletion and usage-accounting inconsistencies — cross-report tracker ](https://github.com/openai/codex/issues/41220) · 2026-09-11 | Meta tracker of usage/accounting complaints, not proof of one billing defect. | I6/I5 strengthen attribution of foreground/background/retries/compaction/delegates and unknown charges; local tokens are not subscription quota. | Reuse provider usage and local ledger; no new billing platform or unverified quota claims. |
| [#23051 — Bug: Opening an MCP-related local history thread corrupts/pollutes other conversations and leaves UI stuck waiting for approval ](https://github.com/openai/codex/issues/23051) · 2026-08-16 | History-rendering failure; reporter corrects approval badge as incidental, storage corruption not established. | I9 quarantines malformed scoped events and reconstructs projection without mutating other histories. | Reuse typed event parsing/session IDs and recovery views; do not assert verified cross-user leak. |
| [#28574 — Goal resume after 5-hour usage limit can get stuck in approval prompts despite Full Access; iOS lacks goal pause/resume controls ](https://github.com/openai/codex/issues/28574) · 2026-06-16 | Resume shows Full Access but repeatedly asks approval; version absent. | I9/I10 display current effective grant revision; resume honors revocation, not blindly restored broad access. | Reuse approval/event contracts; current scope is source of truth; no mobile UI feature added. |
| [#40575 — [RFC] Towards Self-Evolving Agents: Interactive Instruction Distillation (/learn) and Rule Metabolism for AGENTS.md ](https://github.com/openai/codex/issues/40575) · 2026-09-11 | RFC: deliberate promotion from learned facts to authoritative instructions. | I1 supports explicit correction lifecycle; authority/dedup already designed. Competitive overlap increases, not market validation. | Reuse memory/skills formats and lifecycle tests; do not adopt review for every explicit instruction or retire owner rules automatically. |

#### Corrections from discussion and current fix status

- **Nanobot #5278:** [PR #5279](https://github.com/HKUDS/nanobot/pull/5279) is merged (2026-08-12), despite the issue remaining open. The inspected local source also uses an external runtime session namespace. Adopt its scoped migration/rollback contract; relocating files cannot protect them from unrestricted reads. Its tests are upstream-reported, not run here.
- **Nanobot #5377:** [open PR #5379](https://github.com/HKUDS/nanobot/pull/5379), head `6ad4c50356e2acb80bb0dcac2c90715bea5fa6a2`, now fixes bounded **raw fallback** preservation. The old serial model-chunk approach was replaced. Its small diff preserves the full public archive range before cursor advance; do not repeat stale claims about extra serial model calls.
- **Nanobot #5586:** [discussion](https://github.com/HKUDS/nanobot/issues/5586#issuecomment-5496743640) proposes a frozen session-scoped seam after replay-consistency concerns; [PR #5627](https://github.com/HKUDS/nanobot/pull/5627) remains open with an ephemeral-block design. These are unresolved alternatives. Session-constant contract stored once is different from fresh per-turn time; neither allows silent editing of provider-required prior state.
- **Nanobot #4290:** [follow-up](https://github.com/HKUDS/nanobot/issues/4290#issuecomment-5203024421) reports bound cron now uses the coordinator; heartbeat/API/one-shot paths differ. E1 tests actual pinned entry points instead of assuming the original cron failure persists.
- **Hermes secret isolation:** [PR #91293](https://github.com/NousResearch/hermes-agent/pull/91293) is open. It proposes profile-provenance filtering for terminal/snapshot/worker environments and expressly does not provide an OS boundary. Do not adopt a substring blacklist as proof of isolation.
- **Hermes ACP:** [PR #68222](https://github.com/NousResearch/hermes-agent/pull/68222) is **closed, unmerged**, superseded by a generic external-process provider seam. The local [provider-plugin documentation](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/developer-guide/model-provider-plugin.md) describes launch fields and a client factory without core edits. This is useful reuse, but a model-provider bridge is not automatically our full coding-delegate supervision contract.
- **Hermes macOS:** [PR #95091](https://github.com/NousResearch/hermes-agent/pull/95091) is merged (2026-08-25); [issue follow-up](https://github.com/NousResearch/hermes-agent/issues/52010#issuecomment-5418807441) distinguishes an opt-in certificate-anchored identity repair from an unproven default update path. Do not repeat the original blanket claim that self-signed identity cannot help, or claim all FDA cases fixed.
- **Hermes context:** existing `tools/tool_search.py` in the pinned local checkout already provides progressive discovery/description/call bridges. [Open PR #48622](https://github.com/NousResearch/hermes-agent/pull/48622) is a different stub/delegation proposal with review concerns. Prefer existing supported Tool Search before a new stub system. Reported fixed prompt tokens are not equivalent to uncached charges.
- **Do not inherit exaggerated diagnoses:** [SQLite documents crash-atomic transactions](https://sqlite.org/atomiccommit.html), subject to storage/locking assumptions; #23717 does not prove SQLite inherently unsuitable. Codex #26421's corruption observations are stronger than its original writer diagnosis: a [later source-based comment](https://github.com/openai/codex/issues/26421#issuecomment-5608838600) identifies both direct writes and temporary-file replacement, with durability flush questions still open. Atomic replacement and crash durability are separate requirements; E5 tests both without claiming the exact upstream cause; #23051's corrected account does not establish an approval vulnerability. #47349's character counts are not token counts. These reports warrant tests, not stronger factual claims.

#### Ten invariants, not ten new subsystems

| ID | Required invariant | Existing coverage versus strengthened requirement | Smallest reuse / acceptance consequence |
|---|---|---|---|
| I1 | Every durable rule, fact, procedure and artifact has an owner/type/scope; reads, updates, replacement and deletion enforce it | Authority split/dedup already designed; scoped whole-collection replacement and scratch retention need explicit tests | Native scoped stores/Git/SQLite; A27 retained, add A43; no multi-tenant platform |
| I2 | Authenticated identity is not ambient authority; workers receive only granted resources, scoped credentials and explicit execution host/cwd | Existing trust boundary strengthened across shell, MCP, delegates, PTY, snapshots and standalone jobs; all paths fail closed | Existing sandbox/resource/key-store primitives; A44, E2; broad D1 conflict unchanged |
| I3 | Every background run and owned process/connection has a durable owner, outcome and release/recovery policy | Existing ledger strengthened for required child aggregation, exceptions, live-parent process accumulation and control-plane availability | Native coordinator/task registry/MCP disposal and bounded queues; A42; no workflow engine |
| I4 | Concurrent mutation requires proven session/workspace ownership and fencing | In-process serialization insufficient; expired worker cannot regain write rights merely by waking | SQLite transactions/OS process fencing; extend A11. If an old worker cannot be stopped/fenced, mark unknown and block new writer |
| I5 | Deterministic false predicates and waiting-for-user states do not repeatedly wake the model | Quiet output alone did not prevent token consumption; bound retry/no-progress continuation independently of model adherence | Native scheduler plus simple predicates/event waits; A39; no trigger DSL |
| I6 | Request context has explicit lifetime and separate token, serialized-byte and artifact budgets; usage is request-attributed | Stable caches alone insufficient. Frozen session contract once; fresh turn facts; provider-required replay preserved; no global stripping of reasoning | Retained provider context APIs/usage counters and artifact references; A40/A46 and E6 |
| I7 | A preservation cursor advances only through durably preserved required evidence | New explicit crash/truncation invariant; summary success cannot certify unseen suffixes | Reuse upstream bounded fallback/transaction contract; A45; preserved raw evidence need not all enter prompt |
| I8 | Rich capabilities remain discoverable while only needed schemas enter bounded context; dispatch authorization is independent | Lazy loading existed as direction; add capability recall, schema-size and hidden/direct-call checks | Existing Tool Search/MCP/native registry; A41. Full-registry fallback may not silently violate a hard budget |
| I9 | Intent, dispatch, execution, verification, delivery and presentation are distinct facts; failures and approval state are typed and scoped | Existing receipts strengthened for provider-error-as-text, successful tool followed by failed turn, poisoned history and effective-grant drift | Existing adapters/outbox/typed events; extend A19/A22; no UI or agent loop rewrite |
| I10 | Durable configuration/state and effective permission assumptions survive update or fail visibly with recovery | Existing update contract strengthened for all writers, torn writes, config parsing and post-update OS permission probes | SQLite/established durable replacement and native packaging/doctor; extend A33; no custom signing/crypto framework |

These are proposed enforceable contracts, not claims the current design already prevents failures in working software. I1/I2/I3/I4/I9/I10 largely strengthen existing design; I5/I6/I7/I8 add missing test precision. Issue evidence supports the correction/recovery thesis and makes generic “memory + skills” differentiation less credible. Codex #40575 overlaps the lifecycle idea, but remains an RFC rather than proof that the promised end-to-end guarantee is already solved. No language wins from these reports.

## 10. Reuse Matrix

**Historical pre-spike analysis retained for provenance.** Architecture choices and readiness language in this section are superseded by section 38 and PRD.md; factual source observations and confirmed owner input remain evidence.

Maturity below is a qualitative assessment of inspected code/docs, not an audit certification. “Active” means current source/docs show ongoing development; release versions, advisories, notices and licenses must be pinned and rechecked before distribution. License labels describe the cited project, not every transitive dependency. [S1–S34]

| Capability | Decision and candidate | License / maintenance | Security / coupling / reason |
|---|---|---|---|
| Onboarding | ADAPT Hermes flow; ADOPT Clack for TS | Hermes MIT; Clack MIT; active | Reuse interaction widgets and validation sequence, not all Hermes config internals |
| CLI | ADOPT an existing CLI parser/prompt library; Clack UI | MIT; active | Small commands around the same core API; no separate state writer |
| Discord | ADOPT discord.js if TS; native Nanobot adapter first | Apache-2.0 current repo; active established | Runtime owns route identity, inbox/outbox and approval actor |
| Telegram | ADOPT native Nanobot adapter first; grammY if TS | MIT; active established | Library handles API; product handles dedupe, topics and durable approval |
| Agent loop | ADOPT Nanobot SDK/loop first; alternatives only after E1 | MIT; active | Product policy outside model loop; no inherited host privilege assumption |
| Model abstraction | ADOPT retained runtime provider layer; Pi/AI SDK only if needed | MIT / Apache-2.0; active | One dependency chosen in E1; retain native feature/usage metadata |
| Context management | ADAPT Hermes anchors/recovery; selective assembly | MIT local source; active | Small custom operational selector; avoid importing entire compressor dependency tree |
| Local memory | ADOPT SQLite/FTS; BUILD ownership queries | SQLite public-domain core; mature | File permissions and encryption remain separate; no vector service required initially |
| Honcho | WRAP official client/service | Server AGPL-3.0; client version/license separately checked; active | Optional network boundary; no server code copied by default; review distribution model |
| Skills | ADAPT Agent Skills document shape and existing loaders | Individual skills have individual licenses | Metadata/index/version envelope custom; instructions do not grant execution authority |
| Browser | WRAP Playwright CLI/library/MCP | Apache-2.0; mature active | Separate browser profile and sandbox, no normal-user cookie inheritance |
| Search | WRAP existing provider HTTP/search API; reuse Hermes adapter in that path | Provider terms; adapter license varies | Rate limits, freshness, SSRF controls; don't build crawling infrastructure |
| Shell | ADOPT OS process tooling through sandbox runner | OS/component licenses | Process group lifecycle, bounded output; arbitrary shell is unknown-risk by default |
| Filesystem | ADOPT OS sandbox primitives; small checked adapter | Component-specific | Handle canonical paths, symlinks, races, proc/socket escapes; language is not enforcement |
| MCP | ADOPT official SDK via adapter | MIT SDK candidate; verify exact package | Schema/protocol transport only; explicit local process grants and remote endpoint policy |
| Scheduling | ADAPT known cron parsing; BUILD only narrow job state if embedded option wins | Parser license must be pinned | Scheduler is not a workflow engine; durable occurrence ID and misfire semantics required |
| Durable jobs | E3: native Nanobot scheduler first; narrow ledger/composition if missing | SQLite public-domain / DBOS MIT | DBOS TypeScript Postgres footprint may dominate; don't claim arbitrary external exactly-once |
| Subagents | WRAP selected loop's helper support | Inherits runtime license | Shared root budget and capability subset; defer unrestricted spawning |
| Coding delegation | ADOPT ACP client/bridges where conformant; native protocols for required gaps | Codex Apache-2.0 candidate; other runtime/service terms vary | Own handles/approval bridge, not coding implementation |
| Secrets | ADOPT OS keychain or established vault client | Backend-specific, verify package | Keep service credentials out of generic tool environment; headless unlock is D4 |
| Sandbox | WRAP nono or OpenShell candidate; bubblewrap/OCI alternative | nono/OpenShell Apache-2.0; bubblewrap LGPL-2.1-family, exact release review | nono pre-1.0 warning; E2 decides coverage and install cost, not marketing claims |
| Stronger hostile-code isolation | ADOPT gVisor/microVM only if needed | gVisor Apache-2.0; active | Stronger isolation with compatibility/operations cost; not required for every task |
| Observability | ADOPT OpenTelemetry API + local event log | Apache-2.0 ecosystem | Redact before export; no mandatory SaaS; audit survives trace sampling |
| Backups | WRAP restic plus consistent DB snapshot | BSD-2-Clause candidate; mature | Key recovery and DB consistency belong in UX; don't invent encryption |
| Updates | ADOPT signature tooling/TUF where justified; BUILD activation state | Tool-specific licenses | Signed release and migration compatibility; checksum alone is not origin authentication |
| Installer | ADAPT tiny signed-release bootstrap; Bun compile candidate | Bun MIT with bundled notices | No broad dependency installation or curl of mutable main after bootstrap |

**Strongest product-level reuse:** Nanobot through supported seams, if E1 proves enforcement and lifecycle control without private monkey-patches. **Strongest TS component reuse:** Pi's model/agent packages instead of writing a provider framework. **Strongest local reuse:** the delivery-truth, route-origin, compatibility and scoped-state contracts and their regression fixtures. These are distinct opportunities; none requires copying all of Abi.

No wholesale fork is recommended now. No final package/version selection was installed or security-audited. Small “BUILD” rows remain explicitly conditional: E1/E3 may eliminate them by demonstrating an adequate existing contract.

### Issue-derived reuse priorities

ADOPT Nanobot's merged external session-store migration; ADAPT its existing coordinator, provider errors and archive/fallback contract after tests. Evaluate Hermes' existing Tool Search and external-process provider seam before writing substitutes. Reuse upstream PR fixtures for missing guarantees, but distinguish merged source from open proposed code and test exact versions. Keep browser/HTTP/search through Nanobot/Hermes integrations, Playwright and maintained clients, and transports through native adapters. Only the missing scope/grant/receipt/selection semantics belong to our core. Issue requests for RBAC, remote execution or alternative databases do not justify importing those subsystems. See section 9 for issue/PR links and current status.

## 11. What We Actually Need to Invent

| Custom piece | Alternatives evaluated / actual gap | Minimum contract | Test / replaceability |
|---|---|---|---|
| Behavior transaction and resolver | Hermes text memory, Nanobot Git memory, Letta versioned context, Honcho/Mem0 recall do not establish the complete scoped correction guarantee in inspected evidence | Propose/commit/query/supersede/revert a small typed record, with expected revision and provenance | Conflict/restart/upgrade fixtures; export records independent of runtime |
| Behavior-to-action enforcement integration | Agent loops and MCP expose calls, not the owner's exact product precedence | Resolve applicable rule IDs, constrain governed route/tool/model choice, validate authorization before execution | Deliberately wrong model choice must be rejected or corrected; replace through execution adapter |
| Consistent attention/completion contract | Local outboxes solve producers individually; ordinary library queues don't unify user-visible truth | Separate work result, meaningful-change decision and destination-bound delivery state | Crash/duplicate/unknown-ack tests; persistence adapter independent of transport |

These are small product semantics, not three frameworks. Reuse transactions, storage, schema validation, transport SDKs and process isolation. If an existing runtime can provide all three through maintained APIs, build the product there. Do not invent a workflow DSL, general policy language, semantic optimizer, or memory operating system.

## 12. Proposed Minimum Core

| Primitive | Classification | Minimum responsibility |
|---|---|---|
| Identity + conversation + project reference | MUST BE CORE | Ownership and stable transport mapping; no team roles yet |
| Run/action ledger | MUST BE CORE | Goal, status, checkpoints, verification and outbox linkage |
| Behavior and procedure registry | MUST BE CORE | Explicit state ownership, revisions, retrieval and undo |
| Authorization gate | MUST BE CORE | Enforce grant scope and revocation on every consequential dispatch |
| Capability/delegate registry | MUST BE CORE | Small index, selected schema loading and health/status |
| Schedule record + occurrence ledger | MUST BE CORE if recurring work is v1 | One-shot/repeating triggers, pause, missed-run policy |
| Model loop | OWNED NATIVE BUN RUNTIME | One bounded loop; use maintained provider APIs/SDKs as needed; no foundational Nanobot/Hermes runtime |
| Discord/Telegram renderer | ADAPTER | Platform-specific payloads and acknowledgement parsing |
| Secrets / sandbox / process runner | EXTERNAL DEPENDENCY + checked adapter | OS-enforced authority and process lifecycle |
| Semantic memory, browser and integrations | EXTENSION | Optional capabilities; cannot write operational policy directly |
| Teams, generalized workflows, marketplace | LATER | No speculative interfaces beyond identity/ownership fields |
| Custom language, separate learning daemon framework | UNNECESSARY | Plain records and bounded model calls suffice initially |

This core is already nontrivial. Its admission rule should require a demonstrated invariant, at least two real use cases or a security need, an owner, and a test. Count concepts and lifecycle ownership, not only source lines.

## 13. Adaptive Behavior Model

### Minimal representation

Use three semantic classes: **instruction**, **procedure**, **authorization**. A recurring task references a procedure/goal and an authorization; it is not another form of memory. Observations and inferred preferences remain proposals or low-authority semantic records.

An instruction needs stable ID, owner, scope, condition, value/body, source-message reference, authored time, explicit/inferred origin, revision, status and supersedes link. A narrow typed key such as `coding.delegate` may enforce a delegate selection; free prose can guide judgment but cannot guarantee every aspect of behavior. Avoid turning arbitrary natural language into a falsely precise universal rule grammar.

Proposed lifecycle: interpret → validate scope/conflicts → atomic commit → acknowledge with ordinary language. The acknowledgement must follow durable commit. Record proposed/active/superseded/revoked states and a small append-only change journal alongside current rows. Full event sourcing of the entire application is unnecessary.

### Persistence and correction

“For Rocket changes use Codex” has clear durable project scope: commit and acknowledge without redundant permission. “Use Grok this time” is a run override. “No” is a task correction until clarified by context. “Never do that again” requires identifying “that”; if it could mean a specific action or a whole class, pause that action and clarify scope. Quoted instructions, imported summaries, repository text and tool results are not owner-issued configuration.

Explicit instructions persist until superseded/revoked; inferred preferences may expire or be archived with provenance. Inferred preferences must not silently replace an explicit rule. Do not automatically persist sensitive facts simply because they occurred in chat. D7 confirms this product policy; E6 validates inference/activation thresholds.

### Precedence is two different problems

**Authority:** immutable security limits and current grants bound every action. A current user request cannot override an OS boundary merely by appearing in a prompt. An authenticated permission change uses the grant flow.

**Behavior within that authority:** explicit current run override → most specific applicable explicit instruction → broader explicit instruction → confirmed preference → tentative inference → procedure default. Project instructions generally beat global defaults because scope is more specific; a global explicit prohibition is not merely a default and remains binding. Two equally authoritative contradictory rules should produce a conflict, not an arbitrary numeric score. Revision order resolves explicit supersession, not all semantic disagreement.

Resolve project/identity and mandatory typed instructions deterministically. Use model judgment for relevance and interpretation, with asking when material ambiguity remains. Prompt assembly communicates the selected rules; enforcement checks those choices again at the action boundary.

### Versioning and rollback

Every mutation uses expected-revision concurrency control. A rollback creates a compensating revision and validates references from jobs/skills; it does not erase history or reverse external side effects. “Undo the Grok research change” selects an attributable change and previews ambiguity only if multiple candidates exist. In-flight actions retain an execution snapshot but must re-check current revocation before new side effects. Revocation wins over a cached decision.

### Skills without entropy

Keep Agent Skills-compatible Markdown content, with registry-owned stable identity, aliases, scope, revision, content hash, provenance, activation status and last-use/result references. Add examples because they verify behavior, not a dozen speculative confidence scores.

Automatic draft creation can be quiet. Activate low-risk instruction-only procedures after successful evidence and duplicate search; new code or expanded permission is a software/capability change. A proposed threshold for E6 is two successful similar executions or an explicit request to preserve a procedure; one complex, verified procedure may justify a draft immediately. This threshold is a hypothesis, not a universal law.

Search existing IDs, aliases and semantic candidates before creation. Evolve an existing concept rather than inventing another name. Semantic matches suggest a merge but must not automatically merge conflicting scopes. Keep previous working versions, validate a new version against examples, and pin recurring jobs to a version until compatibility is checked. Archive unused candidates; never garbage-collect explicit user rules or revoke authority based only on low usage.

### First-week simulation

Day 1: create one project and confirm calibration statements. Day 2: commit two corrections with sources, not two prompt files. Day 3: record a recurring pattern as a proposal. Day 4: one approval creates a schedule plus bounded grant. Day 5: a reviewed integration adds a capability and secret reference. Day 6: a tested procedure revision replaces the active pointer. Day 7: an update migrates schema while preserving IDs and passes the correction suite.

The inspect view should explain this as a handful of agreements, one routine and one integration. If the week produces dozens of overlapping rules or a full-history prompt, the design fails its thesis. The same project can have multiple conversations without duplicating project rules.

History is deliberately lightweight: version meaningful durable rule, procedure and permission changes, with source reference, scope, actor and revision. Do not version ordinary conversational reasoning or every temporary choice. An automatically created procedural skill is reusable knowledge, not automatic authorization for new consequential effects. Natural acknowledgement should explain what changed and how to undo it. [L16]

## 14. Memory Model

| Class | Canonical truth | Retrieval / authority |
|---|---|---|
| Operational | Local transactional behavior/grant/job records | Exact scoped queries; authoritative for execution |
| Procedural | Local versioned procedure registry plus content | Index then selected full procedure; authority never exceeds grants |
| Semantic | Local source-linked notes/transcripts; optional remote inferred views | Search/FTS first, optional embeddings/Honcho; advisory |
| Working | Durable task checkpoint and recent conversation | Summaries are derived, replaceable representations |

Honcho can enrich semantic understanding and should remain optional. Its current server is AGPL-3.0; hosted service terms and each client package require separate review. A network service boundary is useful architectural isolation but not a blanket legal exemption. Do not copy server code into a permissive core without license analysis. [S19]

When remote memory is down, explicit rules, procedures, jobs and recent task state must still work. Export to remote memory should use durable upload IDs, retry and an opt-in data policy. Remote inference must not become another operational writer. Disable/delete must address queued uploads and remote deletion separately from local removal.

Local-only semantic fallback can start with source-linked notes plus SQLite FTS. Vector indexing is justified only if E6 shows missed recall that lexical search and scoped metadata cannot address. Mem0 and Letta are alternatives worth testing for semantic recall, not mandatory dependencies. [S16, S20]

Import useful preferences/projects/skills as untrusted candidates with source attribution and an owner-readable review. Do not import credentials or automatically activate old schedules. Preserve legacy text when interpretation is uncertain. General-LLM calibration imports are editable summaries, not proof that the owner approved every statement.

## 15. Initiative & Autonomy Model

A proposal is not a grant. A schedule is not a grant. A skill is not a grant. “Review Rocket every morning and notify me if something is wrong” can authorize recurring read/research and bounded messages to the stated destination; it cannot authorize repository writes, deployments, trading, or arbitrary host administration.

An authorization references owner, allowed capabilities/action classes, resource scope, destinations, trigger/schedule, optional run/cost limits, expiration/review date and revision. New work is checked against this record. Safely matching work runs without repeat approval. Permission expansion produces a concrete request explaining the additional scope.

Approval records bind the authenticated actor, exact action/plan digest, affected resource, grant revision and expiry. A forwarded “approve” message or another server member's click must not authorize execution. Avoid approvals for every internal read or ordinary skill draft.

“Stop, this isn't right” immediately cancels the current run and pauses the identifiable related recurrence. If several routines are plausible, stop the current work first and ask which persistent routine should stay paused. Check revocation between actions; communicate whether an already-submitted external action could not be cancelled.

Notification policy combines deterministic novelty/destination/dedupe/quiet-hour checks with model judgment about relevance and urgency. No mandatory heartbeat. Unchanged routine runs stay silent; blocked, failed or meaningful changed outcomes are delivered according to approved policy. Track dismissals and usefulness feedback without manufacturing a spurious numeric “importance” score.

A global pause is a proposed v1 control alongside required granular pause. Its precise scope and resume behavior is NEW D14. Immediate pause means durably revoke further dispatch and request cancellation promptly; already committed external effects cannot be retroactively prevented. A model's uncertainty about which routine was criticized must not allow the active questionable behavior to continue. [L16]

## 16. Coding Delegation

Use a first-class delegate adapter because a coding agent owns a session, tool loop, workspace, permissions and ongoing execution—not just text generation.

| Delegate | Current documented integration | Recommendation / uncertainty |
|---|---|---|
| Codex | App Server bidirectional JSON-RPC, approvals and task/session events; SDK offers start/continue/resume [S3, S4] | Native fallback candidate behind shared adapter; test abort, restart and approval mapping |
| Claude Code | Agent SDK in TypeScript/Python with tool loop and permission controls [S5] | User-selectable candidate through existing ACP bridge or SDK; auth/terms need validation |
| OpenCode | Headless HTTP/OpenAPI server, SDK, sessions and abort endpoint [S26] | Strong multi-provider alternative; loopback/auth and version contract required |
| Grok Build | CLI, resume/worktree controls, ACP stdio, explicit sandbox/permission options [S6] | ACP candidate; do not assume flags imply identical cancellation semantics |
| Antigravity | Official headless CLI documentation now exists, including machine-readable output [S27] | Not “IDE-only”; test actual release/account headless behavior before promising support |
| ACP | Existing interaction protocol [S22] | Prefer where semantics fit; retain native optional capabilities |

Minimum request: goal, repository/workspace identity, base revision, relevant rules/procedures, allowed effects, acceptance conditions and budget. Minimum response/events: delegate ID, session handle, running/waiting/complete/failed/cancelled state, changed artifacts, evidence, usage if known and external-effect status. Feature flags express resume/abort/approval capabilities; never pretend every delegate supports them.

Verify repository state, claimed artifact and relevant test receipt before marking coding complete. Merge/deploy/send are separate actions. A delegate saying “done” is evidence to check, not authority to declare success.

On transient pre-execution failure, bounded retry is reasonable. After partial edits, keep the workspace and handle, inspect changes and prefer resume. Before fallback, ensure the first delegate has stopped or is fenced from further mutation; transfer a concise checkpoint and real artifact references. If remote execution status is unknown, mark unknown and reconcile rather than launch a second writer. Credentials are references or delegate-managed auth, never copied in handoff text.

### Shared delegate integration before separate adapters

Evaluate one ACP client boundary with pinned existing bridges, including the Claude Agent SDK bridge and Codex ACP bridge. The ACP registry lists OpenCode and Grok Build candidates; registry presence is discovery evidence, not validated support. Preserve native capabilities where required and use native protocols only when the shared path loses approvals, cancellation or recovery. Antigravity remains a separately documented candidate, not assumed ACP-conformant. [S38–S40; S27]

Selection is deterministic user/project configuration: if exactly one delegate is configured, use it; fallback occurs only to an explicitly configured alternative after fencing the prior writer. Do not hardcode Codex preference. Test at least two implementations in E4 to validate modularity; the published launch matrix must distinguish supported, experimental and unavailable capabilities. Hermes' ACP server and own child-agent delegation are not a drop-in general client. Pin bridge/runtime versions and review each license and account requirement; do not auto-install every registry update. [L16; S41]

## 17. Capability / Extension Model

MCP should be a **supported adapter**, not the canonical security or durable workflow architecture. Adopt protocol SDKs and JSON Schema as the cross-language contract; use TypeScript types generated from or checked against the schema. Do not make a TypeScript-only schema library the universal external protocol.

A small manifest needs ID/version, protocol/compatibility version, executable or endpoint, input/output schema, declared resources/effects, required secret references, timeout and health mechanism. Runtime policy determines actual permissions. A manifest's `readOnly` or destructive hint is untrusted metadata until reviewed and constrained. [S10]

Default new extensions to out-of-process restricted execution. A subprocess with the same unrestricted UID, environment and filesystem is fault separation, not a security boundary. Trusted built-ins may share the control process; third-party code should not load there by default. WASM is useful for narrow deterministic transforms, not a universal replacement for browser and shell integrations.

Capability discovery: maintain a small authorized index of names, descriptions, tags, cost/effect hints and availability. Fetch full schemas only for selected tools; deterministic lookup for explicitly named capabilities. Show unavailable capabilities with their missing prerequisite rather than silently omitting them and letting the model invent an inability.

For “Add Linear”: inspect existing integrations → search official/credible MCP/API/CLI candidates → check maintenance, license, dependency footprint, requested access and exact version → present install scope → use existing authorization → secure credential input → sandboxed contract/connection test → activate. LLM-generated code is reviewed software, not “learned behavior.” Installation scripts are code execution and must pass the same boundary.

Contributor structure should include concise AGENTS.md, ARCHITECTURE.md, SECURITY.md, schema contracts, ownership map, a working extension example and contract tests. Keep platform-specific details in adapters. Contract-version compatibility should be checked before activation; a malformed extension fails locally without taking down the gateway.

Capability acquisition follows the owner's sequence: understand goal → inspect configured tools/skills/delegates → research existing tools/MCPs/libraries/services → evaluate maintenance, license, authorization and fit → reuse/integrate → code only if necessary. Discovery is read-only until an installation or new effect has appropriate authority. Offer a useful partial result while a credential or integration is pending. CLI/SSH masked input or provider authorization handles secrets; do not request chat-pasted keys or invent a temporary web page. [L16]

## 18. Security Analysis

**Closure update:** OS-first restrictions are selected; the Landlock/Rust spike proved only a Linux child filesystem boundary. The active broad-access interpretation, destructive approval, network/secret requirements and dual-platform release gates are in PRD §6. Historical recommendations below are not silently treated as owner approvals.

### Threat model

Protect files, credentials, conversations, behavioral history, grants, schedules, artifacts and provider spend against: malicious external content; malicious or compromised extensions/MCP servers; compromised dependencies; unintended cross-channel users; confused-deputy requests; model mistakes; and accidents in updates or migration. A compromised host kernel/root account is outside the proposed v1 protection boundary. The trusted computing base must be named, not called “secure” as a whole.

| Attack | Concrete route | Required response / residual risk |
|---|---|---|
| Prompt injection | Repository README or web page tells agent to upload secrets | Treat source as data; tool/grant checks plus OS isolation and egress limits; model filtering alone insufficient |
| Policy bypass | Shell edits behavior DB, startup files or broker configuration | Control state/release/config not writable or visible to executor; authenticated mutation API |
| Credential theft | Generic child receives all service environment variables | Minimal environment; service-specific injection at approved destination; never hand generic shell the vault |
| Same-user escape | `/proc`, inherited FDs, Unix sockets, SSH agent, Docker socket | Isolate process view, descriptors and sockets; no container-engine socket; test actual host restrictions |
| Filesystem race | Allowed path becomes symlink to denied target | Enforce at OS boundary; race-aware file handles for broker operations; no regex path policy |
| Network escape | Redirect/DNS rebinding to metadata or localhost; allowed SaaS used for exfiltration | Validate redirects/address resolution, deny internal ranges by default, restrict credential destinations; allowed endpoints still carry risk |
| Approval confusion | Stale button, wrong member, changed artifact after approval | Bind actor, resource/plan digest, revision, expiry and one-time consumption |
| Extension supply chain | Install hook or update expands host/network access | Pin artifacts, stage outside control state, compare grants, test before activation |
| Resource denial | Huge search/output, fork storm, hung delegate | Process/resource/output/time bounds, backpressure and cancellation |
| Recovery duplication | Crash after external acceptance before local receipt | Unknown outcome + reconciliation/idempotency support; no blind retry |

### Broad defaults verdict

**RECOMMENDATION, not owner approval: narrow machine-wide filesystem access by default.** Provide shell immediately inside a selected agent workspace, plus explicitly chosen project mounts. Make broad host access an advanced, clearly stated trust mode, ideally on a disposable dedicated machine. Reading can be consequential: broad read plus allowed outbound messaging can leak data without deleting anything.

An arbitrary command cannot reliably be classified as harmless by its spelling. A Python program, shell expansion, Git hook, compiler plugin or test script can perform destructive work. Keep a small effect model: read, reversible local write, external effect, destructive/privileged/unknown. Classification assists UX; grants and isolation enforce bounds. For arbitrary writable shell, promise containment and review—not perfect interception of every destructive operation inside its writable scope. D1 must decide this honesty boundary.

### Secure secret UX without a general web UI

Use a CLI masked prompt on the machine/SSH terminal that stores via an established OS store or vault and returns only a secret reference plus connection-test result. Prefer official OAuth/device authorization when a service supports it. Discord/Telegram can send the instruction and a request ID, never request a key in ordinary chat, bot modal, or message attachment. “Ephemeral” platform messages are not equivalent to bypassing the platform or LLM.

D3 is resolved: use CLI/SSH masked input or provider OAuth/device auth, with no assumed secret-entry page. For an API-key-only service, explain the required terminal step; phone-only completion is not a launch promise. Masking prevents display, not process compromise; avoid shell arguments/history and raw keys in model context. [L16]

For Linux desktop key storage, the freedesktop Secret Service API provides existing collections, secret items, sessions and lock/unlock prompts. It is a candidate interface, not proof that a headless VPS has an available unlocked backend. Test availability and unattended restart before selecting it; retain an external vault option instead of implementing a new key store. [S37]

At-rest encryption protects offline storage only if the key is separate. An always-on headless host must either recover the key automatically from an OS/hardware/external trust source or wait for manual unlock. A key next to an encrypted DB does not protect against a compromised agent UID. Do not write custom cryptography. Keep logs metadata-first, redact before serialization/export, disable secret-bearing crash payloads, and keep raw artifacts access-controlled. Remote model providers, transports and optional memory providers each receive different data; onboarding must explain these boundaries. [S23]

### Open-source security process

Require locked dependencies, minimal install scripts, security CODEOWNERS for policy/runner/installer, dependency and secret scans, SAST, SBOM, signed provenance/releases, isolated unprivileged CI for untrusted contributions, and regression fixtures for bypass attempts. Rust modules should prohibit unsafe code unless a documented narrowly reviewed exception is needed; use cargo auditing if Rust is adopted.

Capability-manifest diffs can reliably flag declared expansions such as wildcard network or process execution. Static checks can additionally flag new spawn/network/secret APIs and changes to enforcement modules. **CI cannot prove the absence of undeclared privilege expansion in arbitrary code.** Make capability manifests executable constraints and retain human security review. A green scanner is not authorization.

Backups should encrypt a consistent snapshot including behavior, schedules and artifact manifest; keys are separately recoverable. File unlink is not guaranteed secure erasure on SSDs/snapshots/backups. Retention and remote deletion policies must address replicated copies; do not promise universal secure deletion.

### Broad access remains an explicit unresolved guarantee tradeoff

**Owner preference retained:** broad shell/filesystem by default, destructive approval and reusable explicit grants. **Technical conflict:** unrestricted writes can truncate or corrupt a file without deletion; broad readable home access plus network can leak secrets without a destructive command. A deny regex, approval prompt, backup or same-user broker cannot guarantee interception of all such effects. Extra complexity helps only when it removes bypass authority.

Recommended compromise for E2, not an accepted replacement default: broad useful discovery through mediated reads excluding credentials/control state, ordinary writes in granted project workspaces, and reviewed promotion for host/external changes. This sacrifices literal machine-wide default access. Alternative: broad access inside a dedicated disposable host/VM, with an explicit trust boundary. If choosing broad access to the personal host, label destructive detection advisory inside that writable scope; this cannot honestly retain an absolute destructive-approval guarantee. D1 needs the owner's choice after evidence.

### Linux + macOS enforcement and credentials

Linux candidates include native bubblewrap plus appropriate namespace/process/network policy or a Landlock-based runner. macOS requires a separate backend: nono documents Seatbelt support; treat it as an E2 candidate, not audited parity or a performance result. Required rights must be probed and a missing boundary must block protected execution rather than silently weaken it. [L14; S8, S9, S42]

macOS privacy permissions, including Files and Folders/Full Disk Access, are separate from the product's action grants; granting OS access must not grant the model blanket authority. Prefer narrowly requested permissions, and test access from launchd rather than assuming terminal access transfers. Use an existing Keychain client on macOS and a supported Secret Service/vault backend on Linux; headless availability, locked keychains and unattended boot remain D4/E2/E8. No fresh macOS host was available in this investigation. [S37, S43, S45]

Keep the trusted control state's files, service credentials and process-control endpoints outside worker authority on both platforms. The trusted runtime and in-process plugins remain part of the TCB. Unix sockets only transport requests; peer identity, capability validation and OS restrictions create the boundary. Containers with broad writable host mounts do not solve D1.

## 19. Rust Guardian Evaluation

**Historical pre-spike analysis retained for provenance.** Architecture choices and readiness language in this section are superseded by section 38 and PRD.md; factual source observations and confirmed owner input remain evidence.

**Verdict: MODIFY the boundary concept; REJECT a large mandatory custom Guardian for v1. NEEDS EXPERIMENT for the execution backend.**

Rust reduces some memory-corruption hazards. It does not decide whether a model's request is authorized, stop TypeScript from opening a file directly, or isolate a child that inherits ambient privileges. A library call or Unix socket adds no restriction unless bypass routes are removed.

| Alternative | Value | Limitation / recommendation |
|---|---|---|
| Rust library inside runtime | Memory-safe implementation of that library | No independent privilege boundary; reject as security claim |
| Separate restricted process + IPC | Fault containment, small API, peer authentication | Same-UID unrestricted processes can still bypass; pair with OS constraints |
| bubblewrap / namespaces / seccomp | Existing Linux containment | Policy composition and kernel support need testing; seccomp is not semantic authorization [S8, S9] |
| Landlock | Kernel-enforced reduction of filesystem/network rights | ABI-dependent coverage; no silent weakening when required features absent [S8] |
| nono | Rust-based existing agent sandbox with OS enforcement direction | Pre-1.0 APIs; evaluate before writing equivalent code [S11] |
| OpenShell | Existing policy-controlled executor with endpoint-bound credential model | More moving parts; installation and actual boundary need a spike [S12] |
| Containers | Familiar process/filesystem isolation | Shared kernel, unsafe mounts/sockets and broad network can defeat intended protection |
| gVisor / microVM | Stronger separation for hostile execution | More overhead/compatibility work; use when threat model justifies it [S9] |
| WASM / Monty-style constrained interpreter | Narrow programmable transformations | Does not run arbitrary native tools or full Python ecosystem [S28] |
| OS vault | Reduces direct secret storage burden | Runner can still leak secrets it legitimately receives; scope injection |

Recommended shape: a trusted control service owns policy/state, dispatches through a proven restricted executor, and uses a small credential/destination adapter. The LLM never chooses the sandbox strength or mintable grant. If a Rust broker is eventually necessary, limit it to validated dispatch, scoped file/process operations, resource bounds and authenticated capability use. Do not put semantic memory, skills, prompts, scheduling or provider routing in it.

Threat boundary proof must include the control process too. If the orchestrator is unrestricted, a compromised in-process dependency can bypass the executor. Either include the orchestrator/dependencies explicitly in the trusted base or isolate it from host files and secret material. The product must state which threat it mitigates: untrusted tool code is not the same as a compromised control-plane dependency.

## 20. Reliability Model

Adopt a durable inbox/run/action/outbox pattern rather than attempting arbitrary distributed exactly-once execution. A transport message ID deduplicates inbound events; a per-conversation lease serializes turns. Global behavior edits additionally use revision checks. Bounded queues and quotas protect unrelated conversations from an expensive search or delegate.

For each action persist intent and authorization revision before dispatch. Record acknowledged success, acknowledged failure or unknown outcome afterward. A provider's idempotency key is used where supported; otherwise inspect external state before retry. A crash after an external effect but before receipt cannot be solved by a local SQL transaction alone.

Execution success, verification success and notification delivery are separate fields. Persist an outbox before attempting delivery; maintain per-destination receipt, attempts and next retry. If an API acknowledgement is lost, duplicates may still occur. Mark uncertainty honestly and use platform-specific reconciliation when possible. Do not advertise universal exactly-once messaging.

For recurring jobs: persist an occurrence key based on schedule ID/revision and scheduled instant; use IANA timezone and an explicit daylight-saving/misfire policy; disallow overlapping mutations of one workspace. Default missed observational checks to one coalesced current run, confirmed in D8. Keep delivery retries independent of re-running expensive analysis. A pause revokes pending dispatches; an old worker needs fencing so it cannot write after lease replacement.

Typed errors should include category, retryable flag, operation ID, partial-effect/unknown-effect status, safe next action and redacted detail. Categories: invalid input, permission/approval, unavailable dependency, rate limit, timeout, provider failure, delegate failure, transport failure, insufficient evidence, and internal invariant failure. A finite recovery policy handles known transient faults; model judgment selects among safe alternatives. “I don't know” and blocked are valid terminal outcomes when evidence remains missing.

E3 compares a narrow SQLite job ledger against DBOS; Temporal is a later alternative if workflows truly demand it. Do not build replay of arbitrary application code. OS timers are acceptable wake-up sources, but lack the product's complete action, authorization and delivery history on their own. [S17, S18]

## 21. Token / Context Efficiency

**Final spike evidence:** native proposal adapter 29 LOC; one call each; full action median 16.56 ms versus 185.71 ms via Nanobot; request 521 versus 23,147 bytes on the shared fixture. Necessary-only native context/schema construction is selected, while provider-required replay, quality and exact usage attribution remain mandatory. These are narrow scripted results, not production benchmarks. See section 38.

### Observed cost shape

Read-only aggregate from `/home/david/.nanobot/llm_usage.sqlite3`; sampled stored records span epoch milliseconds `1788894996379`–`1789086096818`. This is a short, changing production window, not a normalized comparison. [L10]

| Source | Calls | Recorded input | Recorded output | Recorded cache-read |
|---|---:|---:|---:|---:|
| User | 139 | 4,460,093 | 45,578 | 3,853,824 |
| Cron | 194 | 3,927,185 | 48,299 | 3,117,056 |
| Dream | 115 | 2,107,268 | 41,089 | 612,864 |
| Total | 448 | 10,494,546 | 134,966 | 7,583,744 |

All grouped `estimated_tokens` sums were zero and records carried reported-token counts. This does not prove provider adapters use identical definitions or establish billed dollars. Cache-read counts are reported separately; do not add them to input or treat all input as full-price. Dream represents about 20.1% of recorded input and 25.7% of calls. Quiet work can still be costly.

Historical bakeoff notes reported an 11,201-input-token Hermes ping, 20,248-input-token OpenClaw first ping, and substantially larger shared-thread totals. Nanobot lacked provider usage in that CLI output. Those notes support investigating context overhead, **not** a fair cost ranking: models, cache state, harnesses, sessions and measurement methods differed. [L7]

### Proposed context construction

1. Fixed compact core instructions and stable tool index form a cacheable prefix.
2. Resolve identity/project and load **all applicable mandatory operational rules** through exact queries. Never rely solely on embeddings for permissions or explicit prohibitions.
3. Add current task goal, done conditions, checkpoint and a bounded recent conversation tail.
4. Retrieve source-linked semantic context only when relevant; load a chosen skill in full, references as needed.
5. Discover capabilities from a concise index; load selected schemas without rewriting earlier history unnecessarily.
6. Keep bulk tool outputs in artifacts; return bounded summaries plus source offsets, counts, truncation markers and recovery handles.
7. Compact older conversational material while retaining original evidence and a way to retrieve it. Compaction does not mutate operational rules.

A changed explicit rule must take effect on the next governed action even if a session prefix is cached. Append a small versioned delta or rotate the context boundary when necessary, and re-resolve policy before execution. Cache savings are subordinate to correct revocation. Model/provider caching is adapter-specific; preserve provider options instead of flattening them away. [L9; S24, S25]

### Intelligence per token

Measure successful acceptance scenarios per total spend, corrected-error recurrence, mandatory-rule recall, clarification appropriateness, cache hit, output usefulness and latency. Include summarization, retrieval, skill generation, background reflection, failed attempts and delegates. Monetary totals need provider prices/usage and explicit “unknown” fields where not available; no current price assumptions are made here.

V1: context manifests listing rule/skill/source IDs and token allocation; bounded output; lazy schemas; scoped retrieval; cached stable prefix; checkpoint recovery; usage accounting; bounded background work. Later: automatic model routing, sophisticated vector reranking, procedural optimization, cross-agent caching, large-scale semantic consolidation.

Model setup retains primary and fallback. Fallback must satisfy required tool/context/output features and allowed data destination; switching provider may be a privacy change. Never silently buy a more expensive tier. Advanced budgets stay out of onboarding, but internal finite iteration/time/output limits are still necessary. Reserve budget before concurrent work where a hard configured limit exists; reconcile actual usage afterward. Delegate billing may be separately unknown and must be displayed as such.

Subagents should receive a narrow brief and artifact references, not the entire parent history. Share one root budget/cancellation tree, cap depth and fan-out, and aggregate evidence rather than trusting votes. Defer parallel helper execution until it demonstrably improves outcomes over one agent.

### Latency and efficiency: measured limits, not a line-count explanation

A second read-only aggregation uses the same frozen 448-call window as L10. `duration_ms` per-call median / empirical p95: user **6,750 / 19,514 ms** (139 calls), cron **5,843 / 16,864 ms** (194), dream **8,613 / 18,037 ms** (115). P95 is the sorted observation at floor(0.95 × (n−1)). There were no positive recorded `ttft_ms` or `generation_ms` samples. These are model-call durations, not complete task latency, and do not prove Nanobot faster than Hermes. [L15]

Source-supported efficiency candidates are scoped context providers, skill summary/on-demand content, installed opt-in skill filtering, schema caching/stable ordering, provider prompt caching, and safe tool concurrency. Hypotheses to measure include oversized always-loaded context, growing skill catalogues, plugin fingerprint I/O, sequential cron blocking, gateway tool blocking, and background dream frequency. Keep provider/model/network/workload constant before attributing gains to the runtime. [L14]

E6 separates queue wait, context assembly, provider TTFT/generation, tool time, delegate startup, and delivery time; records cold/warm cache input/output/cache tokens plus supported monetary rates; and measures complete user tasks and daily background totals. Use ablations of context, skill catalogue size, compaction and background learning. Optimize successful useful outcomes per token and latency, with correction retention as a non-regression gate. Do not force cheap-model routing to make a runtime benchmark look better.

## 22. Transport Model

Store a transport-neutral conversation ID with owner, optional project, and a transport binding. Discord binding includes guild/channel/thread and origin-message ID; Telegram includes chat/topic and sender identity. Immutable IDs, not names, identify resources. Cross-channel identity linking must be explicit: a short-lived nonce initiated from the trusted CLI and proved on each account, with no automatic merge by display name. Shared identity need not mean shared conversation history. D5 confirms explicit linking/shared personal memory and separate histories; shared-channel disclosure and authority remain open.

Discord input in an existing thread stays there. A parent-channel request follows the owner-approved threading policy before model execution. If thread creation/access fails, report route failure through an authorized path; never silently leak a reply to another channel. Archived/deleted thread handling needs a tested policy. Discord has distinct thread permissions; a bot able to send to a parent may still be unable to send in threads. [S29]

Telegram adapters should persist update identifiers and topic routing, render entities/escaping themselves, obey API rate-limit feedback, and validate approval callbacks against sender and request. Delivery returns platform receipts, not just queue admission. [S30]

Use a small message representation: text blocks, paragraphs, lists, code, links, artifact references, progress and action requests. Render platform limits/escaping/chunking in adapters. Avoid building a rich-document framework or exposing traces, token counters and tool spam by default. Redact diagnostics before optional CLI/chat inspection.

## 23. Onboarding & Calibration

Recommended wizard: explain/verify platform and access → secure provider setup → primary and fallback models → one transport → real conversation → optional delegate/Honcho configuration → proactively offer optional calibration. Exact optional-step ordering is an E8 UX hypothesis. Explain what each choice means, the broad-access tradeoff, and that cheaper/stronger routing can be configured later.

Hermes setup is the strongest local UX reference: shared model/provider flow, hidden credential entry, navigation and quick setup. Current Nanobot also distinguishes headless/SSH terminal setup from a richer desktop path. OpenCode's documented provider configuration and Grok's device-auth route are useful references; none removes the Discord bot creation/permission burden. [L9; S2, S6, S26]

Target—not measured promise: an experienced self-hoster with credentials ready should reach chat within roughly 5–10 minutes. First-time provider signup or Discord developer setup may take longer. Validate user understanding and setup duration in E8, rather than claiming “minutes” from installation speed alone.

First-run success test: send a user-originated message through the selected transport, persist its correct conversation binding, produce one response, save a harmless project preference, and read it back in a fresh conversation. Provider connectivity alone is not onboarding success. No discovery test messages were sent.

Proactively offer optional guided questions, a real first task, an imported LLM summary, or any combination. Teach early: “Tell me how you want me to work; I can remember that at the right scope.” For import, offer a prompt asking another LLM to summarize goals, preferences, projects and recurring tasks while excluding secrets; imported text is untrusted context, not a grant. Explain the understood goals/preferences in ordinary language and allow correction/removal. Calibration cannot silently grant recurring execution, import secrets, or activate old jobs.

CLI recovery commands should expose health, active run, permission/access summary, learned changes, jobs, integrations, config and update status. Use the same core APIs as chat; the CLI is also the recovery path when both transports fail.

## 24. Update / Compatibility Model

**Final contract:** releases start at v0.1.0 using SemVer. PRD §10 makes state/config preservation mandatory across pre-1.0 and later upgrades, with independent schema/adapter versions, signed artifacts, staged migrations, fenced writers and revocation-safe rollback. Earlier language treating Bun as only a candidate or recommending native Nanobot installers is superseded: adapt useful installer patterns to owned Bun packaging.

Keep immutable release directories, private user-state directory, extension versions and external credentials separate. Never use the release checkout as the live editable workspace. Record runtime version, dependency lock digest, extension versions, schema version and active capability grants.

Update sequence: fetch authenticated release metadata → verify artifact → check OS/schema/extension compatibility → produce consistent private snapshot → stage/migrate a copy → run deterministic contract suite and health checks → stop/drain or fence old workers → activate → verify → retain previous release and restore instructions. No production update was attempted here.

A binary rollback is unsafe if state has undergone an incompatible migration. Either maintain a documented backwards-compatible migration window or restore a matched snapshot while reconciling external side effects and outbox deliveries since that snapshot. Restoring old grants/jobs must not resurrect revoked authority or replay sent work. This is an important E5 test.

Checksums detect changed bytes but do not independently authenticate the publisher when fetched from the same compromised source. Use signed releases and a pinned verification root; evaluate TUF for rollback/freeze and key-rotation protection when update distribution warrants it. [S31]

Bun can produce a standalone executable; native dependencies and runtime assets still require platform testing. TypeScript has no runtime type safety without validation. Elysia is a capable HTTP framework but no core HTTP application is established by a Discord gateway plus Telegram polling; use it only if a real callback/health/API surface justifies it. Bun stays a candidate subject to SDK/process compatibility tests; Node or a retained Python runtime are acceptable outcomes. [S32–S34]

Backup/restore should offer one export command and one restore command with manifest validation, encryption, separate recovery-key guidance, and a dry-run compatibility report. Use SQLite's supported snapshot/backup mechanism, not a casual copy of only a live `.db` file while WAL is active. Wrap restic for encrypted storage where appropriate. [S35, S36]

### Day-one platform support changes packaging requirements

Nanobot already documents systemd user units and a macOS LaunchAgent using the selected Python executable. Reuse those installers through supported interfaces, pin release/interpreter paths, and check one active worker. A LaunchAgent starts in a user login session; it does not establish pre-login or sleeping-laptop execution. NEW D13 defines the availability promise. [L14; S44]

E5 must cover Linux and macOS fresh install, upgrade, uninstall without losing data, and restore. Publish minimum OS/kernel, architecture and backend capabilities only after validation (D2). Include macOS quarantine/signing behavior, permissions, executable paths, case-sensitive/insensitive filesystems and sleep/wake; include Linux user-service/lingering and headless secret availability. Do not substitute “Linux first” or require a general web UI. No new packaging implementation has been made.

## 25. Preliminary State Ownership Matrix

| State | Canonical owner | Derived copies / update behavior |
|---|---|---|
| Installation/provider configuration | Validated local config service | CLI/chat projections only; secrets are references |
| Identity/channel links | Local identity registry | Adapter cache; explicit linking/revocation |
| Project identity and aliases | Local project registry | Repository path is an attribute, not whole identity |
| Explicit instructions | Local behavior records | Prompt projections, remote memory copies advisory |
| Permissions and recurring grants | Local authorization records | Executor receives constrained grant; cannot edit canonical store |
| Skills/procedures | Registry and versioned content | Rendered Markdown/index rebuildable |
| Semantic notes/transcripts | Local source records subject to retention | Remote memory and search indexes optional derived systems |
| Task progress/actions | Durable run/action ledger | Model summary/plan is a projection |
| Jobs/occurrences | Durable schedule/occurrence store | OS timer is wake-up mechanism only |
| Delivery | Durable per-destination outbox/receipts | Chat message is external result, not sole audit source |
| Delegate session | Delegate owns execution details; core owns handle/contract/result | No assumption of cross-provider session portability |
| Secrets | OS/vault backend | Restricted ephemeral injection; no prompt copy |
| Usage | Local normalized ledger plus raw provider fields | Billing totals explicitly incomplete when usage absent |
| Release/extension artifacts | Immutable signed version stores | State migration never overwrites user content as a template |
| Backups | Encrypted consistent snapshot + manifest | Separate key; restore validates grants/outbox freshness |

## 26. Preliminary Trust Boundary

```text
Authenticated owner through CLI / Discord / Telegram
                      |
            Trusted control service
     identity · behavior · grants · jobs · audit
                      |
          Model proposes an action (untrusted judgment)
                      |
       Deterministic validation and grant resolution
                      |
       Existing restricted executor / scoped broker
          |              |                  |
      project files   tool processes    endpoint-bound API access
          |              |                  |
       bounded artifacts/results and external receipts
                      |
           durable state + transport outbox
```

Untrusted web/repository/tool text does not enter the owner-authorization channel. The execution process cannot access the control DB, release files, vault or control socket except through narrowly authenticated operations it is explicitly allowed to invoke. The trusted service can still be compromised; OS separation and a small dependency footprint reduce but do not eliminate that risk.

## 27. Preliminary Component Map

**Historical pre-spike analysis retained for provenance.** Architecture choices and readiness language in this section are superseded by section 38 and PRD.md; factual source observations and confirmed owner input remain evidence.

Recommended logical modules: **control/state**, **context/behavior**, **execution/adapters**, **transports**, **operations**. These need not be five services. Begin with one trusted service and independently restricted tool/delegate processes; add a broker process only for an actual privilege distinction.

Prefer SQLite for local durable state unless E3 demonstrates an adequate embedded alternative or a clear need for Postgres-backed workflows. Reuse one model library. Keep capability integrations outside core. Dependencies must point toward small schema/contracts; an integration should not import scheduler internals or mutate another adapter's private classes.

### E1 architecture alternatives A/B/C/D

| Shape | Ownership and reused machinery | Current assessment / evidence gate |
|---|---|---|
| **A — Nanobot-centered** | Nanobot/Python orchestrates; our authoritative behavior/authorization/state layer gates execution; retain native capabilities through public SDK/extension boundaries | FIRST candidate. Existing SDK, external session store and integrations support reuse. Hook/tool/entry-point, context and background gaps must meet G1–G8; no private patch escape hatch |
| **B — small Bun/TypeScript control core** | Our control layer owns behavior, grants, run/action/job control state and capability/delegate registry; existing Python runtimes and other tools perform capability work over supported boundaries | Serious alternative when ownership is materially cleaner. Do not rewrite Nanobot browser/search/transports/provider implementations in TS. Prove that hosted capabilities cannot bypass control, and avoid two job authorities |
| **C — narrow Rust enforcement component** | A or B control plane → small broker/runner → existing OS sandbox/resource/secret facilities | An optional execution component, not a rival whole-product runtime. E2 must name a property existing maintained components cannot cleanly enforce and show a smaller maintainable solution. No memory, prompts, skills, scheduling, model routing or behavior in Rust |
| **D — another existing runtime/composition** | Existing maintained runtime or clean composition provides the mechanics; our small semantics layer retains authority | Evaluate if A fails and B recreates substantial existing machinery. Hermes supported seams are a candidate, not mandatory wholesale adoption |

Bun/TypeScript is not rejected, Python is not selected by inheritance, and Rust is neither required nor prohibited. Elysia appears only if a real HTTP/control surface is needed. E1 compares A/B/D using the same correction→governed execution→restart slice and capability contracts; C is assessed in E2 and can accompany any control plane. Source diagrams indicate responsibility, not proof of isolation.

### Exact Nanobot GO / NO-GO criteria

All eight are required for **GO as the selected foundation**. E1 records PASS / FAIL / NOT PROVEN against a pinned release, linked public API documentation and reproducible disposable fixtures. NOT PROVEN is not a pass. E1 may yield a conditional candidate while E2/E5/E6 supply supporting evidence; it cannot declare production security or a launch release ready.

| Gate | GO evidence | NO-GO / escalation trigger |
|---|---|---|
| G1 — Complete mediation | Matrix covers chat, ordinary and ephemeral turns, cron/heartbeat, SDK/direct calls, MCP, shell and delegates. Every fixture rejects denied/revoked dispatch before effect, including hook factory/handler failures and direct hidden-tool invocation | Any required reachable path bypasses authorization or relies on fail-open hooks with no supported interception/disable-and-replace boundary |
| G2 — Immediate authoritative correction | Successful commit precedes acknowledgement; next eligible action uses the committed revision without restart; restart retains it; concurrent stale edits rejected; free prose and exact enforceable selectors distinguished | Canonical behavior must be duplicated into natural-language runtime memory as a second authority, or live correction depends on cached prompt refresh/model compliance for typed selection |
| G3 — Deterministic routing and selection | Native/public adapter boundary preserves origin/thread/topic and authenticated actor across retry/restart; sole configured delegate and explicit fallback obey project scope | Essential behavior requires private handler mutation or LLM-selected destination/delegate outside configuration |
| G4 — Protected state and scoped execution | Worker cannot read/write denied control/secret/session data; scoped read/write/delete tests pass; all child environments follow grants; E2 validates both OSes | File relocation alone is the claimed boundary, or shared ambient authority cannot be removed through supported composition |
| G5 — Owned background lifecycle | Each admitted run/child/process has durable ownership and terminal/recoverable unknown state; missing input suspends continuation; parent cannot certify unfinished required children; shutdown/reconnect releases owned resources | Orphaned work/unobserved failure, duplicate writers or undeliverable detached tasks are unavoidable on required entry paths |
| G6 — Context and efficiency seams | A40/A41/A45/A46 pass without replacing major internals; provider-required replay preserved; configured schema/byte limits enforced; E6 shows quality and measured budget compliance | Required controls need wholesale context/runner replacement, silent capability loss, cursor data loss or unbounded replay |
| G7 — Upgrade-maintainable integration | Same public extension package works across two selected upstream releases, or changes only through a documented public migration; E5 preserves rules/grants/receipts; no `.pth`, private methods or maintained source patch stack | Essential upgrade needs invasive reconciliation, undocumented imports or repeated monkey-patching |
| G8 — Clean capability/error contract | Reused browser/search/HTTP/MCP/files/jobs/delegates expose dispatch/result/error/cancel/usage availability needed by I1–I10; timeout/quota/auth/invalid-request cases remain failures, with bounded configured fallback | Essential errors become ordinary output/success, or safe reuse requires recreating capability engines |

For deterministic fixtures, GO means **zero observed invariant violations in every enumerated test**, not an empirical claim of universal safety. Pre-register the fixture matrix and test versions before execution. Proposed E1/E6 comparison gate (engineering hypothesis, not D10 launch approval): same model/provider/tasks and cache conditions; all mandatory tool-recall cases recoverable via discovery; behavior layer ≤10% added model tokens and ≤20% added p95 end-to-end latency on matched successful baseline tasks, with at least 20 repeated observations per timing case. Report confidence/range and cold/warm results; insufficient evidence remains NOT PROVEN. If retained capabilities cannot satisfy these provisional budgets, report the measured tradeoff for review rather than removing them or changing models to manufacture a win.

A Nanobot NO-GO means evaluate B/D; it is not project failure and does not automatically justify C. An upstream public seam contribution may reopen a failed gate only once supported and tested; an unmerged private patch does not count as a GO. No architecture implementation or E1 prototype was created in this bounded pass.

## 28. Product Acceptance Scenarios

These are **proposed tests, not passed tests**. D10 confirms the three outcomes; quantitative thresholds still need approval. Deterministic tests assert state/effects; model tests score interpretation separately. Use synthetic fixtures, fake provider failures, temporary workspaces and isolated transport accounts in future testing. Never run destructive cases on david.

| ID | Scenario | Observable pass condition |
|---|---|---|
| A01 | Teach “Rocket changes use Codex” | One active project instruction with source; next eligible action uses configured Codex |
| A02 | New conversation after correction | Same scoped instruction applies without copying previous transcript |
| A03 | Restart after correction | Durable instruction remains; acknowledgement was only emitted after commit |
| A04 | Upgrade after correction | Rule identity, scope and behavior preserved by compatibility test |
| A05 | “Use Grok only this time” | One run override; later Rocket work returns to Codex |
| A06 | Two projects, different delegates | Correct project resolution; no global preference contamination |
| A07 | Ambiguous durable correction | Clarifies scope before a materially different permanent change |
| A08 | Quoted malicious instruction | No behavior/grant mutation; source remains untrusted data |
| A09 | “Why did you choose that?” | Cites rule/source/revision and run selection, no fabricated reasoning |
| A10 | Undo one behavior | Compensating revision restores that behavior only; unrelated state unchanged |
| A11 | Concurrent conflicting edits, including two processes | Stale writer rejected; one proven session/workspace writer; expired owner fenced before successor writes; no fail-open concurrent mutation (I4, Hermes #67442) |
| A12 | Approved morning review | One schedule and bounded grant; next run proceeds without redundant approval |
| A13 | Recurrence exceeds scope | Write/deploy action blocked pending specific expanded authorization |
| A14 | Stop current autonomous work | Cancels children; pauses identified routine; no later side effects after revocation gate |
| A15 | Unchanged heartbeat | No user notification; run and costs still recorded |
| A16 | Meaningful changed result | One intended destination outbox record; independent transport outcome |
| A17 | Discord existing/new thread | Response bound to correct thread; restart preserves binding; no parent fallback leak |
| A18 | Telegram duplicate update/topic | One run for duplicate ID; response and approval remain in correct topic |
| A19 | Transport or final-response failure after successful tool | Executed/verified receipt retained; delivery remains pending/failed; retry does not repeat effect; presentation failure cannot change action truth (I9, Codex #44408) |
| A20 | Lost external acknowledgement | State becomes unknown; no false success or blind duplicate side effect |
| A21 | Crash during job | Recover checkpoint/occurrence; already acknowledged actions not repeated |
| A22 | Typed provider timeout/quota/auth/invalid request | Error cannot become successful model output or cron completion; bounded eligible retries/configured fallback; no unapproved data destination; unknown effects reconciled (I9, Nanobot #5674) |
| A23 | Delegate partially edits then fails | Reconcile/resume or fenced fallback; no concurrent writers or lost artifacts |
| A24 | Delegate claims success without artifact/test | Run remains unverified/blocked, not completed |
| A25 | Credential connection | Value absent from model payload/logs/skills; reference stored; connection separately verified |
| A26 | Malicious extension attempts escape | Denied host files/sockets/network/state remain inaccessible in real sandbox |
| A27 | Repeated similar procedure | Existing skill evolves or is reused; no duplicate active concept |
| A28 | New skill version regresses | Previous version remains recoverable; pinned recurrence unaffected until activation |
| A29 | Honcho unavailable/disabled | Operational rules, local memory, jobs and conversation still function |
| A30 | Compaction after correction | Rule and goal retained through canonical state; original evidence recoverable |
| A31 | Restore to new machine | State/skills load; credentials reconnected; jobs paused until destinations/grants revalidated |
| A32 | Limited budget / excessive output | Dispatch limits honored across helpers; bounded output with recovery pointer; truthful partial result |

Suggested initial thresholds for review: 100% deterministic authorization/routing/migration fixtures; zero silent grant expansions in adversarial suite; at least 95% correct explicit correction/scope behavior on a held-out model fixture set; report confidence intervals and error classes, not a single “intelligence” score. These are launch hypotheses, not universal reliability promises. Test across supported provider/model configurations and repeats; do not hide stochastic failures behind one lucky run.

Additional proposed acceptance cases from confirmed input (none executed):

| ID | Scenario | Observable acceptance |
|---|---|---|
| A33 | Linux/macOS install, interrupted config write, update and restart | Durable valid old/new state or recoverable failure; effective OS permissions/current grant revision checked before execution; explicit reauthorization if needed; no silent downgrade (I10, Codex #26421/#28574, Hermes #52010) |
| A34 | Optional calibration modes combined or skipped | First use works without calibration; import cannot grant actions; user sees/corrects what persisted |
| A35 | Missing capability and API-key-only integration | Inspect/research reuse first; useful partial output; CLI/OAuth credential path; no raw key in conversation |
| A36 | Global pause during cron/delegate activity | Scope follows D14; durable pause blocks next dispatch; in-flight/unknown effects explained; explicit resume |
| A37 | One configured delegate, then configured fallback | Sole choice honored; no built-in vendor preference; fallback waits for stop/fencing; explains selection |
| A38 | Meaningful correction vs ordinary conversation | Only durable behavior/permission changes enter version history; specific undo preserves unrelated rules |

A01–A32 remain applicable; any access-profile fixture tests the declared D1 profile, not an implicitly approved workspace default. Compare the same correction → new conversation → restart → upgrade chain on both operating systems.

Issue-derived additions are limited to missing tests, not feature expansion. A11/A19/A22/A33 above are strengthened; A27 already covers duplicate skills and is retained.

| ID | Added scenario | Observable acceptance and evidence |
|---|---|---|
| A39 | False deterministic condition; then a task waiting for input | Zero LLM requests while false/waiting; approved matching signal wakes once; bounded no-progress retries and restart-safe dedupe. Nanobot #5510/#5256, I5 |
| A40 | Long session with constant contract, fresh time and turn-only context | Contract stored once; expired rider absent from subsequent effective input; provider-state resume and stateless rebuild are semantically consistent; required unfinished-loop reasoning retained. Nanobot #5586/#5584, Hermes #10421, I6 |
| A41 | Large MCP/skill registry; required tool initially omitted | Only selected schemas within configured budget; discovery can recover every seeded necessary tool; direct ungranted calls remain blocked; no full-registry budget bypass. Nanobot #5298, Hermes #4379, I8 |
| A42 | Background exception/required child outlives parent; repeated MCP reconnect with live parent | Durable failure/unknown and parent ownership survive; no parent success before required aggregation; owned MCP instances are reused/disposed within declared bounds; recovery control remains responsive. Nanobot #5429/#4290, Codex #38754/#44401, I3 |
| A43 | Project A reads then replaces its scoped memory collection | Project B's unshared datum cannot be retrieved, overwritten or deleted; explicit shared datum remains available; scratch and retained deliverables differ. Hermes #34352, Nanobot #5276, I1 |
| A44 | Capability A owns a synthetic arbitrarily named credential | Unrelated shell/delegate/MCP/background/PTY and restored snapshot cannot obtain it through environment, files or handles; control-state writes denied. Hermes #82936, Nanobot #5278, I2 |
| A45 | Oversized archive batch and interrupted preservation | Unique tail marker preserved or cursor stops before it; retry has no silent hole, including oversized single message/raw fallback and crash between preservation and cursor commit. Nanobot #5377, I7 |
| A46 | Images/artifacts fit token estimate but exceed aggregate serialized budget | Pre-dispatch byte guard uses actual request representation; bounded reduction/references retain recoverable evidence; retry cannot resend oversize forever; usage estimate/report discrepancies attributed to exact request. Codex #43015, Nanobot #5402, I6 |

A40 is a desired semantic contract, not approval of open PR #5627's exact mechanism. If a provider cannot remove prior visible context, use a supported reconstruction/new-session boundary or mark the gate unproven; never pretend a local deletion erased remote continuation state. A44 tests the declared restricted execution boundary; choosing unrestricted personal-host access leaves the D1 guarantee conflict unresolved.

## 29. Implementation validation register — no architecture restart

Architecture experiments are complete for foundation selection: E1 NO-GO; B GO WITH LIMITATION; native slice NATIVE BUN CLEARLY BETTER for the tested role; Rust OPTIONAL / OS PRIMITIVES SUFFICIENT. Their bounded results do not certify release readiness.

Former E2–E8 are now implementation/release validation packages, not prerequisites to drafting the PRD or reasons to reopen the foundation choice:

| Area | Required implementation evidence |
|---|---|
| Execution/security | Real denied-resource, environment/secret, process and network tests on Linux and macOS; no silent backend fallback |
| Jobs | Durable occurrence/dedupe, coalescing, crash/unknown effects, fencing, zero-model false/wait states |
| Delegates | Two pinned initial implementations; configured selection, approvals/cancel/resume, partial edits and fenced fallback |
| Install/update | Both OSes; staged schema migration, state/config preservation, effective permissions, backup/restore and revocation/outbox recovery |
| Context/quality | Held-out correction cases, bounded lazy schemas, lifetimes/replay, archive cursor and token/byte attribution |
| Transports | Discord thread and Telegram topic/identity/approval/delivery semantics under retry/restart |
| Onboarding | Explained choices, secure credential flow, real transport reply, optional calibration and recovery understanding |

Use disposable fixtures and authorized test accounts during implementation. No additional architecture experiment is authorized or needed absent a concrete blocker; none was run during PRD closure. See PRD §§13–14 for full acceptance gates.

## 30. Initial product phase — v0.1.0 minimal build, broad capability contract

The three outcomes remain durable corrections, configured coding delegation and quiet reliable approved research. Native Bun owns authority, runtime and outcomes. Small custom infrastructure is compatible with a broad set of thin maintained integrations.

**v0.1.0 required:** Linux/macOS, owner/project/conversation identity, Discord/Telegram, explained CLI onboarding with primary/fallback models and secure credentials, native bounded model loop, durable behavior/provenance/undo/grants, local scoped memory/skills, sandboxed shell/files/artifacts, browser/web/search/HTTP, MCP, two release-conformance delegate targets, approved jobs/triggers, outbox/recovery/pause, portable backup and safe versioned upgrades. Capabilities may require explicit credentials/dependency setup; that does not move them out of release scope. PRD §§4–11 specify thin implementation bounds.

**Later without abandoning the product contract:** optional Honcho, additional named delegates/providers, advanced routing/budgets, authenticated-browser workflow depth, advanced skills, richer recurring writes, bounded helper fan-out, teams and multi-machine coordination. The earlier deferral of PRODUCT_RESEARCH.md is superseded by the final documentation addendum: [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md) now preserves the evidence/issue record.

**Excluded:** wholesale Nanobot/Hermes port or foundation, large Rust Guardian, mandatory cloud/backend/framework, generic workflow language, custom browser/vault/crypto, marketplace, uncontrolled core self-modification and autonomous financial/destructive workflows. The authoritative acceptance/milestone allocation is in PRD.md, not older speculative V1 scope.

## 31. What NOT To Build

**DO NOT BUILD YET:**

- A Rust security platform before E2 establishes a missing need.
- A new LLM provider framework, transport SDK, browser engine, MCP protocol, vault or encryption format.
- A generalized workflow engine, graph language, permission DSL or giant rule engine.
- A marketplace or universal extension installer; one reviewed capability path is sufficient.
- A vector database, knowledge graph or autonomous memory cleanup service before recall failures justify it.
- Five coding delegate adapters at once; support one fully, preserve a narrow optional-feature contract.
- A “learning” daemon continuously spending tokens without a user-approved purpose or measured benefit.
- Team permissions, multiple competing state writers, distributed schedulers, or an elaborate microservice topology.
- A full Hermes/Nanobot fork justified only by TypeScript preference.
- Domain-specific finance/research engines already owned by Rocket and other tools.
- Auto-upgrade of live mutable repositories, or rollback that treats external effects as reversible.

## 32. Top 10 Lessons From david

1. **Route identity belongs below the model.** Local Discord repairs enforce the originating thread. [L5]
2. **Queued, executed and delivered are different facts.** Delivery commits and ledger contracts make the distinction concrete. [L2, L4]
3. **A declaration is not deployment truth.** The Sep 2 audit found a stale baseline; current source/installed comparisons still differ. [L1, L8]
4. **Good architecture already exists locally.** Scoped CAS state and ownership contracts should be retained as evidence and fixtures. [L13]
5. **Private runtime hooks become upgrade obligations.** Nancy's `.pth` and class-method overlays solve real problems with fragile coupling. [L5, L6]
6. **Broad access creates resource problems as well as security problems.** The broad-search guard isolates and bounds work. [L6]
7. **Quiet autonomy still spends tokens.** Cron/dream exceed user-input volume in the sampled usage ledger. [L10]
8. **Compaction and feature activation change behavior.** Installed memory and opt-in skill code differ from the checkout. [L1]
9. **A staged repair is not a live outcome.** Sep 10 repair documentation carefully distinguishes activation and delivery evidence. [L12]
10. **Migration needs exclusive ownership.** Grok export docs explicitly avoid duplicating Nancy's live schedules. [L11]

These lessons are not ten independent proven incident root causes. Some are directly inspected mechanisms; others are documented historical observations with the limits described above.

## 33. Major Risks

Scale: likelihood, impact and difficulty to fix later are 1 (low)–5 (very high), qualitative judgments for the proposed product. Ordered primarily by security/data-loss impact and late repair cost, not mechanically multiplied scores.

| Rank | Risk | Likelihood | Impact | Late difficulty | Mitigation / decision |
|---|---|---:|---:|---:|---|
| 1 | Ambient shell access bypasses policy/secret isolation | 5 | 5 | 5 | D1/E2; explicit access/guarantee choice, enforced bounds and named TCB |
| 2 | Operational truth fragmented across rules/prompts/memory | 5 | 5 | 5 | One authority, transactional changes, context manifests |
| 3 | Unknown external outcome retried as new work | 4 | 5 | 5 | Action/outbox ledger, reconciliation, idempotency/fencing |
| 4 | Cross-channel identity or approval confusion | 3 | 5 | 5 | Explicit linking, actor-bound grants, no group memory leak |
| 5 | Update or restore resurrects bad state/authority | 4 | 5 | 5 | Migration/revocation/receipt compatibility suite |
| 6 | Adaptive state/skill entropy | 5 | 4 | 4 | Scoped identity, supersession, examples, inspect/undo, E6 |
| 7 | Missing supported runtime seams causes permanent fork | 4 | 4 | 4 | E1 Nanobot hook/direct-tool/ephemeral coverage; no essential private patch dependence |
| 8 | Delegate mismatch or duplicate active writers | 4 | 4 | 4 | Shared ACP/native conformance, fenced workspaces, E4 |
| 9 | Background token growth / advisory limits sold as hard | 5 | 4 | 3 | Full usage ledger, reservations, no hidden background loop |
| 10 | Third-party extension/dependency supply chain | 4 | 5 | 4 | Isolation, pinning, review and signed release chain |
| 11 | Cross-platform install/security mismatch | 4 | 4 | 4 | Native bwrap lacks macOS backend; E2/E5 required probes, D4 unlock and D13 sleep policy |
| 12 | Nontechnical onboarding contradicts no-web secret UX | 4 | 4 | 3 | D2/E8; explain required CLI/OAuth step |

Largest architectural risk: **an unrestricted execution path that can mutate the canonical state or steal its credentials**, making carefully designed behavior/approval semantics bypassable.

## 34. Assumption Review

**Historical pre-spike analysis retained for provenance.** Architecture choices and readiness language in this section are superseded by section 38 and PRD.md; factual source observations and confirmed owner input remain evidence.

| Assumption | Classification | Evidence and reasoning |
|---|---|---|
| Small stable core + adaptive layer | KEEP, narrow interpretation | Local ownership fixes support it; adaptive layer must not become another framework [L13] |
| Bun + TS + Elysia orchestration | NEEDS EXPERIMENT / MODIFY | Bun packaging attractive; SDK/runtime compatibility not proven; Elysia optional without HTTP need [S32–S34] |
| Rust security boundary | MODIFY, owner confirmed | Separate authority plus OS enforcement matters; mandatory custom Guardian rejected [S8–S12] |
| Discord + Telegram only | KEEP | Narrow useful transport boundary; two adapters still require separate failure tests [S29, S30] |
| Honcho optional | KEEP | Local operational truth and availability must not depend on remote inference [L3; S19] |
| Natural language primary configuration | KEEP with typed receipts | Strong UX thesis; ambiguous scope and grants require visible interpretation |
| Automatic skill creation | MODIFY | Automatic drafts/low-risk reuse, tested activation; not arbitrary code install [L1, L9] |
| Durable structured behavior | KEEP | Directly addresses scope/provenance/rollback; free prose remains useful but not hard enforcement |
| Coding delegated | KEEP | Current programmatic interfaces exist; outcomes and permissions remain adapter-specific [S3–S6, S26, S27] |
| Broad shell/filesystem default | REJECT as secure default recommendation | General shell can bypass tool checks; owner must resolve D1 |
| User-approved recurring autonomy | KEEP | Grant/schedule/action separation makes repeated permission unnecessary [L4] |
| Reuse before rewrite | KEEP | Existing local and external components cover most mechanics |
| No web UI initially | KEEP, resolved D3 | CLI/SSH/OAuth selected; no secret page assumed [L16] |
| Personal-first, teams later | KEEP | Add owner identity now, defer roles/tenancy; do not equate shared channel with shared owner |
| Curl-based installer | MODIFY | Tiny auditable verified bootstrap; no unsigned mutable-source install/update [S31, S32] |

Additional confirmed preference: Nanobot is evaluated first, without private coupling; Linux/macOS both launch. Additional challenged assumption: a new standalone runtime is necessary. E1 may conclude a supported behavior extension is the better product foundation. Additional challenged assumption: “memory + skills + versioning” is differentiated; current competitors already overlap it. [S1, S2, S16]

## 35. Owner Decision Reconciliation and New Questions

**Historical pre-spike analysis retained for provenance.** Architecture choices and readiness language in this section are superseded by section 38 and PRD.md; factual source observations and confirmed owner input remain evidence.

This reconciliation supersedes the initial report's “all twelve unresolved” statement. **RESOLVED** means the owner answered the product choice; it does not mean implementation has passed tests. **PARTIALLY RESOLVED** preserves the accepted portion and names only the residual choice. [L16]

| Original ID | Status | Residual question |
|---|---|---|
| D1 | PARTIALLY RESOLVED | Whether to narrow host access or weaken the absolute interception promise remains unresolved. |
| D2 | PARTIALLY RESOLVED | Exact launch audience, minimum OS/kernel and CPU architectures need a bounded support commitment. |
| D3 | RESOLVED | No remaining product choice in the original question. |
| D4 | STILL OPEN | Should locked/rebooted hosts resume unattended, await unlock, or offer disclosed storage modes? |
| D5 | PARTIALLY RESOLVED | What may non-owner group participants read/trigger, and may personal memory be disclosed in shared channels? |
| D6 | PARTIALLY RESOLVED | Whether launch includes recurring workspace writes beyond research/notifications is still open. |
| D7 | RESOLVED | Activation confidence/dedup thresholds are E6 engineering questions, not a reason to reopen product policy. |
| D8 | RESOLVED | Timezone/DST encoding remains explicit engineering policy; global-pause scope is separately NEW D14. |
| D9 | PARTIALLY RESOLVED | Exact release-tested delegate matrix and optional Honcho launch timing remain open. |
| D10 | PARTIALLY RESOLVED | Quantitative quality/latency/cost thresholds and acceptable measured failure rates are not approved. |
| D11 | RESOLVED | Exact default retention durations and deletion mechanics are design/validation details; seek owner review if they materially reduce promised explainability. |
| D12 | PARTIALLY RESOLVED | Exact project license and redistribution/dependency constraints remain open; E1 chooses technical foundation. |

### D1 — Default access and destructive-action promise — PARTIALLY RESOLVED

**Confirmed:** Broad default preference, explicit destructive approval and reusable scoped grants reaffirmed; meaningful security complexity accepted.

**Question / why it matters:** Whether to narrow host access or weaken the absolute interception promise remains unresolved.

**Evidence discovered:** Arbitrary writable shell bypasses command classification; readable secrets plus network permits exfiltration. [L14; S8–S12]

**Options:** A: mediated broad reads/project writes. B: broad dedicated disposable host. C: broad personal host with explicitly advisory detection.

**Recommendation:** A for personal machines, B as a documented deployment option; owner has not approved this change.

**If we choose wrong:** Misleading security guarantee or data loss; costly boundary redesign.

### D2 — Launch user and official operating systems — PARTIALLY RESOLVED

**Confirmed:** Linux AND macOS from day one is resolved; no Linux-first recommendation remains.

**Question / why it matters:** Exact launch audience, minimum OS/kernel and CPU architectures need a bounded support commitment.

**Evidence discovered:** Native systemd/launchd installation exists; only bwrap shell backend found in inspected Nanobot. [L14]

**Options:** A: technically assisted users on a tested matrix. B: broad nontechnical self-hosting across many versions.

**Recommendation:** A, with exact versions/architectures from E2/E5/E8; do not silently drop macOS or assume Intel/ARM parity.

**If we choose wrong:** Support scope absorbs the product or permissions fail silently.

### D3 — Secure credential-entry surface — RESOLVED

**Confirmed:** CLI/SSH masked input or provider OAuth/device auth; no ordinary chat keys, no general UI, no temporary page assumed.

**Question / why it matters:** No remaining product choice in the original question.

**Evidence discovered:** Owner explicitly chose the input surfaces. [L16]

**Options:** Selected CLI/OAuth; a phone-only API-key path is not promised.

**Recommendation:** Implement only after experiment phase; explain terminal handoff naturally.

**If we choose wrong:** Unsafe chat-key fallback or avoidable scope growth if decision is ignored.

### D4 — Unattended restart versus encryption/key recovery — STILL OPEN

**Confirmed:** No owner answer establishes a key custody/reboot policy.

**Question / why it matters:** Should locked/rebooted hosts resume unattended, await unlock, or offer disclosed storage modes?

**Evidence discovered:** 0600 is not encryption; headless Secret Service and locked macOS Keychain need validation. [L1; S37, S45]

**Options:** A: available OS/external key source. B: manual unlock. C: protected local files with limited offline protection.

**Recommendation:** A where available, otherwise explicit B/C choice; measure recovery in E8.

**If we choose wrong:** Silent downtime, inaccessible backups or overstated confidentiality.

### D5 — Cross-channel identity and group privacy — PARTIALLY RESOLVED

**Confirmed:** Explicit identity linking, shared personal memory, separate conversation histories and deterministic thread/topic routing resolved.

**Question / why it matters:** What may non-owner group participants read/trigger, and may personal memory be disclosed in shared channels?

**Evidence discovered:** Transport membership is not personal authorization. [S29, S30; L16]

**Options:** A: owner-only commands and private-memory disclosure. B: explicit per-channel sharing. C: shared multiuser authority.

**Recommendation:** A initially; shared-channel replies must not expose private recalled facts without approved sharing.

**If we choose wrong:** Private-memory leakage or unauthorized approvals.

### D6 — Recurring effects allowed in v1 — PARTIALLY RESOLVED

**Confirmed:** Approved recurrence may run autonomously within scope; new consequential behavior proposed; corrections pause it.

**Question / why it matters:** Whether launch includes recurring workspace writes beyond research/notifications is still open.

**Evidence discovered:** Effect uncertainty/fallback complicates recovery. [L4; L16]

**Options:** A: research and bounded notifications. B: reversible workspace writes. C: external destructive/financial actions.

**Recommendation:** A for launch; evaluate B only with recovery evidence; C out of v1.

**If we choose wrong:** Duplicate effects or an oversized policy/recovery system.

### D7 — Learning and automatic skills — RESOLVED

**Confirmed:** Explicit scoped persistence, ambiguity clarification, conservative lower-authority inference, appropriate automatic skills, dedupe, meaningful history and undo confirmed.

**Question / why it matters:** Activation confidence/dedup thresholds are E6 engineering questions, not a reason to reopen product policy.

**Evidence discovered:** Owner directly specified authority and lifecycle. [L16; L14]

**Options:** Selected explicit persistence plus conservative inference; generated skills cannot expand permissions.

**Recommendation:** Validate low-risk activation and near-duplicate handling in E6.

**If we choose wrong:** Rule entropy or unnecessary approval fatigue.

### D8 — Missed schedules and routine interruption/notification behavior — RESOLVED

**Confirmed:** Coalesce missed observational runs, quiet unchanged checks, approved-scope execution and prompt relevant pause confirmed.

**Question / why it matters:** Timezone/DST encoding remains explicit engineering policy; global-pause scope is separately NEW D14.

**Evidence discovered:** Owner confirmed defaults; runtime scheduler must enforce them. [L16]

**Options:** Selected coalescing and quiet defaults, with governed schedule-specific exceptions.

**Recommendation:** Persist timezone/misfire policy; test in E3, avoid replay storms.

**If we choose wrong:** Stale notifications, missed work or unexpected spending.

### D9 — Delegate, memory and fallback launch support — PARTIALLY RESOLVED

**Confirmed:** User-selected modular delegates, sole configured choice honored, optional fallback, primary/fallback models, local memory and optional Honcho resolved.

**Question / why it matters:** Exact release-tested delegate matrix and optional Honcho launch timing remain open.

**Evidence discovered:** ACP/bridges exist but do not establish equivalent recovery semantics. [S38–S41]

**Options:** A: validated subset via shared protocol plus native gaps. B: all named agents regardless of conformance.

**Recommendation:** A; at least two tested implementations for architectural modularity, publish only verified support.

**If we choose wrong:** Nominal breadth hides unsafe cancellation/fallback or dominates maintenance.

### D10 — Three outcomes and launch quality bar — PARTIALLY RESOLVED

**Confirmed:** Durable correction across conversation/restart/upgrade; configured coding delegation; reliable quiet recurring/proactive research confirmed.

**Question / why it matters:** Quantitative quality/latency/cost thresholds and acceptable measured failure rates are not approved.

**Evidence discovered:** Historical mixed-provider bakeoff and call durations cannot set product performance claims. [L7, L15]

**Options:** A: deterministic gates plus held-out model thresholds. B: feature completion alone.

**Recommendation:** A; retain proposed 95% correction/scope target pending E6 and owner review; report uncertainty and failures.

**If we choose wrong:** Launch looks complete while its thesis remains unreliable.

### D11 — Retention/export and remote-memory principles — RESOLVED

**Confirmed:** Local-first, optional Honcho, remote memory never operational authority, configurable retention, portability/export and meaningful provenance confirmed.

**Question / why it matters:** Exact default retention durations and deletion mechanics are design/validation details; seek owner review if they materially reduce promised explainability.

**Evidence discovered:** Owner answered the original principles; separate raw histories from operational provenance. [L16]

**Options:** Selected local-first/configurable policy, remote memory deliberate opt-in.

**Recommendation:** Document categories/defaults before release; test export and deletion including remote copies/backups.

**If we choose wrong:** Sensitive over-retention or missing explanation/undo records.

### D12 — Foundation identity and open-source license — PARTIALLY RESOLVED

**Confirmed:** Nanobot first; composition/other runtime if needed; new runtime last; fully open source from beginning with no closed core tiers.

**Question / why it matters:** Exact project license and redistribution/dependency constraints remain open; E1 chooses technical foundation.

**Evidence discovered:** MIT upstreams and optional AGPL service require component-specific review. [S1, S2, S19; L16]

**Options:** A: compatible permissive distribution. B: compatible copyleft distribution. Neither requires a new runtime.

**Recommendation:** Evaluate exact reuse and notices before choosing; do not equate open source with mandatory Rust/TS or a fork.

**If we choose wrong:** Unnecessary rewrite or license/distribution incompatibility.

### NEW D13 — What availability does macOS support promise?

**Status: STILL OPEN. Question:** must jobs execute while the laptop sleeps or before login, or is awake/logged-in operation plus coalesced recovery sufficient?

**Why it matters:** official macOS support does not itself mean an always-on machine. This is separate from D4's encryption/unlock choice.

**Evidence discovered:** Nanobot generates a per-user LaunchAgent; Apple distinguishes user agents from daemons. No sleep/reboot experiment has run. [L14; S44]

**Options:** A: awake/logged-in local agent with explicit sleep limitations and coalesced recovery. B: supported always-on remote host for uninterrupted schedules. C: local pre-login daemon/wake-management promise.

**Recommendation:** A for local macOS; allow B as a deployment option; do not add C in v1 without evidence and owner approval.

**If we choose wrong:** “reliable schedules” becomes a false promise on sleeping laptops, or installer/key custody complexity expands sharply.

### NEW D14 — What exactly does global pause stop, and how does it resume?

**Status: STILL OPEN. Question:** does global pause stop only proactive/recurring work, or also active user-requested delegates/actions; what resumes automatically?

**Why it matters:** owner wants easy granular control and considers global pause desirable, but has not defined its effect boundary.

**Evidence discovered:** owner explicitly requested pause/revocation; cancellation cannot undo already submitted effects. [L16; L4]

**Options:** A: pause all autonomous/background dispatch, cancel relevant in-flight work, retain read-only chat/recovery. B: freeze all task execution including user-requested coding until explicit resume. C: only pause future schedules.

**Recommendation:** A with an explicit emergency “stop all execution” control; resume explicitly and coalesce missed observations. This proposed two-level behavior is not an accepted owner decision.

**If we choose wrong:** work continues after an expected stop, or recovery/control becomes unavailable.

### Confirmed additions not forced into original decision numbers

Section 3 records calibration, explained wizard, primitive-based product shape, reuse-first capability acquisition, useful partial results, provenance questions, deterministic jobs and lightweight history. These supplement the original questions; they do not artificially resolve D4, the group-sharing part of D5, or the launch support part of D9.

## 36. Architecture closed; remaining implementation choices

Native Bun/TypeScript is selected. Nanobot and Hermes foundation candidacy is closed. Rust is optional only for a narrow, demonstrated benefit. There is no pending runtime bakeoff.

Remaining engineering choices are concrete integration work: maintained execution backend per platform; provider/ACP/native adapter release pins; secret-backend unlock handling; lazy schema/parser choices; migration mechanics and packaging. They must meet PRD invariants and release tests. None is evidence that a new owner preference question or broad experiment is needed now.

Historical D3/D7/D8/D11 remain resolved. PRD §12 preserves the other confirmed preferences, labels implementation defaults rather than inventing owner approvals, and records the existing D1 unrestricted-access conflict and final distribution-license clearance. They do not prevent beginning the defined build.

## 37. Next step — implement the approved initial specification

Architecture discovery is closed and PRD.md is complete. The next work phase can implement v0.1.0 in the PRD's vertical increments. This documentation task does not implement the bot.

Do not rerun foundational architecture experiments, turn Nanobot/Hermes back into runtime candidates, or restart discovery for documentation. PRODUCT_RESEARCH.md is now required and created under the later addendum; ongoing research refreshes do not block v0.1.0 implementation. Inspect their relevant capabilities before integration work, reuse maintained dependencies and port only the necessary thin behavior. Validate unproven platform/provider/delegate/security contracts during implementation and refuse unsafe release downgrades.

## 38. Final spike evidence and owner reconciliation

**Owner direction, final:** native Bun/TypeScript runtime/control; one model loop, small necessary-only context/schemas, low overhead and authoritative gates; OS-first security with optional narrow Rust; Nanobot/Hermes as references/capability sources. Initial version means minimal BUILD, not reduced PRODUCT. Finish a buildable PRD, begin versions at v0.1.0, preserve durable state/config through upgrades, and initially defer PRODUCT_RESEARCH.md as non-blocking documentation. **The subsequent documentation addendum supersedes that deferral: the research document is now required and created.** This supersedes historical evaluation-order and no-PRD instructions.

| Evidence | Exact result | Interpretation |
|---|---|---|
| L19 — E1 | 281 authored Python LOC, 15 assertions; Nanobot upstream c4a25c9; wrong/stale delegate blocked; restart/undo passed | NO-GO as universal authority-owning foundation. SDK strict ephemeral hooks did run; native child/default/factory/retry gaps must not be generalized into an incorrect claim all hooks fail. |
| L20 — B | 296 LOC, 22 assertions; Bun owns independent authority/fake effect; warm added median 13.07 ms, IPC residual 1.07 ms; cold 1.6–2.1 s | GO WITH LIMITATION; same-user process separation is not OS protection. |
| L21 — Native | 29-line new adapter; 300 total comparison/control/test LOC; 13 assertions; shared fixture, 12 measured warm samples/arm | NATIVE BUN CLEARLY BETTER for the narrow proposal role; not a full Nanobot port or live-model quality claim. |
| L22 — OS/Rust | Independent Landlock ABI4 probe; Rust/controller/probe 176 LOC; 14 assertions; 200 IPC samples median 0.212 ms/p95 0.937 ms | RUST OPTIONAL / OS PRIMITIVES SUFFICIENT. Child filesystem confinement works without Rust. Network/macOS/compromised-controller protection not proved. |

Native versus Nanobot in the matched final fixture: one provider call each; request bytes **521 / 23,147**; compact message context bytes **450 / 8,929**; common-tokenizer serialized request estimates **131 / 5,017**; warm full action medians **16.56 / 185.71 ms**; cold readiness medians **38.19 / 1,883.59 ms**. Three cold launches each. Native slice adds zero third-party packages and needs one Bun process; the comparator adds Python and has 89 installed distributions excluding pip (not all necessarily needed). These measurements differ from E1's two-call workflow and cannot be treated as a controlled E1-to-native production speedup. No billed/cache-token or live-model-quality conclusion follows.

The recommended near-term shape is native Bun core/model slice plus OS confinement, with broader capabilities retained through inspected maintained components. The two final spikes were independent; no end-to-end native sandboxed product was built.

**Acceptance reconciliation:** all A01–A46 survive in PRD §13. A29's real Honcho variant gates its later adapter, while disabled/local operation gates v0.1.0; A05 can exercise any supported configured alternate rather than promise early Grok support. A36 follows the explicit pause/stop-all build semantics. A42 covers delegate/MCP/process ownership now and fan-out later. Earlier D-number questions remain historical evidence; PRD §12 is the current disposition, including explicit build defaults and unchanged owner decisions.

**Evidence links:** [E1 report](../personal-agent-e1/REPORT.md); [B report](../personal-agent-b/REPORT.md); [native report](../personal-agent-native-spike/REPORT.md); [Rust report](../personal-agent-rust-spike/REPORT.md); [combined reports](../personal-agent-spikes/REPORT.md). Exact source files, hashes, sample data and evidence bundles are retained beside those reports. The native task verified all 15 B manifest files unchanged. Production was not modified.

**PRD closure:** [PRD.md](PRD.md) is normative. [PRD_INPUT.md](PRD_INPUT.md) is updated. [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md) is now created under the superseding addendum, explaining evidence/issue research and product rationale. [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md) is the repository and automation plan. No new experiment or bot implementation was performed in this closure.

## Sources and Evidence Register

### Local evidence

All local records accessed 2026-09-11. They remain on the host; private source documents are not public references. Where a commit is given, it is preferable to a mutable working-tree path. No secret values are included.

- **L1 — DAVID / NANOBOT SOURCE / OBSERVED.** Host/service/file metadata; `/home/david/.nanobot/src/nanobot` at `f49965445152361b779b465e8a5111549ac934c4`; `nanobot/agent/{context,memory,skills,subagent}.py`, `nanobot/cron/service.py`, `nanobot/bus/queue.py`, `pyproject.toml`, `LICENSE`; compared with installed release modules in `/home/david/.nanobot/releases/82a5cb72/venv/lib/python3.12/site-packages/nanobot`.
- **L2 — GIT HISTORY / HERMES SOURCE.** `/home/david/.hermes/hermes-agent` at `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544`; commits `0676c4c8ba`, `e480de5946`, `b5a7062c0a`, `93e2525a0b`; `gateway/delivery.py` and delivery test changes. `/home/david/agent` history at `e4dba85fa3587bc54722983a2acadd1a024d5756`.
- **L3 — DAVID / REPORTED.** [Nancy release manifest](/home/david/.nanobot/releases/82a5cb72/MANIFEST.md), dated Sep 8. Release provenance and historical Honcho/session migration verification; not a new remote Honcho health check.
- **L4 — DAVID / REPORTED CONTRACT.** [Abi notification contract](/home/david/ABI_NOTIFICATION_CONTRACT.md), Sep 3. Explicit event/attention/delivery semantics and stated limitations.
- **L5 — GIT HISTORY / SOURCE.** Agent commit `44210ff2343240b05ad2ae8d119da0331508b594`; [Nancy thread adapter](/home/david/agent/deployment/nanobot/nancy_discord_threads.py), corresponding tests and renderer/continuity changes.
- **L6 — GIT HISTORY / SOURCE.** Agent commit `e2ab9fc44`; [bounded search guard](/home/david/agent/deployment/nanobot/nancy_search_guard.py); `scripts/install_nanobot_safety.py` and watchdog. Inspected, not executed.
- **L7 — EXPERIMENT / REPORTED.** [Historical bakeoff quality notes](/home/david/runtime-lab/bakeoff/runs/QUALITY_NOTES.md), with adjacent fixtures/artifacts. Mixed harness/model and incomplete usage caveats apply.
- **L8 — DAVID / REPORTED HISTORICAL AUDIT.** [Portability and upgrade audit](/home/david/ABI_PORTABILITY_UPGRADE_AUDIT.md), Sep 2. Historical live version and ahead/behind counts are not current deployment claims.
- **L9 — HERMES SOURCE / DOCUMENTATION.** Inspected Hermes revision above: `AGENTS.md`, `hermes_cli/setup.py`; `website/docs/user-guide/features/memory.md`; `website/docs/developer-guide/{context-compression-and-caching,context-engine-plugin,secret-source-plugin}.md`; `LICENSE`.
- **L10 — DAVID / LOGS / OBSERVED.** Read-only SQLite aggregates/schema from `/home/david/.nanobot/llm_usage.sqlite3`, `/home/david/.hermes/state.db`, `/home/david/.hermes/kanban.db`; bounded journal lexical analysis; systemd status/timer metadata. No conversation bodies or credentials copied.
- **L11 — DAVID / REPORTED.** [Grok parallel environment README](/home/david/grok-bot-parallel/README.md): identifies Nancy VPS hostname and separate Agent Computer export/ownership boundary.
- **L12 — DAVID / REPORTED.** [Nancy repair review](/home/david/.nanobot/releases/nancy-native-repair-20260910/REVIEW.md), Sep 10. Used only for staged/live/recovery distinctions, not reproduced test claims or private domain facts.
- **L13 — DAVID / SOURCE-CONTRACT.** [State ownership](/home/david/agent/docs/state_ownership.md): scoped objective CAS, canonical ownership and explicitly advisory budget guard. Historical phase labels not assumed to represent every current path.

### External primary sources

Source dates are access dates unless a publication date is explicitly stated. Repositories/docs are mutable; version pinning and dependency-level checks remain pre-adoption gates. Findings use paraphrase rather than large quotations.

1. **S1 — Nous Research.** [Hermes repository](https://github.com/NousResearch/hermes-agent) and [skills documentation](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills). Product overlap; local source provides the deeper version-specific analysis.
2. **S2 — HKUDS.** [Nanobot repository](https://github.com/HKUDS/nanobot). Current installation/release posture and license; local source provides implementation evidence.
3. **S3 — OpenAI.** [Codex App Server](https://learn.chatgpt.com/docs/app-server). Local protocol, approvals and event interface.
4. **S4 — OpenAI.** [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk). Start/continue/resume and runtime requirements.
5. **S5 — Anthropic.** [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview). Agent interface and terms distinction.
6. **S6 — xAI.** [Grok Build CLI reference](https://docs.x.ai/build/cli/reference), page updated July 21, 2026. ACP, device auth, resume and permission flags.
7. **S7 — OpenClaw.** [Sandboxing](https://docs.openclaw.ai/gateway/sandboxing). Execution isolation and configuration distinction.
8. **S8 — Linux kernel.** [Landlock userspace API](https://www.kernel.org/doc/html/latest/userspace-api/landlock.html). Rights restriction and ABI limitations.
9. **S9 — gVisor / bubblewrap maintainers.** [gVisor security model](https://gvisor.dev/docs/architecture_guide/security/) and [bubblewrap repository](https://github.com/containers/bubblewrap). Isolation boundaries and caller policy responsibility.
10. **S10 — MCP maintainers.** [Security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices). Confused deputy, token handling, SSRF and authorization boundaries.
11. **S11 — nono maintainers.** [nono repository](https://github.com/nolabs-ai/nono). Existing sandbox candidate, Apache-2.0, API stabilization warning; original `always-further/nono` URL redirected here.
12. **S12 — NVIDIA.** [OpenShell repository](https://github.com/NVIDIA/OpenShell). Policy-controlled execution and credential endpoint binding; Apache-2.0.
13. **S13 — Earendil Works / Pi maintainers.** [Pi repository](https://github.com/earendil-works/pi). Model/agent packages, MIT, explicit lack of built-in host permission isolation; old `badlogic/pi-mono` URL redirected here.
14. **S14 — Vercel.** [AI SDK repository](https://github.com/vercel/ai) and [license](https://raw.githubusercontent.com/vercel/ai/main/LICENSE). TypeScript model/tool integration candidate and Apache-2.0.
15. **S15 — LangChain.** [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence). Checkpoint model; durable-execution URL redirected here.
16. **S16 — Letta.** [Current Letta Code](https://github.com/letta-ai/letta-code) and [old repository pointer](https://github.com/letta-ai/letta). Current harness, versioned context and adaptation overlap; Apache-2.0.
17. **S17 — DBOS.** [TypeScript guide](https://docs.dbos.dev/typescript/programming-guide) and [MIT license](https://github.com/DBOS-inc/dbos-transact-ts/blob/main/LICENSE). Durable steps/queues and Postgres requirement in reviewed guide.
18. **S18 — Temporal.** [Workflow documentation](https://docs.temporal.io/workflows). Durable workflow alternative; no production comparison performed.
19. **S19 — Plastic Labs.** [Honcho repository](https://github.com/plastic-labs/honcho). Memory architecture, deployment options and AGPL-3.0 server license.
20. **S20 — Mem0.** [Memory library repository](https://github.com/mem0ai/mem0). Retrieval-memory alternative; Apache-2.0. Vendor benchmark claims not adopted as this product's results.
21. **S21 — Microsoft.** [Playwright repository](https://github.com/microsoft/playwright). Library/CLI/MCP browser reuse; Apache-2.0.
22. **S22 — ACP maintainers.** [Agent Client Protocol introduction](https://agentclientprotocol.com/get-started/introduction). Standardized client-agent boundary.
23. **S23 — OpenTelemetry.** [Handling sensitive data](https://opentelemetry.io/docs/security/handling-sensitive-data/). Redaction and telemetry data-minimization guidance.
24. **S24 — Anthropic.** [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Selective context and long-horizon mechanisms.
25. **S25 — Anthropic.** [Advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use). Lazy tool schemas and programmatic result processing.
26. **S26 — OpenCode.** [Server documentation](https://opencode.ai/docs/server/). Headless server, OpenAPI, session and abort interfaces.
27. **S27 — Google.** [Antigravity headless mode](https://antigravity.google/docs/cli/headless/). Programmatic CLI candidate; actual account/runtime not tested.
28. **S28 — Pydantic.** [Monty](https://github.com/pydantic/monty). Constrained interpreter alternative; not a general shell replacement.
29. **S29 — Discord.** [Threads](https://docs.discord.com/developers/topics/threads) and [discord.js](https://github.com/discordjs/discord.js). Native permissions/routing; current repository Apache-2.0.
30. **S30 — Telegram / grammY.** [Bot API](https://core.telegram.org/bots/api) and [grammY repository](https://github.com/grammyjs/grammY). API/topic/update behavior and MIT adapter candidate.
31. **S31 — TUF maintainers.** [The Update Framework](https://theupdateframework.io/). Authenticated update metadata architecture.
32. **S32 — Bun.** [Standalone executables](https://bun.sh/docs/bundler/executables). Packaging candidate, not validated platform support for selected dependencies.
33. **S33 — Bun.** [Node compatibility](https://bun.com/docs/runtime/nodejs-compat). Runtime compatibility must be checked per API/dependency.
34. **S34 — Elysia.** [At a glance](https://elysiajs.com/at-glance); **Clack maintainers**, [Clack](https://github.com/bombshell-dev/clack) and [core license](https://raw.githubusercontent.com/bombshell-dev/clack/main/packages/core/LICENSE). HTTP framework and CLI UI roles; not security primitives.
35. **S35 — SQLite.** [Backup API](https://sqlite.org/backup.html). Consistent live-database backup mechanism.
36. **S36 — restic.** [Project documentation entry](https://restic.net/). Existing encrypted backup system; exact distribution license/package audit remains required.
37. **S37 — freedesktop.org.** [Secret Service API](https://specifications.freedesktop.org/secret-service/latest/). Existing secret storage and locking interface; actual VPS backend not validated.

### Continuation evidence — 2026-09-11

- **L14 — Deeper local source inspection.** `/home/david/.nanobot/src/nanobot` at `f49965445152361b779b465e8a5111549ac934c4`: `docs/python-sdk.md`, `docs/deployment.md`, `nanobot/sdk/clients.py`, `agent/hook.py`, `agent/turn_hooks.py`, `agent/tools/execution.py`, `agent/tools/registry.py`, `agent/tools/loader.py`, `agent/tools/sandbox.py`, `agent/tools/shell.py`, `agent/plugins.py`, `cron/service.py`, context/skills/provider modules. Local overlays under `/home/david/.nanobot/extensions`; Hermes delegation docs/ACP sources in the pinned L9 checkout. Source read only; new seam claims are not installed-release verification.
- **L15 — Fixed-window latency aggregation.** Read-only SQLite `/home/david/.nanobot/llm_usage.sqlite3`, `llm_calls`, `started_at_ms` 1788894996379–1789086096818 inclusive; grouped by source, per-call `duration_ms` sorted median and floor-rank p95. Same 448 calls as L10; no positive TTFT/generation observations. No task-latency or monetary ranking inferred.
- **L16 — Confirmed owner continuation.** [Supplied request](/home/david/.codex/attachments/90a369ae-5118-4499-b3d9-3eb59db100d1/pasted-text.txt), read in full. Authority for revised decisions, not experimental evidence.
- **S38 — ACP maintainers.** [Registry documentation](https://agentclientprotocol.com/get-started/registry) and [registry source](https://github.com/agentclientprotocol/registry). Discovery/distribution of existing agents; each adapter's conformance/license still reviewed separately.
- **S39 — ACP maintainers.** [Claude ACP bridge](https://github.com/agentclientprotocol/claude-agent-acp). Existing Claude Agent SDK bridge.
- **S40 — Zed.** [Codex ACP bridge](https://github.com/zed-industries/codex-acp). Existing integration candidate, not tested here.
- **S41 — Hermes.** [ACP feature](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp). Server role does not imply general coding-delegate client support.
- **S42 — nono.** [OS sandbox](https://www.nono.sh/os-sandbox). Linux Landlock/macOS Seatbelt candidate; marketing performance/parity claims are not accepted as validation.
- **S43 — Apple.** [Privacy & Security settings](https://support.apple.com/guide/mac-help/change-privacy-security-settings-on-mac-mchl211c911f/mac). OS access grants are distinct from agent authorization.
- **S44 — Apple, archived documentation.** [Creating launchd jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html). Agent/daemon distinction; current installation behavior must be tested.
- **S45 — Apple.** [Keychain Services](https://developer.apple.com/documentation/security/keychain-services). Established credential store; no claim that headless/unattended unlock has been validated.

### Final bounded issue-pass evidence

- **L17 — Owner architecture/issue-mining clarification.** [Supplied request](/home/david/.codex/attachments/2fe0192e-4a2f-4979-a42f-29d8e8e2b4b1/pasted-text.txt). Authority for A/B/C/D comparison and small-core/rich-capability distinction.
- **L18 — Targeted source corroboration.** Pinned Nanobot `nanobot/session/manager.py` uses external runtime sessions; pinned Hermes `tools/tool_search.py` exposes progressive bridges and `website/docs/developer-guide/model-provider-plugin.md` documents external-process provider seam. Read-only; not installed-release conformance testing.
- **Issue register:** section 9 links all 39 individually fetched OPEN GitHub issues, with last-update dates, evidence classification, interpretation and reuse consequences. Status snapshot approximately 2026-09-11 02:15–02:25 UTC. Linked comment/PR checks distinguish merged #5279/#95091, open #5379/#5627/#5257 (Nanobot)/#91293/#48622, and closed-unmerged Hermes #68222. A merged PR is not proof of a particular deployed release or all related guarantees.
- **S46 — SQLite.** [Atomic Commit](https://sqlite.org/atomiccommit.html). Crash-atomic transactions and storage assumptions; used to challenge an issue's unsupported blanket corruption claim, not certify a deployment.

### Architecture closure evidence

- **L19:** E1 unmodified-upstream SDK/fake-delegate report and raw assertions, `/home/david/personal-agent-e1`.
- **L20:** Bun authority/Nanobot child spike, `/home/david/personal-agent-b`.
- **L21:** Native Bun/shared-fixture comparison, `/home/david/personal-agent-native-spike`.
- **L22:** OS-first Landlock/Rust broker experiment, `/home/david/personal-agent-rust-spike`.
- **L23:** Latest owner direction in this task: close architecture discovery, native Bun primary, references-only Nanobot/Hermes, broad capability contract, SemVer v0.1.0 and durable upgrades; create final PRD, no implementation.


## Final documentation addendum — Keli and Bun-first delivery

The owner named Keli (כלי; tool / instrument / vessel) and requested simple Bun-native automation. DEC-ARCH-01 remains native Bun authority, OS enforcement and optional narrow Rust. DEC-TOOLING-01 prefers Bun install/lock, test, scripts, compile, spawn, SQLite/file/fetch and compatible credential APIs, with small GitHub Actions wrappers. One standalone core is preferred; browser/delegate/MCP prerequisites remain explicit and lazy. Config/state stays external across SemVer upgrades starting v0.1.0. No mandatory Docker or default Rust toolchain.

The current remote audit reviewed Nanobot `aeb7b207d7e501b1dd5d8b68208813f493411331` and Hermes `05d705dd695d1084388529124dc2ffe5ce919e89`. It distinguishes visible files/public rules from unknown private settings, and documents adoption/adaptation rather than copying all upstream governance. In particular, Nanobot's Bun TUI build/hash pattern is reusable; Hermes's security boundary description and dependency-path review inform Keli. Neither audit changes the historical E1 pin or refreshes the 39 issue statuses. Exact pinned sources and practices are in REPO_GOVERNANCE.md.

All 39 issue records and A01–A46 remain preserved. Research explicitly records unsuccessful foundation hypotheses, limits of scripted measurements, and planned rather than proven coverage. PRODUCT_RESEARCH.md is delivered now, not assigned to v0.2.0. The PRD and repo plan are ready for implementation; this addendum produced documentation only.
