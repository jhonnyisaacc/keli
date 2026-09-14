# Live account and responsibility results

Baseline: `a5901a3`. Date: 2026-09-14. Model: `gpt-5.5` via ChatGPT account,
using pi-ai 0.73.1. Host: Linux; Bun 1.4.0; existing Codex login from CLI 0.153.4.
All Keli and Rocket experiment state was temporary. Existing account access was
explicitly linked read-only; no refresh token was copied or rotated.

## Executed results

| Check | Observed result |
|---|---|
| Direct account inference | Real response, no native tools. An initial gpt-5.4 request was rejected by this account; gpt-5.5 worked. The library catalog is not an entitlement list. |
| Setup connection probe | Actual inference returned successfully; setup.providerConnected=true. |
| Keli CLI conversation | Real greeting through the existing conversation loop. No provider fixture or delegated agent. |
| Research retrieval | Keli searched indexed repository documentation, read passages, and cited the actual responsibilities document. |
| Durable correction and restart | `personal research must cite keli-docs` was committed, then applied in a new CLI process and conversation with citations. |
| Bounded responsibility | After the fixes below, the same eight-request cap produced a verified cited review: five model steps and three tool calls. |
| Restart in same UTC slot | No model wake or repeated review. |
| Next UTC slot | Another verified review with unchanged meaning: four model steps and three tool calls. |
| External portfolio tool | Keli discovered and invoked the pinned real Rocket CLI through an optional diagnostic adapter, with a copied existing portfolio input and scratch Rocket state. |
| Portfolio result | `missing_evidence`: Rocket declared `ACTION_REQUIRED` / `REQUIRED_PROVIDER_UNAVAILABLE` for requested inventory reconciliation. Keli reported the blocker instead of making up prices or recommendations. |
| Portfolio restart and next slot | Same slot stayed idle; next slot called the tool again and reported the continuing blocker. Three model steps and two tool calls per investigated slot. |
| Compiled CLI | Linux binary compiled and resolved the account; a real request returned through the compiled conversation loop. |

UTC slots were advanced by the test caller in one session; these are live-model
controller checks, not an overnight deployment. Notification intents were retained
locally; no Discord/Telegram message or external delivery acknowledgement was tested.

## Failures found and fixed

1. Budget exhaustion escaped the watch controller and left an occurrence active.
   The controller now commits a blocked outcome through ResearchResponsibilityService,
   terminalizes the exhausted run, and allows a fresh budget in the next slot.
   Models also see the remaining request budget, including tool-dispatch costs.
2. Configured external tools were absent from the conversation app's registry.
   Each app now registers its configured descriptors without changing the global
   registry or exposing tools outside the responsibility's approval list.
3. Tool lookup omitted approved workflow values, causing the model to guess a watch
   name as a workflow. Discovery now includes the configured workflow enum.
4. The strict evidence prompt required sources.read even for tool-only responsibilities.
   It now distinguishes source passages from structured receipts, and tool responses
   include their actual sourceId. Missing evidence must name the actual blocker,
   not invented passage IDs.

The original scripted scenarios did not expose these integration failures. No new
paper or responsibility architecture was needed to fix them.

## Limits

This was a portfolio **diagnostic** check, not a successful investment assessment or
fresh wallet inventory run. Rocket pin: `06ed733c98a99d193b035202a20796ad98afdd86`.
The optional adapter under `experiments/live-account/` exposes Rocket's declared
warnings and reasons in Keli's evidence envelope. It intentionally does not certify
research sufficiency or interpret portfolio decisions. Its fixed executable, private
input, and scratch directory are supplied in the trusted tool configuration, not by
the model. The initial direct Rocket JSON did not match Keli's fixture-era projection;
that mismatch is explicitly handled at this test boundary, outside Keli's controller.

Independent browser OAuth login still requires an owner-operated sign-in. Login and
refresh are adopted library code; refresh serialization and failure boundaries are
unit-tested. Existing Codex access was live-tested, and its owner must renew that
external session when it expires. It is never refreshed by Keli.

A greeting after a required-collection correction produced missing_evidence in the
compiled smoke check. That is a remaining conversation-policy usability issue:
research requirements can over-constrain casual conversation. It is not a provider
connection failure, and this report does not claim overall product readiness.

Only ChatGPT was newly wired here. The library supports other providers, but their
presence in its catalog is not evidence that Keli's onboarding supports them yet.
All private inputs/transcripts remain outside the repository. No holdings, wallet
addresses, account identifiers, secrets, or personal device paths are committed.

## Regression and packaging checks

`bun run check` passed (types, boundaries, portable documentation). Full tests in a
temporary KELI_STATE_DIR: **254 pass, 1 platform skip, 0 fail**. The Linux CLI binary
compiled. New checks cover tool-free inference, invalid/native-tool responses, abort,
secret redaction, read-only external account access, concurrent owned-session refresh,
budget terminalization, and scoped external-tool discovery.

## Reproduce the useful starting point

Use a separately initialized Keli state directory for experiments. Then follow
[the account connection commands](CODEX_APP_SERVER.md), register a real source
collection, and ask Keli to retrieve and cite it. Apply a scoped correction and repeat
in a new conversation/process. An approved responsibility should use a finite budget;
check its retained outcome and run counters before comparing schedule slots.

For the optional Rocket diagnostic, the trusted profile invokes Bun with
`experiments/live-account/rocket-evidence-adapter.ts`, the pinned Rocket executable,
a private portfolio copy, and a scratch state directory as fixed positional arguments.
Use an external tool id and an approved `review` workflow. It is not installed or
selected by default, and it never refreshes wallet inventory or executes trades.
