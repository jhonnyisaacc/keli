# Plan: complete Keli's capability integrations without diluting its autonomy core

Status: implementation plan for `feat/v0.1.0`, baseline `021ca10`. This plan replaces the
old "first-use only" stop and the unbounded provider-parity draft. It keeps the existing
responsibility, evidence, and authority architecture and gives Cursor a finite sequence of
vertical implementation slices.

The goal is a product that people can set up by selecting the connections they need and that
can carry an approved responsibility across those connections. A provider means any
interchangeable capability backend: inference, search, memory, browser, documents/OCR, speech,
MCP, transport, delegate, or background execution. Hermes and Nanobot are reuse sources only;
their protocols, option shapes, and stable integration ideas may be adopted and adapted, but
their agent runtimes, state stores, and policy loops do not enter Keli.

Keli owns investigation, coordination, evidence contracts, and durable behavior. Adapters return
proposals and evidence. Only `src/core/gate.ts`, `src/core/capability-gate.ts`, and
`ResearchResponsibilityService` in `src/core/behavior.ts` can authorize actions or commit
terminal behavior. Adapters must not write canonical behavior state or mark research verified.

Rocket and portfolio management are acceptance scenarios for a general-purpose product. Rocket
is an optional external tool profile; wallet discovery, chain support, valuation, and financial
calculations stay outside Keli. A passing Rocket scenario demonstrates the controller's behavior
under realistic evidence gaps. It does not make Rocket a product dependency or turn Keli into a
portfolio application.

## Review corrections to the previous draft

- Do not use machine-specific home paths in tracked plans, fixtures, or docs. Refer to pinned
  source commits and configurable roots such as `KELI_HERMES_ROOT`.
- A catalog entry is inventory, not a working adapter. Every row needs a protocol mapping and a
  status (`catalogued`, `configured`, `fixture-verified`, `live-verified`, `blocked`, or
  `excluded`). Do not claim that all rows are implemented because they construct successfully.
- Keep one manifest. Rename the existing Hermes-derived snapshot only in a mechanical migration
  that updates every import, test, and attribution; never maintain two diverging catalogs.
- Do not add `service` or `composition` to the integration kind merely to make the inventory
  complete. Services are lifecycle commands, and composition is a gated capability. Add a kind
  only when a real registry and execution path require it.
- Do not make seven search vendors, every OAuth system, OCR, speech, memory SaaS, and MoA one
  indivisible milestone. Implement a shared contract first, then add a backend when its public
  protocol, authentication, and license are verified. Unsupported rows remain visible as
  `partial` or `blocked`.
- MoA is an opt-in experiment after the provider contract is stable. It is not required for
  provider completion and must never become an implicit fallback.
- Live credentials, subscriptions, hardware, and external binaries are owner checks. They are
  not reasons to keep changing the architecture after fixture contracts and product flows pass.

## Current baseline

Already present on `021ca10` and preserved by this work:

| Area | Current evidence | Product meaning |
|---|---|---|
| Responsibilities and watches | Approved definitions, occurrences, budgets, schedules, pauses, and restart handling are fixture-verified. | Keli can own a bounded recurring objective. |
| Evidence and authority | Capability receipts, evidence-bound completion, typed blockers, and durable corrections are fixture-verified. | A model or tool cannot promote its own proposal to truth. |
| Conversation and delivery | Ordinary/research modes, Discord/Telegram seams, dedupe, and outbox retry behavior are fixture-verified. | Delivery retries do not repeat research. |
| Model connections | ChatGPT live path plus OpenAI-compatible, Grok, fixture, and a pinned Hermes-derived catalog. | Catalogued models still need per-model runtime and live checks. |
| Retrieval and tools | Local notes/source collections, generic search, browser artifact capture, MCP transport, and generic external CLI seams exist. | Missing access is reported explicitly; no invented substitute is used. |
| Service and portability | Generated user-service units and portability checks exist. | Background execution is optional and configuration-driven. |
| Generalization scenarios | Portfolio/Rocket, Augustine/Shaul, and maintenance scenarios use the same controller with scripted evidence. | Domain behavior belongs in tools and configuration, not Keli branches. |

The pinned Hermes snapshot currently contains 54 inventory rows. Confirm the count and row
contents at implementation time; do not write tests that only assert a row count. Reference
pins are Hermes `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544` and Nanobot
`f49965445152361b779b465e8a5111549ac934c4`, both MIT. Keep attribution and PRD trace IDs in
the manifest/evidence note. The research decision matrix and supporting spike evidence remain
the source for the hypotheses below: [research matrix](../docs/research/2026-agent-architecture-matrix.md),
[completion ledger](../docs/evidence/COMPLETION_LEDGER.md), and
[portability evidence](../docs/evidence/PORTABILITY.md).

