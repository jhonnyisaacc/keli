# Connecting a model

Run `keli setup`. That bootstrap connects **one** conversation model (authenticate,
use the provider default or discovered model, probe), then you can `keli chat`.
First-use chat ids are `chatgpt`, `openai-compatible`, `anthropic`, and `grok`.
Other catalog ids are valid from More providers; they are not a completeness
claim. Fixture providers are used only with `--fixture` or an explicit test flag.

Optional tools use `keli connect` or `keli setup advanced` (Search, Memory,
Browser, Documents/OCR, Speech, Messaging, External tools/delegates, Background
service). Existing `keli setup search|browser|mcp|...` section commands remain
aliases. `keli setup --transport none` keeps notifications on the CLI.

`keli providers list` reports **catalogued**, **configured**, **fixture-verified**,
**live-verified**, **blocked**, or **excluded**. Live-verified is scoped to the selected
model and is cleared when the model or endpoint changes. Pair Discord or Telegram
with a `KELI-PAIR` code from that chat.

Documents extract uncompressed PDF text in-process. `pdftotext`, Tesseract, and
OpenAI-compatible audio endpoints are optional and are not required by CI. Extraction
never writes notes or authorizes actions. MCP `tools/call` is rejected until
`tools/list` names the tool. `keli service install|status|run` is a scheduler lifecycle
command, not a provider.

| Connection | Provider IDs / setup |
| --- | --- |
| ChatGPT subscription | `chatgpt` (alias `openai-codex`); new login or explicit read-only link to an existing Codex login |
| Anthropic | `anthropic`; API key, or account login with `keli auth add anthropic --type oauth-device` |
| GitHub Copilot subscription | `copilot`; device login, including the SDK's Enterprise-domain option |
| Nous Portal | `nous`; device login requesting inference scope only |
| Grok subscription | `xai-oauth`; device login |
| MiniMax subscription | `minimax-oauth`; browser authorization with PKCE |
| Qwen subscription | `qwen-oauth`; explicitly links an existing Qwen CLI session; renew it with `qwen auth qwen-oauth` |
| AWS Bedrock | `bedrock`; AWS SDK credential chain, optional region/profile, or `AWS_BEARER_TOKEN_BEDROCK` |
| Google Vertex | `vertex`; Google ADC/service-account credentials and project/location |
| Google AI Studio | `gemini`; native Gemini API with `GOOGLE_API_KEY` or `GEMINI_API_KEY` |
| Azure Foundry | `azure-foundry`; full resource API base URL, deployment, key, optional API version; Responses by default or `anthropic-messages` |
| Local / custom | `lmstudio`, `custom` (aliases `ollama`, `local`, `vllm`); set endpoint and server model ID; optional key through `keli auth add custom` |
| Keyless hosted | `opencode-free`; availability of free models is controlled by the upstream service |

API-key providers also include `openai-api`, `grok` (alias `xai`), `openrouter`,
`fireworks`, `deepseek`, `deepinfra`, `nvidia`, `huggingface`, `alibaba`,
`alibaba-cn`, `alibaba-token-plan`, `alibaba-token-plan-cn`,
`alibaba-coding-plan`, `alibaba-coding-plan-cn`, `kimi-coding`, `kimi-coding-cn`,
`minimax`, `minimax-cn`, `stepfun`, `xiaomi`, `zai`, `tencent-tokenhub`,
`tencent-tokenplan`, `ollama-cloud`, `arcee`, `gmi`, `kilocode`, `opencode-zen`,
`opencode-go`, `ai-gateway`, `novita`, `nebius-token-factory`, `upstage`,
`actual`, `meta-ai`, `router`, `commandcode`, and `commandcode-anthropic`.
Exact default endpoints and accepted environment-variable names are in the
[provider manifest](../src/integrations/provider-manifest.json).

Keli-owned account sessions refresh under a cross-process lock. Linked Codex and
Qwen sessions are read-only: their owning CLI renews them. Keli does not import
Hermes's credential file or copy another application's refresh token.

`openai` keeps Keli's previous meaning of a configurable OpenAI-compatible
endpoint; `openai-api` selects the OpenAI platform defaults. `codex` and `opencode`
remain coding delegates. OpenCode's hosted inference provider is `opencode-zen`.
Hermes's `copilot-acp` launches an agent process and `moa` composes agents/models;
these are not imported as conversation providers. Copilot ACP is a separate blocked
delegate identity (`copilot-acp-delegate`), not Chat Completions.

All providers feed the same Keli conversation and responsibility controller.
Their outputs remain proposals; the provider layer offers no executable native
tools. Rocket and portfolio behavior are unrelated to provider onboarding.

See the [implementation evidence](evidence/HERMES_PROVIDERS.md) for the upstream
pin, coverage, and the distinction between fixture checks and live account checks.
The generated [compatibility ledger](evidence/UPSTREAM_COMPAT.md) lists every
advertised family with adapter status `implemented`, `fixture-verified`, or
`deferred`. Catalog membership is not live-verified.
