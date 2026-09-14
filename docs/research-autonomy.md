# Run an evidence-driven research watch

Enable this increment explicitly on an approved source-collection watch. It builds on the existing source indexing and heartbeat CLI. `verified` means required evidence/coverage checks passed; it is not a guarantee of semantic truth.

Use your normal initialized Keli state and selected project for a live watch. For an experiment, select a separate temporary `KELI_STATE_DIR`; never point invariant tests at live state. Run the checked-in CLI through `bun run src/cli/index.ts` if no newly built `keli` binary is installed.

Add this section to the HEARTBEAT.md you import (use real collection IDs already configured/indexed):

```markdown
## cava-research
- kind: source-collection
- target: cava
- every: 1h
- autonomy: yes
- question: Track the supported Cava thesis, its assumptions and invalidation conditions. Report meaningful changes.
- requires: cava
- subjects: Cava
- max-requests: 20
- max-tools: 8
- max-tokens: 30000
- notify: material-change
```

```sh
keli watches import --file ./HEARTBEAT.md
keli watches list
keli watches approve <watch-id>
keli watches tick --no-notify
keli watches occurrences <watch-id>
```

`--no-notify` records pending notification intent but does not deliver it. A later tick with delivery enabled may deliver that pending result. Without a configured channel, delivery prints locally. Add an explicitly authorized `channel` and optional `thread` to the definition to select Discord, then import and approve that new version.

When another required collection is genuinely missing, the occurrence records `waiting_for_evidence`. Indexing that collection makes the next eligible tick resume the same occurrence with its remaining budget. Unchanged inputs and unresolved waits make no model calls.

For a clarification:

```sh
keli watches resume <watch-id> --input 'The question concerns the latest published thesis.'
keli watches tick --no-notify
```

Discord supports `/watch-input <watch-id> <answer>` only on the watch's exact route and from `transports.discord.ownerUserId` configured locally. This command supplies data to an existing wait; it cannot approve a watch or expand its authority. Polling records the input; the next scheduled watch tick resumes it.

```sh
keli watches pause <watch-id>
keli watches events <watch-id>
```

Pausing stops further dispatch and delivery. Re-approve to resume an unchanged paused watch. Changing the definition returns it to proposed and requires approval of that new contract. Preserve the state database, evidence and outbox when disabling this mode; do not roll back a SQLite snapshot to replay work.

For a credential-free demonstration:

```sh
bun run scripts/research-autonomy-demo.ts .
bun test tests/integration/research-autonomy.test.ts
```

See [paired results and limitations](evidence/research-autonomy/README.md). This demonstration uses scripted providers through the real runtime and temporary state. A live provider run is a separate milestone.

General responsibilities (scheduled reviews, Rocket, other domains) use the same controller.
See [responsibilities](responsibilities.md).