## Unchanged autonomy core

The integration work plugs into the existing responsibility contract. A responsibility carries
an objective, scope and current constraints, completion criteria, approved capabilities and
action boundaries, triggers/cadence, an investigation budget, unresolved dependencies, reporting
preferences, hypotheses, previous findings, and next-review conditions. Source-collection watches
are one specialization of this contract.

For each occurrence, Keli establishes the objective, inspects approved capabilities and current
evidence, selects the most consequential unresolved question, retrieves or calculates through
the gate, challenges the emerging conclusion with counterevidence, and then either meets the
evidence contract or records a targeted wait/blocker. It persists attempted questions, evidence
references, failures, and changed approach. Equivalent unsuccessful attempts on unchanged inputs
are suppressed while bounded transient retries remain possible.

Provenance, deterministic execution/calculation, analytical interpretation, completion, and
delivery remain separate statuses. A tool saying "no finding" does not complete an occurrence
unless Keli can show that the relevant question had adequate coverage and current inputs.
Reports explain what was examined, implications, limitations, and what would change the result.
Outbox retries deliver an existing report and never rerun its investigation.

## Product contract and readiness vocabulary

Every capability adapter implements the same conceptual boundary:

1. resolve configuration and credential references without exposing secrets;
2. probe the configured endpoint, executable, or fixture with a bounded request;
3. invoke with a timeout, cancellation, output limit, and usage accounting;
4. normalize the result into an evidence record and a compact model-visible projection;
5. classify failures (`not-configured`, `missing-access`, `transport`, `invalid-request`,
   `unsupported`, `timeout`, or `upstream`) without guessing;
6. preserve raw artifacts and hashes where the capability needs replay or audit.

Readiness is reported separately in the CLI, registry, ledger, and tests:

| State | Meaning |
|---|---|
| `catalogued` | Known metadata and an attribution/source pin exist. |
| `configured` | Settings and credential references resolve; no network claim is made. |
| `fixture-verified` | The adapter contract passed deterministic fixtures. |
| `live-verified` | A bounded round trip succeeded for this provider and model/configuration. |
| `blocked` | Required access, binary, protocol, or dependency is absent. |
| `excluded` | Deliberately outside Keli's product boundary, with a documented reason. |

Credential presence is never a live probe. A live check is scoped to the selected model or
backend, records request/result metadata without secrets, and is cleared when the model or
endpoint changes.

## Implementation slices

Each slice is independently reviewable and committed on `feat/v0.1.0`. A slice is complete only
when its fixture contract, negative paths, docs, and checks pass. Do not start the next slice to
compensate for an incomplete previous one.

### 1. Neutral inventory and protocol mapping

Create one `src/integrations/provider-manifest.json` (or mechanically rename the existing
snapshot) with `category`, canonical `id`, aliases, display name, auth strategy, protocol,
endpoint defaults, model discovery, supported options, runtime adapter, source commit, license,
status, and PRD trace IDs. Keep source attribution in metadata; do not create source-specific
runtime packages.

Before coding adapters, classify every row as one of: native SDK, OpenAI-compatible HTTP, other
documented HTTP, OAuth/external CLI, cloud SDK chain, local process, fixture-only, or unsupported.
Record why an apparently similar row cannot share a protocol adapter. Add registry queries such
as `listByCategory()` and `listByStatus()`; status must come from configuration/probe state and
the manifest, never from file existence.

Acceptance: the manifest is portable, generated/imported deterministically from optional source
roots, contains no secrets or personal paths, and the CLI can show catalogued/configured/
fixture-verified/live-verified distinctly. No new runtime provider is claimed in this slice.

### 2. One-session, selection-first setup

Rewrite `keli setup` around one injectable `WizardIo` session. The flow is:

`category number → provider number → readiness → provider settings → authentication method →
model (when applicable) → bounded probe → configure another category? → summary`.

Categories are Chat/Models, Search, Memory, Browser, Documents/OCR, Speech, Messaging,
External tools/delegates, and Background service. Each list offers `Skip` and displays a short
status (`ready`, `needs credentials`, `fixture only`, or `blocked`). Users never need to type an
internal provider ID in the normal flow. Prompts always begin on a fresh line. Secret entry uses
the parent session or an injected secret handler; it must not open a competing readline stream.

The Chat/Models category requires an explicit provider choice for a real installation. Fixture
mode is available only through an explicit `--fixture`/test flag. Non-interactive CI flags keep
working. Advanced commands (`setup provider`, `setup search`, `setup memory`, `setup mcp`,
`setup transport`, and `setup delegate`) call the same registry, auth, and probe helpers and do
not erase unrelated connections.

