# Keli — PRD Input and Final Reconciled Handoff

Updated 2026-09-11. Architecture discovery is CLOSED. [PRD.md](../../PRD.md) is the final, buildable initial-product specification; [DISCOVERY.md](DISCOVERY.md) retains dated research, issue analysis, owner history and final spike evidence. This handoff supersedes the earlier Nanobot-first evaluation plan. No bot implementation or new architecture experiment was performed in this documentation task.

**Versioning note (2026-09-11):** the increment map in [PRD.md](../../PRD.md) §11 supersedes former v0.2.0/v0.3.0/v0.4.0+ milestones below (now 0.1-F/0.1-G/0.1-H/0.1-I). Historical wording in this file is preserved for traceability.

## Final owner direction

- Native Bun/TypeScript is the primary runtime and control plane. Own one bounded model loop, small context, necessary-only schemas, authority and outcomes.
- Use OS primitives for real execution restrictions. Rust is optional/narrow only when materially justified; no default Guardian or Rust subsystem. Elysia is not required without a demonstrated HTTP application need.
- Nanobot and Hermes are reference implementations and capability sources, no longer candidate foundational runtimes. Inspect their implementation first for each needed capability; adopt maintained libraries/protocols/integrations, then port thin useful logic as appropriate. Do not blindly translate projects, copy private patches or rebuild mature dependencies.
- Retain a broad capable product. A minimal BUILD means small coherent owned infrastructure, not abandoning browser/web/search/HTTP, MCP, shell/files, skills, memory, jobs/triggers, delegates, Discord/Telegram, model/provider support, onboarding/auth or recovery.
- Start SemVer releases at v0.1.0. Preserve user-owned durable state/configuration by contract across upgrades, including pre-1.0 changes.
- Latest addendum supersedes the earlier deferral: [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md) is required now and created as the durable evidence/issue record. [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md) records the current remote repository audit and initialization/automation plan.
- **DEC-NAME-01 (OWNER): Keli (כלי), lowercase `keli` for CLI/repo/packages/binaries.** Historical experiment paths/names remain unchanged.
- Prefer Bun package manager/lock, scripts, tests, build/compile and native APIs; small GitHub Actions wrappers. Plan four Linux/macOS artifacts with preserved external state and automatic protected SemVer-tag releases; no deployment implementation in this task.

## Product outcomes and accepted decisions

The three confirmed outcomes remain: correct once with scope/persistence across conversation/restart/upgrade; delegate coding according to user/project configuration; execute approved recurring/proactive research reliably and remain quiet when unchanged.

Linux and macOS are officially supported day one. Personal-first, teams later. Discord/Telegram are the initial transports; deterministic threads/topics, explicit identity linking, shared allowed personal memory and separate histories are retained. No general web UI. An explained interactive CLI wizard configures primary/fallback models and secure CLI/SSH masked input or provider OAuth/device auth. Advanced routing/budgets stay out of required setup. Offer optional guided/real-task/imported-summary calibration, explain what was understood and allow correction.

Explicit scoped instructions persist; clarify material ambiguity, keep inference conservative and lower authority, and never let a quoted/imported/tool instruction grant permissions. Automatic skill drafts/dedup are allowed; code or permission expansion is separately governed. Keep meaningful version/provenance history and granular undo rather than storing ordinary reasoning as policy. Explain why/why-not/what-changed from state and evidence.

New consequential behavior is proposed for approval unless already authorized; approved recurrence proceeds within its grant without repeated approval. Corrections/stop pause the relevant work. Runtime state owns jobs, coalesces missed observations and avoids false/waiting model wakeups. Useful partial results are preferable to unsupported success claims. Local-first memory, configurable retention/export and optional Honcho remain; remote memory is never operational authority.

## Final spike evidence

| Spike | Verdict | Measured evidence and limit |
|---|---|---|
| E1: Nanobot as foundational authority runtime | NO-GO at tested upstream pin | 281 Python LOC, 15 assertions; owned-tool correction lifecycle worked, universal enforcement did not. SDK strict ephemeral hooks worked; do not misstate their behavior. |
| B: owned Bun core + Nanobot child | GO WITH LIMITATION | 296 LOC, 22 assertions; authority/revision/undo/truth outside engine; median added control/IPC 13.07 ms; same-user processes remain unisolated. |
| Native Bun proposal slice | NATIVE BUN CLEARLY BETTER for tested role | New adapter 29 LOC; 13 assertions. One provider call each; request 521 vs 23,147 bytes, context 450 vs 8,929 bytes; full action 16.56 vs 185.71 ms; cold readiness 38.19 vs 1,883.59 ms. |
| Rust / OS-first execution | RUST OPTIONAL / OS PRIMITIVES SUFFICIENT | 176 source LOC, independent Python OS probe and 14 broker assertions; Landlock ABI4 child filesystem denial without Rust; IPC median 0.212 ms, p95 0.937 ms. |

