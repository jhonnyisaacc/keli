# Support matrix (0.1-I)

| Target | Build artifact | CI smoke | Native runner evidence |
|--------|----------------|----------|------------------------|
| Linux x64 | `keli-linux-x64` | Required (`bun test`, release smoke) | Host CI |
| Linux arm64 | `keli-linux-arm64` | Cross-compile via `bun run build --all-targets` | Leftover: native runner |
| macOS x64 | `keli-darwin-x64` | Sandbox job (fail-closed checks) | Leftover: G02 cannot be faked in Linux CI |
| macOS arm64 | `keli-darwin-arm64` | Cross-compile artifact only | Leftover: notarization |

## Providers and adapters

| Surface | Fixture (CI default) | Live (optional) |
|---------|----------------------|-----------------|
| Model provider | `KELI_FIXTURE_URL` | `KELI_PROVIDER_URL` |
| Grok override (A05) | `KELI_GROK_FIXTURE_URL` | Not advertised until pinned |
| Honcho memory | `KELI_HONCHO_FIXTURE_URL` + `KELI_HONCHO_ENABLED=1` | Official client when enabled |
| Browser session | `KELI_BROWSER_SESSION_FIXTURE_URL` | Playwright with credential ref |
| Delegate | `KELI_DELEGATE_FIXTURE_URL` | Codex/OpenCode when pinned |
| Discord/Telegram | Integration fixture | Live tokens optional |

## Human-only leftovers (do not tag v0.1.0 until recorded)

- Apple notarization / release signing keys in secure CI
- Held-out correction eval ≥95% with **live** provider (fixture suite runs in CI)
- Five-user assisted onboarding checklist (`docs/RELEASE_CHECKLIST.md`)
- Four-target **native** runner evidence on real hardware