Acceptance: a clean install can be completed with numbered choices, a skipped optional category
is shown as a typed blocker when used, an existing connection survives another setup command, and
the summary states exactly what is configured and what still needs access.

### 3. Inference runtimes by protocol family

Implement runtime support by protocol, with a mapping table in the manifest. Start with the
Keli-owned fixture, OpenAI-compatible, Grok HTTP, and ChatGPT paths, then add a catalog row only
when its protocol and options are covered. Use the existing Pi SDK/native path where it is a real
fit; do not import Hermes plugins or Python runtimes.

Keep these identities separate: ChatGPT model inference versus Codex app-server coding delegate;
OpenCode inference versus OpenCode delegate; Copilot inference versus Copilot ACP delegate; xAI
API versus xAI subscription OAuth. Preserve provider-specific reasoning, headers, base URLs,
Azure deployment, Vertex project/location, and Bedrock region/profile settings.

Fallback is explicit and bounded: try configured fallback providers only for typed transport or
provider failures, never after a partial response or side effect, never silently to fixture, and
record the provider/model and fallback reason in the receipt. OAuth refresh remains under Keli's
existing lock; credential files are not copied from upstream projects.

Acceptance: each implemented family has request-shape, option, timeout/cancel, retry-class,
malformed-response, missing-access, and secret non-leakage fixtures. Changing a model or endpoint
clears its live-verified state. Unsupported catalog rows remain `partial`/`blocked`.

### 4. Retrieval and browser capabilities

Keep one normalized search contract and a shared dispatcher. Brave and generic JSON are the first
live-capable backends; add Tavily, Exa, Firecrawl, SearXNG, Perplexity, or another backend as
separate manifest rows only after checking its current public API, auth, license, and maintenance
status. A fixture proves normalization; a real bounded request proves live readiness.

Extend `web.fetch` and browser navigation/capture evidence with content type, byte count, SHA-256,
bounded retrievable body/artifact, and source URL. Enforce network allowlists and artifact size
limits before the gate stores or exposes bytes. Playwright, CDP, and MCP browser backends remain
optional profiles, not hidden dependencies.

Acceptance: credentials alone do not pass a probe; malformed results and network failures become
typed errors; browser screenshots/downloads can be replayed from retained bytes; casual chat
cannot bypass the capability gate.

### 5. Memory contract and local-first persistence

Define a memory provider interface for `import`, `search`, `read`, and `retain`, returning
evidence records. Providers may suggest context but cannot commit rules, permissions, or
occurrence status. Keep SQLite notes, source collections, and conversation memory as the default
and authoritative v0.1 path.

Add a Honcho adapter only if its documented HTTP contract is stable and its round trip can be
tested; otherwise keep the fixture and publish the interface as `blocked`/`fixture-only`. Do not
add a second memory authority or a collection of unmaintained SaaS plugins in this completion
pass.

Acceptance: restart and migration behavior is covered, stale summaries cannot override current
corrections, advisory memory is visibly distinct from canonical behavior, and live credentials
are not treated as successful retrieval.

### 6. Documents, OCR, and speech as bounded modalities

Add `documents.extract`/`ocr.extract`, `speech.transcribe`, and optional `speech.synthesize`
capabilities behind the same gate. Prefer a maintained Bun-compatible PDF parser only after
verifying its API and license; wrap `pdftotext`, Tesseract, local STT, or equivalent binaries as
owned bounded processes. Use OpenAI-compatible audio endpoints where configured rather than
creating provider-specific clients for every service.

Evidence includes source artifact/hash, extracted text, page or timestamp ranges, confidence when
the backend supplies it, and extraction errors. Enforce byte, duration, and process-time limits;
optional dependencies must not be required by CI. Extraction never writes notes or authorizes an
action automatically.

Acceptance: fixtures cover text PDFs, image/OCR input, audio request/response shapes, missing
binary/access, cancellation, malformed output, and secret non-leakage. Live modality checks are
owner milestones after the fixture contract passes.

### 7. MCP, delegates, transports, and background lifecycle

Before `mcp.tools/call`, fetch and validate `tools/list`, reject unknown tools and invalid
arguments, and preserve credential scoping. Keep owned/bounded stdio process handling and the
existing HTTP path. A remote tool remains unavailable until its schema and access are present.

Keep Discord/Telegram pairing, inbox/outbox, and dedupe on the existing seams; do not rewrite
transport protocols. Give Codex app-server, OpenCode, and Copilot ACP explicit gated delegate
profiles. A child completion without artifacts remains unverified. `keli service install`,
`status`, and `run` remain lifecycle commands; they are not providers and do not introduce a new
scheduler. Rocket remains `tools.rocket`, optional and externally configured.

