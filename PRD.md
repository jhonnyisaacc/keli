# Keli — Product Requirements Document

Status: final initial-phase product specification; ready to begin v0.1.0 implementation when authorized. Architecture discovery is closed. Updated 2026-09-11. This document authorizes no implementation in the documentation task that produced it.

## 1. Product contract and vision

Teach the agent how to work once. An explicit correction becomes durable at the correct scope, actually governs future execution, survives conversations/restarts/upgrades, and can be explained, changed or undone. Approved autonomous work remains reliable, quiet and bounded. The product is a capable, personal-first, fully open-source agent; it is not a coding engine, domain-specific bot, generic workflow platform or sandbox product.

The three required initial outcomes remain: durable scoped corrections; correct user-selected coding delegation; reliable approved recurring/proactive research with meaningful notifications only. Useful partial results are preferable to fabricated certainty or withholding everything. Completion must reflect verified outcomes, never merely a model saying “done.”

The full product capability contract includes shell/files, browser/web/search/HTTP, MCP, skills, local and optional remote memory, jobs/triggers, coding delegates, Discord/Telegram, model/provider support, secure onboarding/auth, artifacts, recovery, portability and upgrades. A small authored core must not become an incapable product. Users compose domain workflows through conversation; ship primitives and useful integrations rather than a preset portfolio of the owner's existing applications.

Initial users are personal users comfortable with an explained installer or receiving setup assistance. Linux and macOS are official day-one platforms. Teams, cross-owner permissions and multi-machine coordination are later. No general web UI or separate secret-entry website is required. **DEC-NAME-01 (resolved OWNER decision): the product is Keli (Hebrew: כלי), from the owner's stated meaning tool / instrument / vessel. Use `keli` for repository, CLI, package and binary identifiers.** Examples: `keli init`, `keli doctor`, `keli run`, `keli update`. Historical experiment names/paths remain unchanged.

Normative terms: MUST is a release requirement; SHOULD permits a recorded, justified implementation alternative. “Configured” means explicitly enabled and supplied with required credentials/permissions, not silently connected. Product capabilities remain part of the contract even when a connector requires opt-in setup. Historical discovery recommendations are superseded by this PRD and the latest owner direction.

## 2. Settled architecture and evidence

Native Bun/TypeScript owns the runtime, one model loop per run, context construction, canonical behavior, grants, dispatch, run/action/job/delivery truth and user-state lifecycle. OS mechanisms enforce execution restrictions. Rust is optional and narrow, admitted only for a demonstrated improvement in enforcement, portability, reliability or performance. Elysia, a mandatory Python runtime, Redis/Postgres, Docker and a large custom Guardian are not baseline dependencies.

Nanobot and Hermes are reference implementations and sources of proven capabilities, not foundational runtime candidates. Before implementing each integration, inspect the relevant code and failure lessons, adopt maintained libraries/protocols first, and port only useful thin integration logic when necessary. Preserve notices and record provenance. Do not blindly translate whole runtimes, copy private patches, import another state owner, or discard mature libraries for language purity.

| Evidence | Executed result | Architectural consequence / limit |
|---|---|---|
| E1, unmodified Nanobot c4a25c9 | 281 Python LOC; 15 assertions; lifecycle works, universal enforcement gate fails | Nanobot foundation NO-GO at pin; SDK ephemeral strict hooks worked, default failures and native child/retry paths remained gaps |
| B, Bun authority + Nanobot proposal child | 296 LOC; 22 assertions; warm added median 13.07 ms; one provider call in matched arms | Independent authoritative Bun gate and truth ledger work; same-user IPC is not security isolation |
| Native slice | 29-line adapter; 13 assertions; 12 measured warm samples/arm | Native full action 16.56 ms vs Nanobot 185.71 ms; request 521 vs 23,147 bytes; same scripted fixture and one call each |
| Native cold/dependencies | Three readiness samples/arm; native median 38.19 ms vs 1,883.59 ms | One Bun process and zero extra native-adapter packages; comparison environment had 89 distributions, not all necessarily required |
| OS-first/Rust | Independent Landlock probe, then 176 LOC broker/controller/probe; 14 assertions; IPC median 0.212 ms | Kernel filesystem confinement worked independently of Rust; no network, macOS or compromised-controller protection established |

