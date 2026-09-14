# Provider manifest

One portable inventory for Keli capability backends. Catalog membership is not a live
adapter. Status is `catalogued`, `configured`, `fixture-verified`, `live-verified`,
`blocked`, or `excluded`.

ADOPT → ADAPT → BUILD (I8, A05, A25, A35, A29, A41–A42):

| Source | Decision | Reuse |
| --- | --- | --- |
| NousResearch/hermes-agent `93e2525a0b60c4e3f581ddf0bdf5ffe1bd977544`, MIT | ADAPT | Inference metadata snapshot only; no Python runtime, credential store, or execution loop |
| HKUDS/nanobot `f49965445152361b779b465e8a5111549ac934c4`, MIT | ADAPT | Honcho listed as optional memory until a stable HTTP contract exists |
| `@mariozechner/pi-ai@0.73.1`, MIT | ADOPT | Native protocol transport already used by catalog inference rows |
| Keli registry, local notes, Discord/Telegram REST, MCP JSON-RPC | KEEP | Authority, evidence, and fixture-verified adapters stay in Keli |

Regenerate with `bun run scripts/import-provider-manifest.ts`. When `KELI_HERMES_ROOT`
points at the pinned Hermes checkout, `scripts/import-hermes-catalog.py` refreshes the
inference snapshot first. The public file is always
[`src/integrations/provider-manifest.json`](../../src/integrations/provider-manifest.json).
Do not commit personal paths or a second diverging catalog.

Protocol families are assigned before a row is treated as implemented. Construction through
pi-ai remains `catalogued` until a fixture contract for that family exists. MoA and
Copilot ACP stay `excluded` as conversation providers.