Acceptance: schema and access failures are typed, delegate receipts include artifacts or an
explicit unverified state, pairing remains route-bound and one-use, and service commands reuse
the existing scheduler.

### 8. Contract tests and release evidence

Add category-neutral provider contract suites (use `tests/unit/providers.test.ts`,
`memory-providers.test.ts`, `browser-providers.test.ts`, `search-providers.test.ts`,
`modality-providers.test.ts`, and `transports.test.ts`, or the repository's equivalent naming).
Tests must exercise behavior: resolution, auth choice, model selection, request shape, options,
timeouts, cancellation, retry classification, malformed upstream, artifacts, restart, and gate
authority. Do not add catalog-row counters as a substitute for runtime tests.

Run with a temporary `KELI_STATE_DIR`; keep secrets out of logs and fixtures. Required checks are
`bun test --timeout 20000`, `bun run check`, the production build, and the portability/link check.
Extra review is required for `src/state/`, `src/core/gate.ts`, `src/execution/`, `scripts/build.ts`,
and `install/`.

Update the completion ledger, support matrix, operations guide, provider documentation,
third-party notices, release report, and this plan. Every row says implemented, fixture-verified,
live-verified, blocked, or excluded with a reason. Do not rewrite published history.

## Autonomy acceptance scenarios

The existing paper-derived hypotheses become regression expectations, not another research loop:

| Hypothesis | Test expectation |
|---|---|
| Context routing (InMind) | A relevant durable constraint is applied without leaking across projects. |
| Exact retrieval (Scroll/ReFind) | Earlier evidence omitted from a summary is recovered within a fixed budget. |
| Phase/memory coupling (PMCoder) | After a failed attempt, the next investigation changes usefully rather than stopping early. |
| Typed uncertainty | Missing access, stale input, conflicting evidence, and unresolved interpretation produce different waits or qualified reports. |
| Bounded capability discovery | Keli finds an approved missing tool without loading every schema or expanding authority. |
| Verification-grounded completion | Plausible claims without required receipts remain unverified. |

Use the same responsibility controller for three demonstrations:

1. **Portfolio/Rocket:** Rocket supplies positions and domain evidence. Keli must distinguish
   unchanged holdings from an unchanged assessment, surface missing or conflicting macro evidence,
   and never invent valuations or perform signing, orders, swaps, or approvals.
2. **Augustine/Shaul research:** a correction and a missing source drive retrieval, disagreement
   preservation, resumability, and project isolation.
3. **Maintenance triage:** a misleading or unavailable diagnostic drives bounded discovery,
   previous-evidence retrieval, and either a verified diagnosis or a concrete blocker. No code
   edit or deployment is automatic.

Measure steering turns, relevant evidence recovered, repeated failed attempts, unsupported
conclusions, duplicate work/reports, and budget consumption. Scripted providers make these
regressions deterministic; real-model and live-tool runs are labeled separately.

## Explicit exclusions

Do not import complete Hermes/Nanobot runtimes, credential pools, account rotation, scraper-based
search, keyless MCP search rings, Python browser agents, unmaintained memory SaaS, or a full TTS
plugin zoo. Do not build portfolio or wallet engines inside Keli. These are boundary decisions,
not claims that the upstream projects are unusable.

MoA/mixture composition may be explored later as an explicit, opt-in gated capability that fans
out to configured models and merges evidence. It is not a provider, fallback, or v0.1 completion
blocker.

## Stop conditions and owner milestones

Engineering is complete when the manifest and registry are truthful, setup is selection-first,
each implemented capability family has fixture and negative-path coverage, the three autonomy
scenarios pass through the same controller, portable docs contain no personal paths, and all
required checks pass. At that point stop changing architecture.

Remaining work is an owner milestone: API keys/OAuth subscriptions for non-ChatGPT models,
search/MCP/browser accounts or binaries, Honcho/Tesseract/Whisper/TTS access, transport tokens,
Codex/OpenCode/Copilot logins, dual-transport testing, four-target native packaging, five-user
testing, notarization, live Rocket, and any live ≥95% evaluation. A live check can move one row to
`live-verified`; it cannot redefine the authority boundary or reopen the research plan.

## Reuse trace

Record ADOPT → ADAPT → BUILD for each capability with the upstream commit, license, protocol
documentation, and PRD trace IDs (I1–I10 and A01–A46 as applicable). The existing Keli gate,
occurrence controller, evidence receipts, outbox, and local memory are ADOPT decisions. Hermes
and Nanobot provider protocols are ADAPT inputs. Keli's authority, readiness model, setup UX,
and cross-domain responsibility behavior are BUILD work.

The implementation prompt given to Cursor should reference this file, require one slice per
commit, preserve the baseline commit, and stop at the engineering stop conditions above. It
should not ask for another literature survey or another architecture proposal.
