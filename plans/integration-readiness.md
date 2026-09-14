# Keli: from pre-tag scaffolding to useful integration tests

Status: **superseded** by [general-purpose-autonomy.md](general-purpose-autonomy.md).
Keep this file as the historical integration-readiness sequence. Do not extend it.

The following preamble is historical.

## Quick review of the pre-tag implementation

The completed checklist overstated runtime readiness. Three priorities:

1. Configured providers were not fully connected. `resolveProvider` ignored saved config and
   credentials; availability depended on fixture env variables.
2. Model budgets were recorded without enforcement. The loop discarded calculated usage,
   recorded only the last retry, and its no-progress threshold (3) was unreachable with two
   retries.
3. General conversation was missing. `keli chat` required a `coding.delegate` rule; Discord
   inbox processing marked messages processed without running a conversation.

Validation at the start of this milestone: `bun run check` passed; `bun test` produced 140
passes, 1 skip, 0 failures in 13s under a temporary `KELI_STATE_DIR`. The earlier
single-file timeout did not reproduce. Installed Bun is 1.4.0 (package declares `>=1.4.2`).

## 1. Finish the existing integration foundation

- One config-aware resolver for setup, doctor, CLI, jobs, transports. Kind, enabled state,
  credential destination, and re-auth quarantine enforced consistently. Fixture selection is
  explicit (`source: fixture-env`) and never implied when a config entry exists.
- Credential resolution and configured model selection feed provider creation
  (`createModelProvider(config, credentials)`); OpenAI-compatible protocol first; unsupported
  protocols reported as such (`anthropic-messages`, `acp`).
- Budgets enforced before every model request, retry, tool call, and helper dispatch. Bounded
  reservation, reconciliation with reported usage, and a `request_usage` row per attempt.
  Unknown pricing stays visibly unknown (`costUnknown`).
- Typed retryable errors, bounded backoff, cancellation checks between attempts, and a
  reachable no-progress limit (same error repeated `DEFAULT_NO_PROGRESS_MAX` times stops).
- Live probe performs real round trips (`roundTrip` on profiles). Required milestone
  integrations are separated from optional ones; skipped required checks are failures.
- Readiness documentation corrected (CHANGELOG, SUPPORT_MATRIX).

## 2. One useful conversation and research loop

- `TurnContext` carries owner, project, scope, conversation, origin route, optional run/job.
- `ConversationLoop` (`src/conversation/`) accepts a chat model that returns exactly one of:
  `tool_call`, `answer`, `missing_evidence`, `clarify`. Tool calls execute through
  `CapabilityGate.run` only. The coding-delegate path remains one supported capability via
  the existing `ModelLoop`.
- Turns, tool results, answer references, and checkpoints persist in `conversation_turns`
  (schema v11). Turn ids derive from the inbox message id so restarts never duplicate a
  processed user message or acknowledged reply.
- Discord conversations bind to exact channel/thread identity (`thread:<id>` or channel id).
  A `DiscordBackend` interface has fixture and REST implementations; inbox dedupe and outbox
  receipts stay separate.
- Context loading order: scoped research rules, source-collection index summaries, small
  note excerpts; full passages are fetched on demand via `sources.read`.
- Research corrections are durable scoped rules (`research.requiredCollections`,
  `research.citationsRequired`) committed by `BehaviorService.reviseRule`, undoable per key,
  never leaking across projects. The evidence check (`src/core/evidence.ts`) rejects
  attributed positions without citations from required collections.
- Compaction verifies the archived artifact before advancing the preservation cursor and
  marks rows `archived_at` so repeated compaction is idempotent.

Evidence: in Discord thread 1548168218445873263, Nancy searched Honcho and the web, then
reconstructed Eric's position without querying Shaul. That is a retrieval failure, not proof
that SOUL/HEARTBEAT files caused it.

## 3. Portable extensions and lightweight proactive behavior

