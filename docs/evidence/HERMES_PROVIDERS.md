# Hermes provider adoption

The previous onboarding offered provider names without complete connection paths.
This change adds the pinned Hermes inference catalog to Keli's shared factory,
authentication, setup, model suggestions, and live inference checks.

ADOPT → ADAPT → BUILD (I8, A05, A25, A35):

| Source | Decision | Reuse |
| --- | --- | --- |
| NousResearch/hermes-agent `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544`, MIT | ADAPT | Bundled provider metadata and Nous/xAI/MiniMax OAuth protocol exchanges; Keli credential storage replaces upstream stores |
| `@mariozechner/pi-ai@0.73.1`, MIT | ADOPT | Native Chat Completions, Responses, Anthropic, Gemini, Vertex, Bedrock and Azure inference; Anthropic/Copilot account flows; existing ChatGPT flow |
| `proper-lockfile@4.1.2`, MIT | ADOPT | Serialize refreshes of Keli-owned account sessions |
| Keli registry, setup and model factory | ADAPT | Catalog registration, aliases, provider/model selection, secret references and inference probes |
| Keli authority/controller | KEEP | No new authorization, tool executor, research controller, portfolio engine or canonical state writer |

The catalog includes the pinned canonical inference providers and bundled API-key
plugins. The extractor reads committed Git objects with Python's AST; it never
imports Hermes, runs its plugins, or reads its user configuration. Reproduce with
`python3 scripts/import-hermes-catalog.py <hermes-checkout>` then
`bun run scripts/import-provider-manifest.ts` and review the diff.
Helper-generated provider definitions are explicitly resolved in the extractor.
Hermes's complete MIT notice is retained in the repository third-party notices.

This is provider coverage, not parity with every Hermes runtime feature. No
credential pool, account rotation, MoA runtime or ACP agent process is imported.
`copilot-acp` and `moa` are recorded as excluded non-inference entries. Qwen keeps
an explicit external-login dependency; it is not a new independent Keli OAuth
flow. The MiniMax account flow currently uses the global service. Regional
MiniMax API-key providers are separate entries.

Validation checks provider construction across the catalog, native protocol
selection, actual local streaming requests for Chat Completions/Anthropic/Gemini,
no executable native tools, no unrelated key leakage to keyless endpoints,
role-specific model selection, MiniMax PKCE state checking, scoped Nous device
and refresh exchanges, and rejection of an off-origin xAI token endpoint.
Cloud SDK credential chains are adopted, not verified against live cloud accounts.
OAuth exchanges use controlled responses; fixture success does not prove an
account's subscription entitlement or a service's current availability.

The prior live ChatGPT evidence remains separate. This catalog expansion does not
claim live verification of every listed provider. Setup records success only
when the selected provider and model finish their inference probe.

Final validation: `bun test --timeout 15000` with a temporary `KELI_STATE_DIR`: **264 pass, 1 platform skip, 0 fail**. The first full run hit the existing browser test's five-second timeout; the longer bounded run passed. `bun run check` passed types, boundaries, and portable documentation checks.

Linux compilation succeeded with `bun build --compile src/cli/index.ts`; the compiled CLI listed Anthropic model suggestions successfully using a temporary state directory. No new vendor account was used in this expansion.
