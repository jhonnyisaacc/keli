# Connecting a model

Run `keli setup provider`. First-use ids are `chatgpt`, `openai-compatible`, `anthropic`,
and `grok`. Other catalog ids are valid when typed explicitly; they are not a completeness
claim. Choose a provider, a model, and its connection method.
API-key input is hidden and saved in the OS credential store. Config contains a
reference, never the key. Provider environment variables also work on headless
hosts; they are read only for the selected provider. No Hermes installation is
needed to run Keli.

`keli providers list` reports **catalogued**, **configured**, **fixture-verified**, or
**live-verified** for the selected model. Live-verified is not account-wide entitlement. Model suggestions are not
proof of access. Setup tests the selected model with one bounded inference request.
`grok` is the A05 HTTP API-key path; `xai-oauth` is the Grok subscription login.

Optional: `keli setup search` (Brave or generic JSON). `keli setup --transport none`
keeps notifications on the CLI. Pair Discord or Telegram with a `KELI-PAIR` code from
that chat.

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
these are not imported as conversation providers. They would require a separate
product decision about execution and orchestration.

All providers feed the same Keli conversation and responsibility controller.
Their outputs remain proposals; the provider layer offers no executable native
tools. Rocket and portfolio behavior are unrelated to provider onboarding.

See the [implementation evidence](evidence/HERMES_PROVIDERS.md) for the upstream
pin, coverage, and the distinction between fixture checks and live account checks.