Native comparison: 12 measured warm samples/arm after excluded warmup; three cold samples/arm; same scripted fixture. Common-tokenizer serialized full-request estimates were 131/5,017, not billed tokens. Native requires one Bun process and zero third-party model-slice packages; comparator environment had 89 distributions excluding pip, not a claim that all are needed. No live model intelligence, cache, macOS security, network isolation or compromised-controller protection was proved. Spike code is evidence, not production code. Reports: [E1](DISCOVERY.md#l19), [B](DISCOVERY.md#l20), [native](REPORT.md), [Rust](REPORT.md).

## Architectural invariants retained from issue research

I1: typed/storage-scoped authority and dedup. I2: identity is not ambient resource/secret authority; every effect gated. I3: durable ownership/lifetime/outcome for background tasks and connections. I4: proven exclusion/fencing before mutations. I5: zero-model false/wait states and bounded progress/retries. I6: explicit context lifetime and separate request-token/byte/artifact budgets with exact attribution. I7: preservation cursor cannot pass lost evidence. I8: rich discoverable capabilities with necessary-only schemas, independently authorized. I9: intent/dispatch/execution/verification/delivery/presentation are distinct typed facts. I10: crash-safe state/config and permission-preserving upgrades.

The 39-issue register remains a dated snapshot, not freshly verified issue status or evidence of frequency. Its lessons remain part of the product: archive integrity, context duplication, error-as-success, continuation amplification, ambient secrets, cross-process leases, macOS permission drift, aggregate bytes, MCP lifetime and config loss. No new issue research or architecture experiment is required to begin implementation.

## v0.1.0 scope and reuse

| Required initial capability | Small build / reuse direction |
|---|---|
| Runtime/models | Owned native Bun loop; compatible API via fetch, maintained provider-specific SDKs as needed; primary/fallback and typed failure/usage |
| Behavior/control | Transactional scoped rules/grants/provenance/undo and action/run/job/outbox truth; shared mutation API for CLI/chat |
| Discord/Telegram | Thin discord.js/grammY integrations; adapt route/receipt patterns, not runtime internals |
| Shell/files/artifacts | Maintained OS execution mechanisms, resource envelopes, sandboxed workspaces and checked apply/effect gate |
| Browser/search/HTTP | Playwright and maintained search/HTTP integrations; isolated profiles, bounded evidence and explicit authenticated connections |
| MCP | Maintained TypeScript SDK; local/remote supported transports, indexed discovery, lazy schemas, lifetime and grants |
| Memory/skills | SQLite FTS/source-linked local memory, Agent Skills-compatible files and scoped registry; dedup/versioning/preservation |
| Jobs/triggers | Maintained schedule/timezone parsing plus minimal owned occurrence/lease/coalescing state; no workflow framework |
| Coding delegates | Codex/OpenCode initial release-conformance targets, ACP/bridges first and native supported gaps; no vendor default overriding configuration |
| Onboarding/auth | Explained CLI wizard and maintained prompt/key-store/OAuth components; optional calibration; no ordinary chat secrets |
| Operations/upgrades | Linux/macOS service integration, signed release activation, CLI recovery, consistent backup/export/restore and durable schema migrations |

Every integration starts with a bounded inspection/reuse note and license/version/contract validation during implementation. Optional credentials/dependencies do not move the listed capability out of v0.1.0. No whole Nanobot/Hermes import or rewrite, no package-heavy framework just to connect a capability.

Later: optional Honcho adapter and more validated delegates/providers; richer authenticated browsing; advanced routing/budgets and skill consolidation; complex reviewed recurring writes; bounded helper fan-out; teams/multi-machine coordination separately scoped. Named Claude Code/Grok Build/Antigravity support remains in the product trajectory. None is advertised as validated without release evidence.

Out of initial scope: general UI, marketplace, custom browser/vault/crypto/workflow DSL, mandatory cloud/Rust/Python runtime, core self-modification, universal exactly-once effects and autonomous trading/payment workflows.

## D1–D14 reconciliation without reopening owner decisions

These dispositions distinguish confirmed owner policy from concrete PRD engineering baselines; a historical open question is not falsely relabeled as an owner approval.

| ID | Current disposition |
|---|---|
| D1 | Broad shell/files availability retained; PRD uses explicit mediated resource/effect baseline. Unrestricted host writes plus guaranteed destructive interception remains unsupported, not silently promised. |
| D2 | Linux/macOS day one retained; specific initial OS/CPU targets and assisted-user scope are implementation/release commitments in PRD §9. |
| D3 | RESOLVED owner choice retained: masked CLI/SSH or provider OAuth/device auth; no secret-entry page. |
| D4 | Build default: existing OS/external key source; locked/wait state when unavailable; explicit unattended setup; no silent plaintext fallback. |
| D5 | Linking/shared memory/separate histories retained; owner-only authority and explicit shared-channel disclosure are initial policy. |
| D6 | Scoped recurrence retained; research/notifications/artifacts plus explicitly granted reversible mutations; no default recurring destructive authority. |
| D7 | RESOLVED owner persistence/inference/skills/dedup/history policy retained. |
| D8 | RESOLVED owner quiet/coalesced recurrence and relevant pause retained. |
| D9 | Modular sole-choice/configured fallback retained; two named initial conformance targets, optional Honcho v0.2.0; broader targets preserved. |
| D10 | Three outcomes retained; PRD adds explicit engineering test thresholds, not claimed historical owner performance approvals. |
| D11 | RESOLVED owner local-first/optional-remote/retention/portability/provenance policy retained. |
| D12 | Architecture RESOLVED by latest owner: native Bun, references-only Nanobot/Hermes, optional Rust, fully open-source. Apache-2.0 is the PRD recommendation; final compatibility/license clearance gates distribution. |
| D13 | Awake/logged-in macOS with coalesced recovery; optional always-on host; no pre-login/wake-management promise. |
| D14 | Pause autonomous/background work; separately stop all execution; keep control/recovery available; explicit resume. |

No new owner decision or experiment blocks starting v0.1.0 implementation. D1's impossible unrestricted profile is explicitly excluded from security claims and D12's final license text still needs distribution clearance. A real inability to meet a platform/integration invariant blocks the affected release path rather than silently weakening it.

## Versions, upgrade contract and implementation sequence

Start at v0.1.0; internal alpha prereleases may precede it. Patches preserve compatible behavior, minor releases add scoped capability milestones, and 1.0 stabilizes public contracts. Pre-1.0 changes still require explicit migration/deprecation support. Version application, state/config schema, adapter contracts and procedures independently.

Keep immutable code separate from user-owned state/config. Preserve stable IDs, corrections, grants/revocations, explicit configuration, scopes/sharing, skills, memory/evidence, jobs, run/action/outbox facts and retention policy. Signed staged activation must fence old writers, snapshot consistently, migrate a copy and verify permissions before resume. Incompatible downgrade fails safely or uses matched snapshot recovery with effect/revocation reconciliation. Restore starts paused; no revived grants or blind duplicate effects. Uninstall preserves state unless separately purged. PRD §10 is normative.

Implementation increments: 0.1-A core/state/corrections; 0.1-B gates/resource/secret isolation; 0.1-C thin capability/delegate integrations; 0.1-D jobs/transports/wizard; 0.1-E dual-platform packaging/upgrade/acceptance. Each has exit criteria; the shipped v0.1.0 includes all required capability paths.

v0.2.0 targets optional Honcho and broader validated integrations. PRODUCT_RESEARCH.md is created now; maintain its dated evidence as implementation progresses. v0.3.0 targets advanced routing/budgets/skills and recurring-write depth. Later versions may add bounded helpers and separately scoped teams/multi-machine features. Milestones are sequence, not dates or a promise to rewrite existing agent capabilities.

## Acceptance and readiness

All **A01–A46** are preserved in PRD §13. A29's local operation with Honcho disabled is a v0.1.0 gate; real optional Honcho failure tests gate its later adapter. A05's Grok example does not silently require unvalidated launch support: exercise a configured supported alternate or fixture. A36 uses explicit pause/stop-all semantics; A42 covers delegate/MCP/process ownership now, general fan-out later.

Former E2–E8 requirements are now implementation validation work: actual dual-platform boundaries, job crash/recovery, real delegate conformance, install/update/restore, held-out model behavior/efficiency, transport lifecycle and wizard understanding. No new foundation experiments are required. All deterministic invariants must pass; zero unauthorized effects/state loss/false success; at least 95% on 100 held-out correction cases; declared timing/schema-growth budgets and five-user assisted onboarding validation. These are engineering release targets, not results already achieved.

**PRD complete; next step is implementation of v0.1.0 under PRD.md.** Product implementation, production changes and additional architecture experiments were not performed in this documentation task. PRODUCT_RESEARCH.md and REPO_GOVERNANCE.md are complete documentation deliverables now. PRD §16 and governance G01–G05 cover Bun tooling, repository review and automated releases.


## Bun-first implementation handoff

Start repository `keli` as one Bun package, adding workspaces only when justified. Plan `bun install`, `bun test`, `bun run dev`, `bun run build`, `bun run release`; local release preparation does not publish. Bun provides runtime/package management/tests/build/compile; TypeScript checking and platform signing are justified separate tools. Native CI tests every published `keli-{darwin,linux}-{arm64,x64}` target and preserves compatible state on updates/rollback. Prefer Bun SQLite/file/fetch/spawn/shell; credential storage uses a narrow interface with Bun.secrets only where its experimental/platform constraints pass. Bun documentation supports the proposed compiler matrix, not a proven macOS sandbox. The experiments used 1.4.0; planned tooling pin is 1.4.2 pending compatibility tests.

The repo plan separately defines local, CI, release and install/update automation; begins compiled smoke/CI in 0.1-A; includes minimal issue/PR forms, private reporting, sensitive-path owners, required checks and SemVer-tag artifacts. Optional Rust/system helpers join the same workflow only when needed and do not burden ordinary Bun development. See [REPO_GOVERNANCE.md](REPO_GOVERNANCE.md). No new unresolved owner question is introduced by these implementation defaults.