| Evidence or pattern | Keli implementation |
|---|---|
| Nanobot #5510 conditional wakeups | Watches compute a cheap fingerprint first; unchanged means zero model calls |
| Nanobot #5379 preservation before cursor advance | Archive and verify the covered range before recording progress |
| Hermes #82879 stalled memory writers | Watches persist attempts, last error, last success; `keli watches list` surfaces stalls |
| Hermes #4335 continuity across interfaces | Shared scoped knowledge, separate conversation histories, explicit route binding |
| Pi extensions | Small profile interfaces, lifecycle hooks, selective context loading; authority boundary retained |

SOUL/HEARTBEAT: optional human-readable authoring stays (`keli watches import HEARTBEAT.md`),
but the runtime executes compiled `watches` records (scope, trigger, budget, evidence,
notification policy, version). Imported files create draft proposals that require approval.
A heartbeat processes due watches; it does not reread a personality document.

Domain modules (source collections, transcript ingestion) receive scoped inputs and return
evidence; they never receive the canonical database handle. No dynamic third-party code
loader in this milestone.

## 4. Shaul and Cava together

- `sources` integration: read-only index over markdown-with-frontmatter directories
  (Shaul `content/`, Cava transcripts). Preserves collection, author/channel, path, url,
  published/fetched timestamps. Capabilities `sources.search` and `sources.read`.
- Augustine replay: fixture corpus with Augustine passages and Eric/Somos el Cuerpo del Mesías
  notes; scripted model; the loop must cite both collections or return `missing_evidence`.
  Correction, restart, and follow-up are tested; correction does not leak to another project.
- Cava replay: transcripts with thesis; a bearish video alone yields a conditional scenario
  with assumptions and invalidation, never a trade. Notify once on material change only.
- Live testing later uses a separate Keli test identity and isolated state, never Nancy's
  receiver or production schedules.

## 5. Daily software updates and acceptance gates

- `config.update.mode`: `off` (default) | `notify` | `auto`; daily check; auto activates only
  at an idle boundary (no active runs, no running occurrences).
- Rollback bookkeeping keeps the previous working release (`previous-version` pointer and
  preserved binary). Checksums, platform, and schema compatibility verified. Candidate
  migrations are tested on a copy of the database before activation. Result recorded in
  config (`update.last`) and notified.
- Skills and external integrations are never updated implicitly.

Ready for live integration testing when: configured provider auth works end to end; both
replays pass; Discord routes and receipts are correct; budgets and cancellation hold; restart
and compaction preserve evidence and corrections; required live probes perform real actions.

This milestone does not authorize a v0.1.0 tag.

## Status (2026-09-13)

Implemented and covered by tests (`bun test`: 182 pass, 1 platform skip):

| Section | Status | Where |
|---------|--------|-------|
| 1 Foundation | done | `src/model/provider-factory.ts`, `attempts.ts`, `retry.ts`, `src/integrations/live-probe.ts`, `EnvCredentialSource` |
| 2 Conversation + research | done | `src/conversation/*`, `src/core/evidence.ts`, `src/sources/*`, `src/transports/discord-backend.ts`, `inbox-handler.ts`, `retention.ts` |
| 3 Portable extensions / watches | done | `src/watches/*` (compiled records, heartbeat, HEARTBEAT import as proposals) |
| 4 Shaul + Cava replays | done (fixture corpora, scripted model) | `tests/integration/research-loop.test.ts`, `watches-cava.test.ts`, `discord-conversation.test.ts` |
| 5 Updates | done | `src/update/install.ts` (rollback repair, snapshot, rehearsal), `policy.ts` (off/notify/auto, idle boundary) |

Next: live milestone
1. `keli auth add <provider>` and `keli providers list`; `bun run scripts/live-probe.ts` must show real round trips.
2. `keli sources add --id shaul --path <shaul index>`; `keli sources add --id augustine --path <corpus>`; `keli sources index`.
3. `keli chat --message "emunah research must cite shaul and augustine"`, then the Augustine comparison; check citations.
4. Separate Keli bot identity: `keli auth add discord`, `keli routes bind`, `keli discord poll --loop 10` in an isolated `KELI_STATE_DIR`.
5. `HEARTBEAT.md` with the Cava watch; `keli watches import` → `approve` → `watches tick` from a timer.
6. `keli update --mode notify` first; `auto` only after a published manifest and rollback have been exercised once.