Native common-tokenizer estimates were 131 vs 5,017 tokens of serialized whole requests; these are not billed prompt tokens. All model performance figures use scripted providers, not live intelligence, caching or production throughput. Experiment code is disposable evidence: implement reviewed product contracts, do not promote the spikes into production. Detailed reports: [E1](docs/evidence/DISCOVERY.md#l19), [B](docs/evidence/DISCOVERY.md#l20), [parallel spikes](docs/evidence/REPORT.md).

## 3. Architectural invariants

| ID | Non-negotiable contract |
|---|---|
| I1 | Every durable datum has an owner, type and scope. Rules, facts, procedures, grants and artifacts are distinct. Storage-level reads/replacement/deletion enforce scope; skill identity/dedup precede creation. |
| I2 | Identity does not confer ambient authority. Every consequential capability dispatch uses the current Bun gate and an enforceable resource/secret/host/cwd boundary. A prompt, imported skill or tool response cannot expand permissions. |
| I3 | Every run, background task, child process and MCP connection has an owner, bounded lifetime and recovery/outcome policy. Required children cannot disappear behind parent success. Control/recovery remains responsive. |
| I4 | A mutation requires proven exclusive ownership and a fencing token. Expired workers cannot write after a successor starts. If the old writer cannot be fenced, block the successor and report uncertainty. |
| I5 | False deterministic triggers and waiting-for-user states cause zero model calls. Budgets and no-progress/retry limits are runtime-enforced, including helpers and delegates where metering/control is available. |
| I6 | Context has explicit lifetimes and separate token, serialized-byte and artifact budgets. Attribute usage to exact model requests; preserve provider-required continuation/reasoning structures. |
| I7 | Archive/compaction cursors advance only through durably preserved evidence. Summaries are derived; a truncated suffix cannot be silently marked preserved. |
| I8 | A small searchable capability index keeps broad capabilities discoverable. Promote only necessary schemas/skills into context; discovery is not authorization. No full-registry escape from hard budgets. |
| I9 | Intent, dispatch, execution, verification, delivery and presentation are separate facts. Typed errors or pending approval cannot become success text. Unknown external effects remain unknown until reconciled. |
| I10 | Config/state writers are transactional or use durable atomic replacement. Updates preserve user state and effective permission assumptions or stop with explicit recovery; rollback cannot resurrect grants or replay effects. |

No second LLM makes routine policy decisions. A single model loop may take multiple bounded reasoning/tool iterations; each proposed action is independently gated. New grants and durable configuration edits use typed control operations. Another process/library may implement a capability, but may not bypass authority or own competing canonical product state.

## 4. v0.1.0 build scope: one capable vertical product

v0.1.0 includes the following thin, end-to-end paths. These are release requirements, not optional roadmap labels. Dependencies and accounts can be installed/connected on demand; every listed capability needs an honest readiness/setup path. Do not defer browser, MCP, jobs or the second transport merely to achieve an attractive code count.

| Surface | v0.1.0 required behavior | Deliberate boundary |
|---|---|---|
| Runtime/model loop | Native Bun, validated provider responses/tool proposals, primary/fallback, bounded iterations, cancellation, usage attribution | No model training or universal provider ecosystem |
| Behavior | Owner/project/run scopes, durable explicit instructions, precedence/conflicts, provenance, version history, explain/undo | No policy DSL or automated core modification |
| Shell/files/artifacts | Shell available at first use; scoped resource access, read/search/list, create/edit, sandboxed command execution, artifact receipts | No unrestricted personal-host worker profile presented as safe |
| Browser/web/search/HTTP | **Complement model:** bounded HTTP (`http.fetch`) and static extraction (`web.fetch`) without a browser engine; optional **pluggable browser session backends** (Playwright, CDP, browser MCP, fixture) for JS navigation/screenshots/downloads; configured search service | Playwright is a v0.1.0 conformance target, not the only allowed backend; authenticated browsing is an explicit capability connection; no personal cookie import or autonomous purchasing |
| MCP | One maintained client supporting local stdio and remote supported HTTP transport; indexed discovery, lazy schema loading, ownership/reconnect/close | No custom protocol/server marketplace or ungated third-party code |
| Skills | Agent Skills-compatible content, scoped index, selected load, automatic drafts, dedup, tested activation/version rollback | Generated executable code is a reviewed capability change |
| Memory | Local source-linked notes/conversations, scoped SQLite FTS, canonical task checkpoints, bounded compaction, export/deletion/retention | No mandatory vector service; remote memory cannot own rules |
| Jobs/triggers | One-shot and recurring time triggers, simple deterministic conditions, durable occurrence ledger, grants, coalescing, pause/cancel | No workflow language, distributed scheduler or general event-bus platform |
| Coding delegation | Modular selection; Codex and OpenCode first release-conformance targets; one configured choice honored; optional explicit fallback with fencing | No proprietary coding engine, parallel writer fan-out or promise that all named delegates work |
| Transports | Discord and Telegram, inbox dedup, deterministic threads/topics, explicit identity linking, private memory boundaries, outbox receipts | No team authority model or general web UI |
| Onboarding/auth | Explained interactive CLI wizard, primary/fallback models, masked input or provider OAuth/device flow, transport test, optional calibration | Advanced routing/budgets not forced into setup |
| Operations | CLI health/inspect/pause/resume/backup/restore/update; signed release installation; crash recovery; Linux/macOS service lifecycle | No mandatory hosted control plane or observability SaaS |

The core should be organized by these responsibilities, not one microservice per row. Start with one Bun daemon, embedded SQLite and content-addressed files. Spawn isolated processes only for actual browser, local MCP, delegate or shell execution needs. In-process code with controller access is trusted software, not an untrusted extension sandbox.

## 5. Product behavior and interaction contract

### 5.1 Corrections, scope and learning

Resolve owner/conversation/project deterministically from authenticated transport bindings and explicit project selection. A project has a stable ID and verified resource roots; do not infer identity from a mutable directory label. “Rocket changes use Codex” commits `coding.delegate` at Rocket scope and acknowledges only after durable success. “Use OpenCode this time” is a run override. Material scope ambiguity prompts one specific clarification; pause the disputed action first when the user says stop/no/that is wrong.

Authority limits are evaluated before behavior precedence. Within permission: explicit run override → most specific explicit applicable instruction → broader explicit instruction → confirmed preference → tentative inference → procedure default. Explicit prohibitions remain binding; equal-authority conflicts block the affected decision rather than using arbitrary scores. Revisions resolve intentional supersession. An inferred preference cannot silently replace an explicit instruction.

Store free-form guidance when appropriate, clearly distinguished from typed enforceable rules. Do not promise deterministic enforcement of arbitrary prose. Use model interpretation within the existing loop to propose structured mutations; validate scope/type/conflicts in Bun. Owner-issued unambiguous ordinary behavior changes do not require redundant approval. Permission expansions do.

Imported summaries, quoted text, browser pages, repositories, skill instructions and tool outputs remain untrusted content. They cannot activate rules, jobs or grants. Calibration offers guided questions, a real task, an imported LLM summary or combinations; it is optional, explains what was understood, and supports correction/removal before activation.

Meaningful durable behavior/procedure/grant changes receive a stable source reference, timestamp, actor, expected revision, active/superseded/revoked status and change record. Ordinary conversational reasoning is not versioned policy. Undo creates a compensating revision, preserves unrelated state and checks job/procedure references. It does not undo an external side effect or erase audit evidence.

### 5.2 Skills and memory

Search IDs/aliases/scoped semantic candidates before creating a skill. Automatic instruction-only drafts are allowed. v0.1.0 default activation requires an explicit owner request to preserve the procedure or two successful comparable uses with an example check; treat this as an adjustable engineering default, not universal confidence science. Code/permission changes require reviewed installation. Existing scheduled work pins a procedure version until a compatible revision is validated.

Canonical operational rules/grants/jobs never depend on retrieval or compaction. Local semantic memory is advisory, source-linked and scope-filtered before retrieval. Working state stores the goal, completed/pending actions and evidence pointers independently of transcript length. Index summaries and small metadata first; fetch exact evidence only when needed. Archive required raw evidence before committing a preservation cursor; retain an oversized raw fallback if summarization fails.

Defaults: retain explicit rules, meaningful change history and user-designated deliverables until deletion; retain raw conversation/diagnostic and run-detail records for 90 days; expire temporary scratch after seven days once no active run references it. Retention is configurable and never silently removes evidence referenced by active rules/jobs or unresolved outcomes. Explain when the original source was deliberately deleted while retaining a non-sensitive provenance tombstone. No automatic upload of memory. Honcho remains an optional adapter delivered in increment 0.1-F; disabling it must never break local operation.

### 5.3 Jobs, autonomy and attention

A job references a goal/procedure, schedule/trigger, project, destination, grant and procedure revision. A schedule or procedure is not a grant. The user's explicit recurring request can supply that grant after the system shows the concrete scope; safely matching future occurrences run without another approval.

v0.1.0 supports approved research, observational checks, local artifacts and bounded notifications. Reviewed reusable grants may include reversible project mutations via the same write gate; there is no default grant for recurring repository writes, deployments, destructive infrastructure or financial transactions. Unknown-risk expansions stop for approval. Complex unattended external-write workflows are later.

Persist occurrence identity before dispatch. One active occurrence per job by default; coalesce missed observational ticks into one current check, preserve scheduled time/timezone, and do not replay a backlog of effects. Resolve daylight-saving schedules using the selected timezone and document skipped/repeated wall-clock behavior: one occurrence per configured local date/time, nonexistent local times run at the next valid time. Persist the chosen occurrence key so restart cannot duplicate it.

Evaluate simple deterministic predicates before model wakeup. Waiting for input/approval waits on state/event, not repeated inference. Defaults are at most two eligible transient retries and three consecutive no-progress iterations; then report a typed blocked/failed outcome. Do not loop on authentication, invalid input, permission denial or unknown effects.

Unchanged checks are silent. Changed/failed/blocked results follow the approved destination and notification policy. The outbox deduplicates occurrence + semantic notification identity; delivery retry does not rerun research or effects. Quiet hours are configurable; only explicitly approved urgent classes bypass them.

Global `pause` durably blocks autonomous/background dispatch and requests cancellation of its active descendants; conversation and recovery remain usable. `stop all execution` also blocks user-requested effect dispatch. Granular pause targets a job/run/grant. Resume is explicit; missed observations coalesce. State what already happened, what was cancelled and what remains unknown. Do not claim revocation reverses a submitted remote effect.

### 5.4 Coding delegates

Substantial repository/script work is delegated. Resolve the configured delegate at dispatch; if only one is configured, use it. A missing/unhealthy sole delegate produces setup guidance or a partial result, never a silent alternative. Fallback delegates and providers are separate settings, both explicit; new data destinations require consent.

Handoff only goal, action/run ID, workspace/base revision, selected rules/skills, allowed effects, budget and acceptance conditions. Return session handle, lifecycle events, artifacts/diffs, verification evidence, structured errors and usage availability. Credential references or delegate-managed auth remain outside prompt text. The core verifies changed artifacts/tests before completion; merge/push/deploy are separately governed effects.

Prefer one maintained ACP client with existing bridges when approval/cancel/resume/fencing contracts pass. Use supported native SDK/protocol adapters for demonstrated gaps. The initial conformance targets are Codex and OpenCode; they are not declared supported until real release-pinned tests pass. Claude Code, Grok Build and Antigravity remain named later support targets, not discarded functionality. Do not build five independent integrations merely to claim breadth.

After partial work, retain artifacts and reconcile/resume. Before fallback, terminate or fence the old writer and reread current grants/rules; an unknown remote writer blocks a successor. A child saying complete without required evidence remains unverified. Delegate autonomy must fit an enforceable resource envelope; unsupported permission semantics disable that effectful mode rather than silently trusting the delegate.

### 5.5 Transports, identity and onboarding

Only the paired owner can mutate personal state, approve effects or link accounts in v0.1.0. Require proof of both Discord and Telegram accounts using a short-lived one-use challenge. Shared identity shares allowed personal memory, not conversation histories. Shared-channel responses use channel/project-approved data only; personal recalled facts require explicit sharing. Other group members have no implied approval authority. Broader group collaboration remains later.

Discord requests already in threads stay there. Parent-channel requests create/use the deterministic conversation thread before execution; permission/deleted-thread failures become routing errors with no silent parent-channel fallback. Telegram retains chat/topic IDs and deduplicates update IDs. Names never replace immutable route/actor identifiers. Approval callbacks bind actor, exact action/grant digest, expiry and destination; replay/forwarded approvals fail.

Render text, code, links, artifacts, concise progress and action requests using platform formatting/limits. Keep tool traces and internal metrics out of normal chat. Verify delivery receipts separately from queue admission; uncertain send acknowledgement must not trigger blind duplicates. CLI recovery works if both transports fail.

Wizard: explain platform/access and availability → secure provider setup → primary/fallback selection and connectivity → one selected transport pairing and real reply → optional delegate connection → proactively offer optional calibration. The other transport remains connectable afterward. Explain cheap/strong/task/provider routing as later configurable choices; do not force budgets or routing complexity into initial setup. Missing integrations trigger capability discovery/reuse research before an inability claim or new code. Never install discovered code automatically.

## 6. Execution, authorization and secrets

Broad shell/filesystem capability remains the owner's product preference. Broad availability is not permission for a model-owned process to mutate the entire personal host. The unresolved physical conflict is explicit: unrestricted writable shell and general network credentials cannot coexist with guaranteed pre-effect destructive approval. The OS spike proved only Linux filesystem confinement of a child, not a complete cross-platform security solution.

**v0.1.0 implementation baseline, not a claim of a new owner approval:** expose shell and broad user-selected host/project resources through mediated capabilities; ordinary discovery/read tools are available without per-command prompts within the established access envelope. Keep canonical state, secret backends and unrelated private resources outside worker mounts/handles. Do not enable unrestricted personal-host workers or describe advisory command filtering as enforcement. Onboarding explains actual access and lets users restrict it. If interpreting “broad by default” as unconditional raw host mutation is required, that specific profile remains blocked by D1; it does not block building this enforceable architecture.

Run general shell/delegate commands in disposable writable workspaces/snapshots with only required readable inputs. Changes to real user resources go through a checked commit/apply operation; a reviewed grant can cover ordinary project edits. Existing-file deletion, force-push, destructive infrastructure and irreversible external actions require explicit scoped approval unless an existing explicit grant safely covers that exact class/resource. Deleting inside disposable scratch does not authorize deleting the source repository. Arbitrary command-string classification is insufficient; enforce what resources/effects the process can actually reach.

The gate validates canonicalized resource/host/cwd, typed operation/parameters, owner and scope, current grant/revocation revision, rule constraints, budget, lease/fence and approval binding immediately before dispatch. Avoid path-check/use races with OS-supported handles and confinement; test symlinks, traversal, proc/descriptor/socket and network escape. Concurrent write rights require a fence that the resource boundary enforces, not just a SQLite lease timestamp.

Network is capability-scoped. Generic sandboxed shell has no ambient outbound access/credentials; model and external-service calls use narrowly authorized adapters or a controlled egress mechanism. HTTP/browser/MCP mutations carry method/action, endpoint/resource and parameter constraints; a GET label alone does not prove an effect is harmless. Unknown side-effect classification requires approval or remains disabled. Redirects, private-address access and DNS changes must be checked by the chosen maintained network mechanism.

Use existing OS confinement/runner mechanisms on both platforms. Linux Landlock is an available filesystem primitive at the tested kernel, not the entire sandbox. Use a maintained macOS execution backend; validate its actual filesystem/network/process guarantees during implementation. Backend installation failure or unsupported rights fails closed for affected execution while read-only conversation/recovery continues. Platform parity is a release gate. A launch agent, same-user child, Rust binary or TypeScript type does not itself constitute isolation.

Secrets use OS Keychain/Secret Service or an established external vault integration. Wizard input is masked CLI/SSH or supported provider OAuth/device flow. Store references and availability in config; resolve least-privilege credentials only at the relevant execution/provider adapter. Do not inherit all environment variables, auth directories, browser profiles or descriptors into children. A capability's arbitrarily named synthetic credential must remain inaccessible to unrelated capabilities. Redact before logs/artifacts/export; do not depend only on recognizable key-name patterns.

If a key source is locked/unavailable at restart, enter `locked`/waiting-for-unlock and pause dependent effects; never silently fall back to plaintext. An unattended service needs an explicitly configured unattended key source. Backups exclude credentials by default; reconnect after restore, using established encryption tooling for confidential exports. No homemade cryptography or implicit recoverable master key.

## 7. Runtime, state and capability contracts

### 7.1 Ownership and data model

Use embedded SQLite for transactional operational records and an independent user-state directory for configuration, skills, source-linked memory and content-addressed artifacts. Do not store live user state in the release checkout. Use explicit schema versions and one mutation API shared by CLI/chat; no second configuration writer inside integrations.

| Record | Required fields / ownership |
|---|---|
| Owner/project/conversation | Stable IDs, resource roots, transport binding, explicit sharing/link proofs |
| Behavior/procedure/grant | Stable ID, owner/scope/type, value or content ref, source, expected revision, current revision/status, supersedes/undo link; grant operation/resource/destination bounds |
| Run | ID, parent/root, owner/project/conversation, goal/done conditions, status, budgets, current checkpoint, required-child set, cancellation epoch |
| Action | ID, run, capability/version, proposal/input digest, requested resources, decision/grant/rule revisions, lease/fence, dispatch/receipt/verification refs, outcome |
| Job/occurrence | Job ID, schedule/timezone, procedure/grant refs, pause state; unique occurrence ID, due/coalesced times, run linkage |
| Inbox/outbox | Transport-origin dedup key, route/actor; notification/effect identity, payload ref, destination, attempts, platform receipt/unknown status |
| Artifact/memory | Owner/scope, type/hash/ref, source/retention/sharing, independent archive-preservation checkpoint |

Use a small append-only change/audit journal plus current rows, not full application event sourcing. A single transaction commits rule changes and their history; emit acknowledgements only afterward. A run/action ID cannot be changed by engine output.

### 7.2 Execution and truth transitions

Persist an action as proposed/prepared before dispatch; validate → authorized/waiting-approval/denied → dispatched → executed/failed/cancelled/unknown → verified/unverified as applicable. Delivery is a separate pending/delivered/failed/unknown record. Run terminal outcomes include completed, partial, failed and cancelled; waiting/blocked/unknown remain visible states requiring recovery, not optimistic completion.

Before sending an external effect, persist its intent/idempotency key. If receipt is lost or the process crashes after submission, recover as unknown and reconcile by supported API/resource evidence. Retry only idempotent or proven-not-dispatched effects. Do not promise atomicity between SQLite and an arbitrary remote service. A delivered response cannot prove execution; a delivery failure cannot erase successful execution.

On startup, acquire instance ownership, reconcile unfinished runs/actions/leases, recover the outbox and coalesce jobs before allowing new work. A dead worker's prepared action is interrupted, not assumed successful. Maintain process groups/handles for cancellation and exit collection; record background exceptions and close owned MCP/browser/delegate resources. Do not let a dead model call block pause/health/control processing.

### 7.3 Small adapter contract

Each capability describes ID/version, concise index entry, lazily retrievable input schema, output/artifact contract, action class, resources/secrets, platform support, timeout/cancellation, idempotency/reconciliation and usage availability. Runtime validation is mandatory. Proposal fields cannot directly select executable paths, elevate grants or supply authoritative terminal status.

Adapter results include stable action identity, success/error/unknown, typed error class, actual receipt/evidence/artifacts, retryability and cancellation status. Provider errors distinguish auth, quota/rate, timeout, invalid request, unsupported feature and transient transport failure. An error-shaped text string is not a successful model message. Tool-local retries must consult current authorization before another effect attempt; providers may retry safe inference only within the same root budget and configured data destination.

### 7.4 Context and efficiency

Build model context from a stable tiny contract, selected current rules, durable task checkpoint, relevant recent conversation, source-linked memory and only necessary skills/schemas. Keep an indexed capability discovery tool available so omitted schemas can be found. Cache stable serialized fragments by version/hash, invalidate on relevant state change, and preserve provider-specific cached/continuation semantics through a thin adapter. Never drop required reasoning/replay structures to manufacture a token win.

Assign context lifetime: release/session contract, durable selected behavior, run state, turn-only facts, tool result or artifact. A fresh turn must not inherit expired instructions; remote continuation that cannot remove obsolete context needs supported reconstruction. Durable state is not the whole transcript. Compact before hard limits, preserve raw evidence first, and verify cursor movement.

Initial engineering defaults, configurable outside onboarding: at most 20 model requests/run; two eligible transient retries/action; three no-progress iterations; 60-second ordinary tool deadline with capability-specific overrides; 64 KiB captured textual tool result with at most 8 KiB promoted inline; 6,000 selected-schema tokens; 1 MiB aggregate serialized model-request ceiling or the provider's lower documented limit. Reserve output capacity and fit total effective input to the configured provider context window; no assumed universal model context size. Artifacts remain recoverable by reference. Defaults are not claims of ideal settings for every model.

Root budgets aggregate helpers, provider retries and delegates. Token limits are always available via estimates plus reported usage where present; monetary limits are enforced only with known pricing/usage, otherwise use configured conservative token caps and disclose unknown cost. Do not claim a cost cap that an unmetered delegate can bypass; constrain its lifecycle or disallow that budgeted mode. Record cached input separately from uncached usage and generation, and attach all accounting to exact requests. Do not hardcode the spike's 521-byte prompt as a product ceiling.

## 8. Reuse/port implementation plan

Every capability implementation begins with a short source-inspection/reuse note: inspected Nanobot/Hermes files/commit, useful pattern/failure invariant, adopted package/protocol, copied lines/notices if any, rejected coupling and required contract tests. This is implementation due diligence, not reopened foundational discovery. Pin dependencies/bridge versions before integration and retain a lockfile/SBOM. Current package versions are selected and validated during implementation, not inferred from dated research.

| Area | Default implementation direction | What remains owned |
|---|---|---|
| Model/provider | Bun fetch for the tested compatible path; maintained official SDKs for provider-specific semantics; initially the compatible chat/tool API plus Anthropic Messages via a maintained SDK | One runtime loop, normalized typed results, usage/context lifetimes; no giant custom SDK |
| Discord/Telegram | discord.js and grammY candidates from Discovery; inspect existing route/render/recovery adapters first | Binding, actor authority, inbox/outbox, approvals |
| Browser/search/HTTP | Bun HTTP + static `web.fetch` complement; pluggable browser session providers (Playwright, CDP, browser MCP — Hermes-style seam); configured search API/client; inspect Nanobot/Hermes extraction patterns | Capability grants, backend registry/probes, evidence, isolated profiles, budgets; Playwright is first conformance target, not exclusive |
| MCP | Maintained official TypeScript SDK; follow Hermes progressive discovery and lifecycle lessons | Indexed readiness, schema budget, process ownership, current authorization |
| Skills/memory | Agent Skills format, SQLite FTS, maintained parsing/file utilities; inspect both loaders/compaction fixes | Scope/type/provenance/activation and preservation cursor |
| Jobs | Maintained cron/timezone parser and OS timers for daemon availability; adapt scheduler recovery patterns | Small job/occurrence/lease ledger; no imported runtime/scheduler service |
| Delegates | Maintained ACP client/bridges first; supported native interfaces for gaps | User selection, grants, cancellation/fencing and verified outcomes |
| Sandbox/secrets | Maintained OS launcher/backend and established key store clients | Policy/resource envelopes, probes, receipts; Rust only if measured necessity |
| Onboarding/CLI | Existing TS prompt/parser libraries; adapt Hermes explanations/navigation and useful OpenCode patterns | Product choices, one config mutation path, recovery |
| Install/update/backup | Bun release artifacts, OS service primitives, maintained signature/encrypted-backup tooling | Compatibility manifest, staged activation and durable state/revocation preservation |

This table selects integration directions, not unverified package certification. The project-owned licensing baseline is [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) as an engineering recommendation for the initial build; the owner has not separately selected a license. Confirm compatible notices and final license text before public distribution. Do not import incompatible code to meet a milestone; reuse its protocol/behavior or another compatible component. This is a distribution gate, not a reason to restart architecture work.

## 9. Platform, installation and recovery contract

Implementation test matrix: Ubuntu 24.04 LTS-class Linux with a supported confinement backend, x86_64 and arm64; macOS 14+ on Apple Silicon and Intel. These are initial engineering targets, not platforms already validated by the spikes. Publish exact minimum versions/backend capabilities after passing release tests. Both Linux and macOS must pass before claiming v0.1.0; no silent Linux-only launch or unconfined macOS fallback.

Use a small auditable curl-download bootstrap with authenticated, version-pinned release artifacts and a documented download/inspect alternative. Verify publisher signatures against a pinned trust root; checksums alone are insufficient authentication. Detect OS/architecture, install immutable release files without root by default, and validate dependencies lazily for configured capabilities. Never execute mutable repository main as an updater.

Use systemd user service on Linux and launchd user agent on macOS through thin native integration. Local macOS availability means awake and logged in with required credentials unlocked; no sleep/pre-login execution promise. Explain missed checks and coalesced wake recovery. An always-on Linux host is an optional deployment path, not multi-machine orchestration. On headless Linux, explicitly explain user-service availability/lingering and unattended secret setup.

CLI must support onboarding, run/chat recovery, doctor, inspect config/rules/grants/jobs/actions/delivery, pause/resume, backup/export, restore, update and version. Ordinary operation should not require reading a database or patching a prompt file. Uninstall removes application/service files by default, preserves user state, and requires an explicit separate purge to delete it.

## 10. SemVer and durable upgrade contract

The first release is **v0.1.0**, following [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html). Use `v0.1.0-alpha.N` for internal validation if useful; this does not weaken the v0.1.0 contract. Patch versions fix defects without intended compatible-interface/config behavior breaks. Minor versions add capabilities or documented pre-1.0 interface changes with explicit migration/deprecation handling. v1.0.0 denotes a stabilized public interface/support contract; subsequent breaking public changes require a major version. Pre-1.0 numbering is never permission to discard user state. Released artifacts are immutable; a changed artifact requires a new version. Declare the public compatibility surface explicitly: CLI/config, exports/state migration, and documented capability/delegate contracts.

Version application, state schema, config schema, capability/adapter contract and procedure revisions separately. Every release manifest declares supported source schema versions, upgrade path, read/write compatibility, extension/protocol versions and permission implications. v0.1.0 includes a versioned baseline schema and migration harness tested with synthetic predecessor/next-version fixtures; do not pretend a previous production release exists.

Upgrades MUST preserve stable identities, rules and explicit prohibitions, grants and revocations, config intent, scopes/sharing, skills and pinned versions, memory/source refs, jobs/occurrence IDs, run/action truth, outbox receipts and retention policy. User customization lives outside immutable program releases. Preserve unknown namespaced extension configuration through supported round trips; validate known keys rather than silently resetting the file. A changed default cannot overwrite an explicit user value.

Upgrade sequence: verify artifact/manifest → check compatibility/space/permissions → quiesce and fence writers → make a consistent SQLite/content snapshot → migrate a staged copy → run schema/authority/route health checks → atomically activate release/state generation → probe effective access → resume eligible work. Keep the prior compatible release and recovery instructions. Every writer must preserve either valid old state, valid new state, or an explicit recoverable failure; no partial parse causes a fresh blank profile.

Auto-download/check is optional; activation is an explicit or previously approved maintenance action. Do not migrate a live database while an old worker can mutate it. On migration/health failure, stay on the original state/release. Binary rollback is allowed only within declared schema compatibility; otherwise require matched snapshot recovery and reconciliation of external effects since that snapshot. Never silently downgrade a schema or revive revoked grants/jobs from backup.

Restore on another machine starts execution paused. Validate export manifest/schema and scopes; reconnect credentials and revalidate routes/permissions before resuming. Keep post-snapshot revocation/delivery information when recovering in place; where unavailable, require explicit reauthorization and reconciliation. No blind replay of previously sent messages or unknown external actions. Use established encryption and SQLite backup/snapshot facilities; copying only a live WAL database file is not a backup contract.

## 11. Incremental delivery and release sequence

Build the **full initial product** as **v0.1.0** in vertical increments on one branch (`feat/v0.1.0`). Use real integrations only after the gate they require exists. No increment is a separately weakened product promise. **Do not tag `v0.1.0` until increment 0.1-I completes** with the release evidence in §14.

| Increment | Deliverable | Exit evidence |
|---|---|---|
| 0.1-A | Repository docs/governance and Bun scripts/CI skeleton; Bun runtime, schemas/storage, owner/project binding, correction/provenance/undo, fixture provider and CLI | Source and local compiled smoke test; state/scope/concurrency/correction tests; upgrade harness initialized |
| 0.1-B | Capability index, gates, sandbox/secret backend integration, shell/files/artifacts and provider normalization | Denied-resource/secret tests on both OSes; typed errors and no fake completion |
| 0.1-C | Thin web/search/browser/HTTP/MCP and Codex/OpenCode delegate adapters | Real configured smoke/conformance tests, budgets and cancellation/fencing |
| 0.1-D | Durable jobs/triggers, inbox/outbox, Discord/Telegram, explained wizard/calibration | Quiet recurrence, duplicate/restart/delivery/approval/route tests |
| 0.1-E | Packaging, signed upgrade/restore, backup/restore, global pause, docs, deterministic fixture-backed A-gates | Install/update/restore/pause tests; support matrix and notices; Linux CI |
| 0.1-F | Optional Honcho adapter; broader validated providers/delegates; stronger authenticated-browser connection workflows | Local operation with Honcho absent (A29); real Honcho outage/upload/deletion tests when enabled; `PRODUCT_RESEARCH.md` evidence refreshed as needed |
| 0.1-G | Configurable cheap/strong/task/agent/provider routing; richer token/monetary/tool/delegate budgets; advanced skill consolidation; more complex reviewed recurring writes | Routing/budget/skill/recurring-write acceptance tests; basic safety budgets from 0.1-C remain baseline |
| 0.1-H | Bounded helper fan-out and additional integrations only with inherited authority/resource ownership; remote execution/composition if justified | Fan-out ownership/cancel tests (extends A42); no commitment to rebuilding a framework |
| 0.1-I | Release evidence and publication | All applicable A01–A46 gates; §14 held-out eval, timing/schema-growth budgets, five-user check; four-target artifacts; signing/notarization; tag `v0.1.0` |

After v0.1.0 ships:

- **v1.0.0:** stabilized contracts after real usage and upgrade evidence. Teams/multi-owner policy and multi-machine scheduling are separately scoped later initiatives, not assumed features of 1.0.

Out of initial scope: general UI, marketplace, custom browser/vault/cryptography, generic workflow/policy DSL, model training, agent-written core modifications, mandatory Rust, foundational Nanobot/Hermes embedding, universal exactly-once remote effects, autonomous trading/payments, uncontrolled extension installs. These exclusions do not remove the broad useful capabilities listed in section 4.

## 12. Owner-decision reconciliation

The latest owner direction resolves architecture and authorizes a buildable PRD. Do not ask again about D3/D7/D8/D11 or the three outcomes. Historical unresolved entries are not retroactively claimed to be owner approvals. The following are explicit PRD implementation baselines under the instruction to finish, with existing conflicts kept visible rather than new decision questionnaires.

| ID | Final disposition |
|---|---|
| D1 | Broad capability preference retained; enforceable mediated baseline in §6. Unrestricted personal-host mutation plus absolute destructive interception remains an incompatible, unsupported profile; not a reason to block the first build. |
| D2 | Linux/macOS day one retained; technically assisted personal users and explicit test matrix in §9 are build targets, not already measured support. |
| D3 | Resolved owner choice retained: CLI/SSH masked input or provider OAuth; no secret page/general UI. |
| D4 | Engineering baseline: OS/external key source, locked state when unavailable, explicit unattended provisioning; no silent plaintext fallback. |
| D5 | Linking/shared personal memory/separate history retained; owner-only authority and explicit shared-channel disclosure are initial implementation policy. |
| D6 | Approved recurrence retained; research/notifications/local artifacts plus explicitly granted reversible mutations. Complex unattended/destructive external workflows remain later. |
| D7 | Resolved explicit persistence/conservative inference/automatic skill dedup/history retained; adjustable activation defaults in §5. |
| D8 | Resolved quiet unchanged checks, missed-run coalescing and prompt relevant pause retained. |
| D9 | Modular sole choice/fallback retained; Codex/OpenCode conformance first, named others later; optional Honcho in increment 0.1-F. No unsupported delegate is advertised as working. |
| D10 | Three outcomes retained; engineering release thresholds in §14 make them testable, not retrospective owner-approved performance promises. |
| D11 | Resolved local-first, optional remote, configurable retention/export/provenance retained. |
| D12 | Foundation question resolved by latest owner: native Bun; references only for Nanobot/Hermes; Rust optional. Fully open-source retained. Apache-2.0 is a recommendation pending final redistribution/license clearance. |
| D13 | Engineering availability baseline: awake/logged-in local macOS plus coalesced recovery; optional always-on host; no pre-login/wake-management promise. |
| D14 | Engineering control baseline: pause autonomy; separately stop all execution; retain recovery; explicit resume. |

No new owner decision or architecture experiment is required to begin implementation. Existing D1's unsupported profile and D12's final license text are explicitly preserved limitations; the latter must be settled before public distribution. OS sandbox coverage, delegates, provider compatibility and signed packaging are implementation acceptance work. If a backend cannot meet the declared invariant, block that release path and raise the specific evidence; do not reopen the settled foundation merely because integration work is difficult.

## 13. Acceptance scenario traceability

All A01–A46 from Discovery are retained below. Unless specifically noted, each is a v0.1.0 release gate (verified at increment 0.1-I). Product claims are not satisfied by the architecture spikes. Rows involving absent optional integrations require local/default behavior in earlier increments and the integration-specific variant in the owning increment (for example Honcho in 0.1-F).

| ID | Trigger | Required observable outcome |
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
| A33 | Linux/macOS install, interrupted config write, update and restart | Durable valid old/new state or recoverable failure; effective OS permissions/current grant revision checked before execution; explicit reauthorization if needed; no silent downgrade (I10, Codex #26421/#28574, Hermes #52010) |
| A34 | Optional calibration modes combined or skipped | First use works without calibration; import cannot grant actions; user sees/corrects what persisted |
| A35 | Missing capability and API-key-only integration | Inspect/research reuse first; useful partial output; CLI/OAuth credential path; no raw key in conversation |
| A36 | Global pause during cron/delegate activity | Scope follows D14; durable pause blocks next dispatch; in-flight/unknown effects explained; explicit resume |
| A37 | One configured delegate, then configured fallback | Sole choice honored; no built-in vendor preference; fallback waits for stop/fencing; explains selection |
| A38 | Meaningful correction vs ordinary conversation | Only durable behavior/permission changes enter version history; specific undo preserves unrelated rules |
| A39 | False deterministic condition; then a task waiting for input | Zero LLM requests while false/waiting; approved matching signal wakes once; bounded no-progress retries and restart-safe dedupe. Nanobot #5510/#5256, I5 |
| A40 | Long session with constant contract, fresh time and turn-only context | Contract stored once; expired rider absent from subsequent effective input; provider-state resume and stateless rebuild are semantically consistent; required unfinished-loop reasoning retained. Nanobot #5586/#5584, Hermes #10421, I6 |
| A41 | Large MCP/skill registry; required tool initially omitted | Only selected schemas within configured budget; discovery can recover every seeded necessary tool; direct ungranted calls remain blocked; no full-registry budget bypass. Nanobot #5298, Hermes #4379, I8 |
| A42 | Background exception/required child outlives parent; repeated MCP reconnect with live parent | Durable failure/unknown and parent ownership survive; no parent success before required aggregation; owned MCP instances are reused/disposed within declared bounds; recovery control remains responsive. Nanobot #5429/#4290, Codex #38754/#44401, I3 |
| A43 | Project A reads then replaces its scoped memory collection | Project B's unshared datum cannot be retrieved, overwritten or deleted; explicit shared datum remains available; scratch and retained deliverables differ. Hermes #34352, Nanobot #5276, I1 |
| A44 | Capability A owns a synthetic arbitrarily named credential | Unrelated shell/delegate/MCP/background/PTY and restored snapshot cannot obtain it through environment, files or handles; control-state writes denied. Hermes #82936, Nanobot #5278, I2 |
| A45 | Oversized archive batch and interrupted preservation | Unique tail marker preserved or cursor stops before it; retry has no silent hole, including oversized single message/raw fallback and crash between preservation and cursor commit. Nanobot #5377, I7 |
| A46 | Images/artifacts fit token estimate but exceed aggregate serialized budget | Pre-dispatch byte guard uses actual request representation; bounded reduction/references retain recoverable evidence; retry cannot resend oversize forever; usage estimate/report discrepancies attributed to exact request. Codex #43015, Nanobot #5402, I6 |

Clarifications to inherited scenarios: A14 prevents new dispatch after committed revocation; already-submitted effects are cancelled where possible and otherwise reconciled explicitly, not claimed to be reversed. A05 uses any configured supported alternate in live release tests; the original Grok example can use a deterministic adapter fixture until that named integration is supported. A29 requires disabled/absent Honcho with full local functionality in increments before 0.1-F; real Honcho outage/upload/deletion tests gate 0.1-F. A36 uses §5's explicit pause/stop-all semantics. A40 requires semantically correct context lifetime rather than any specific upstream continuation API. A42 covers delegate/process/MCP ownership in 0.1-A–E; bounded helper fan-out extends it in 0.1-H. A26/A44 test the actual enforced profile on each platform, never a prompt-only simulated denial.

## 14. Release verification and definition of done

No new architecture experiment is required before coding. Former E2–E8 hypotheses become implementation validation packages: execution/secret isolation; scheduler recovery; delegate conformance; dual-platform install/update; context/quality/usage; transport identity/delivery; and wizard usability. Run them on disposable repositories, synthetic secrets and authorized test accounts during implementation, never against Nancy/Abi production state. Architecture-spike assertions are supporting evidence, not substitutes.

Engineering acceptance thresholds for v0.1.0:

- Every applicable A01–A46 deterministic/state/authorization/routing regression passes; zero denied or revoked effects in the adversarial suite, zero cross-scope secret/memory leakage, zero silent state loss, and zero fabricated success. Every supported execution path must appear in the boundary coverage matrix.
- At least 100 held-out conversational correction/scope cases spanning explicit, ambiguous, run-only, conflicting and malicious quoted instructions: at least 95% correct commit/clarify/decline behavior, plus zero permission expansion or prohibited effect. Report model/provider versions, prompts, denominators and failures. This is a release target, not a claim that the mock spike proved model quality.
- At least 20 observations per measured timing case, separate cold/warm results and real-provider versus scripted-fixture results. For the tiny proposal/control fixture on a documented reference host, target p95 owned control/IPC overhead at most 50 ms excluding model/network/capability work. Report durable-storage cost separately. Do not disable durability, remove useful capability discovery, or switch model quality to manufacture a pass.
- Adding 100 unrelated indexed skills/capabilities must not inject their full schemas/content; effective token count for an unchanged fixed task must grow by no more than 10% over its matched small-registry baseline. Recover every seeded required capability through discovery within configured budgets. False/waiting triggers perform exactly zero provider calls.
- Exercise at least two pinned coding delegate implementations for sole choice, explicit override, partial edit, cancellation, unknown state and fenced fallback. Unsupported semantics remain unavailable rather than simulated success. Real browser/search/MCP/HTTP smoke tests and both transports must produce actual evidence/receipts.
- Both official OS families pass fresh installation, correction → new conversation → restart → staged upgrade → restore, interruption of config/state writes, permission drift, and process ownership. Test schema-incompatibility recovery and preservation of revoked grants and sent outbox records; do not infer future migration compatibility from an empty database.
- Five-user or technically assisted usability check across both OS families: all can reach a real chat, understand access and model fallback, make/explain/undo a correction, pause a routine and locate recovery. Record failures and address blockers; first-task speed is measured, not promised from mock startup times.

Release artifacts include executable/source, exact dependency locks/notices and support matrix, operator/user docs, first-run examples, capability readiness/limits, migration/backup/restore instructions, known limitations and acceptance evidence. The dependency review must verify license/maintenance and the interfaces actually used; it is not a new foundational bakeoff. Native fetch is sufficient for the tested slice but may be supplemented by maintained SDKs as required by supported providers.

Implementation may proceed through the increments in §11 now that the PRD exists. Tagging and shipping **v0.1.0** requires completing increments 0.1-F through 0.1-I plus the release evidence above. Do not turn an unavailable macOS sandbox, unusable delegate cancellation or unverified external effect into an exception to the product contract. A concrete failure can block that implementation/release path without reopening resolved owner preferences wholesale.

## 15. Documentation and evidence ownership

`PRD.md` is the normative product/initial-build contract. `PRD_INPUT.md` is the reconciled handoff index. `DISCOVERY.md` retains dated research, owner history, issue analysis and the architecture closure record. Spike reports preserve exact code counts, fixtures, results and limitations. Do not describe historical issue status as freshly verified; the 39-issue snapshot remains dated 2026-09-11.

[PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md) is **required now and created**, superseding the earlier deferral. It preserves Nancy/Abi lessons, all 39 issue records with review status/dates, rejected hypotheses, E1/B/native/OS evidence, measurements/limits and the problem → evidence → hypothesis → experiment → result → invariant/acceptance chain. [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md) defines repository initialization, current pinned remote Nanobot/Hermes governance findings and Bun-first development/CI/release/install automation. It is the normative repository plan under this PRD, not implemented scaffolding. Stable I1–I10 and A01–A46 IDs remain authoritative; research aliases and G01–G05 add traceability without renumbering them.

The documentation task created no bot implementation, new architecture experiment, production change or service configuration.


## 16. Bun-first repository and delivery contract

**DEC-TOOLING-01:** prefer Bun-native primitives before adding build/test/deploy tooling. This is an implementation direction within the settled native runtime, not a new experiment. [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md) contains the full layout, verified documentation links, pinned upstream practices and release checks. Start with one package and `bun.lock`; use workspaces only when genuine separately consumed packages justify them. No default Docker, Rust, mandatory end-user Python/Node runtime or external orchestrator.

| Automation layer | Required v0.1.0 plan |
|---|---|
| Local development | `bun install`, `bun test`, `bun run dev`, `bun run build`, `bun run release`; repo-owned TypeScript scripts, Bun watch under controlled shutdown, Bun build/compile. Local release command prepares artifacts only. Add `tsc --noEmit` because Bun does not perform type checking. |
| CI | Frozen Bun lock, pinned Bun/Actions, Linux and macOS tests, required aggregate check, dependency/security and architecture-boundary checks. Untrusted PRs receive no secrets or publishing rights. |
| Release | Protected `vX.Y.Z` tag triggers checks and four-target builds, native execution tests, signing/notarization, final-byte checksums, source/notices, manifest, reviewed/generated notes and coordinated publication. Start at `v0.1.0`. |
| Installation/update | Tiny auditable curl/POSIX bootstrap because the user has no Bun yet; verified standalone Keli; Bun-authored `keli update` stages authenticated immutable artifacts and enforces §10. User state is outside the executable and install tree. |

Planned artifact names are `keli-darwin-arm64`, `keli-darwin-x64`, `keli-linux-x64`, `keli-linux-arm64`, respectively using documented `bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64` compile targets. Linux artifacts initially target glibc. The documentation review establishes compiler support, not Keli runtime/platform validation. The reference spikes used Bun 1.4.0; current documentation advertises 1.4.2, the planned initial toolchain pin pending compatibility tests. Every published target must pass actual artifact/backend tests; cross-compilation alone cannot satisfy §9 or §14. [Bun compile reference](https://bun.sh/docs/bundler/executables)

Prefer `Bun.spawn()` for child management, `Bun.$` for small trusted scripts, built-in SQLite/file/fetch APIs and established OS calls as needed. None replaces authoritative gates, atomic durable writes, explicit child environments or OS confinement. Prefer `Bun.secrets` behind the credential interface where compatible; it remains experimental and Linux needs a working secret service. Unavailable/locked sources pause dependent work under §6, with no plaintext fallback. Package native/system dependencies according to verified target needs. Optional browser/delegate/MCP dependencies are installed lazily and disclosed; they are not falsely advertised as part of a dependency-free executable. [Bun credential API](https://bun.sh/docs/runtime/secrets)

Keep release scripts and manifests reproducible from exact source/locks; do not promise bit-identical signed outputs without measurement. If a narrow Rust/system helper later becomes necessary, conditionally compile it in the same native CI matrix with pinned toolchain/lock, versioned IPC and signed/checksummed artifacts. Ordinary Bun development must not require Cargo unless working on that component. Bun cross-compilation is not Rust cross-compilation, and a helper required for a platform's enforcement must be included for that platform.

The repository plan's G01–G05 checks supplement A01–A46: simple Bun workflow; protected complete artifacts; clean install/state-preserving recovery; verified review/credential boundaries; and reuse/evidence traceability. Configure the repository and a compiled smoke path during increment 0.1-A so release automation evolves with implementation, rather than being postponed until packaging week. Do not implement these workflows in the current documentation task.
