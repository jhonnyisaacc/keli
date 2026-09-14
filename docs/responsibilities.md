# Operating guide: general responsibilities

Keli is the general-purpose agent. Rocket and other tools provide domain capabilities.
This guide is the operating path for an approved responsibility. It does not replace
[research watches](research-autonomy.md).

`verified` means the declared evidence contract passed. It is not semantic truth, a
valuation, or permission to trade or deploy.

## Author and approve

Add a section to the HEARTBEAT file you import. Nothing runs until you approve it.

```markdown
## portfolio-daily
- kind: responsibility
- objective: Maintain a current investment assessment of the configured wallet using approved tools only
- capabilities: tools.rocket
- notify: daily-brief
- constraints: Paper options only. No signing, orders, swaps, or approvals.
- completion: supported assessment or explicit blocker
```

A responsibility without `every:` defaults to `daily:09:00` UTC for **that watch only**.
Source-collection watches keep their own cadence. Daily financial reporting is not
Keli-wide behavior.

```sh
keli watches import --file ./HEARTBEAT.md
keli watches list
keli watches approve <watch-id>
keli watches tick --no-notify
keli watches occurrences <watch-id>
```

Use a temporary `KELI_STATE_DIR` for experiments. Never point invariant tests at live state.

## Domain tools

Configure executables and private state outside Git:

```sh
export ROCKET_BIN=/path/to/rocket
export ROCKET_STATE_DIR=/path/to/private-rocket-state
keli invoke tools.rocket --workflow health --json
```

Default research watches cannot call `tools.rocket`. The approved responsibility must list
it. The model sees capability ids first and loads one schema through `capabilities.lookup`.
A missing binary is `integration_gap`. A healthy command with no finding does not complete
the occurrence.

Keep wallet discovery, valuations, chain support, and protocol decoding in Rocket.

## What the controller does

On each due slot or event:

1. Projects current objective, constraints, and scoped rules into the turn.
2. Allows only the approved capabilities plus `capabilities.lookup`.
3. Records investigation attempts on the occurrence.
4. Verifies citations or a sufficient tool receipt before committing `verified`.
5. Enqueues at most one outbox intent. Delivery retry does not repeat analysis.

`daily-brief` notifies on a verified review even when the thesis is unchanged.
`material-change` stays quiet when supported findings and cited support do not change.

## Domain examples

| Example | Contract shape | Forbidden |
|---|---|---|
| Portfolio analyst | `kind: responsibility`, `tools.rocket`, daily brief | signing, orders, swaps, approvals, invented valuations |
| Augustine / Shaul | `kind: responsibility` or source-collection, `sources.*`, required collections | cross-project rule leak, reconstructing a position without retrieval |
| Maintenance triage | `kind: responsibility`, read-only tools | automatic edits or deploy |

All three use the same controller. Changing domain should be a tool or HEARTBEAT change,
not a core branch.

## Status

| Capability | Status |
|---|---|
| Responsibility contract, scheduled slots, lookup, no-finding wait | implemented, fixture-verified |
| Structured Rocket profile | implemented, fixture-verified |
| Live Rocket daily brief | deferred |
| Live-model quality | deferred onboarding milestone |
| In-Keli portfolio engines | rejected / superseded |
