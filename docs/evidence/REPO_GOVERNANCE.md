# Keli — Repository Governance and Automation Plan

Status: implementation-ready plan, 2026-09-11. No repository, workflow, installer or deployment is created by this document. [PRD.md](PRD.md) governs product behavior; this document governs how to build, review and release it. **DEC-NAME-01 (OWNER): Keli, כלי; technical name `keli`. DEC-TOOLING-01: Bun-first automation**, with justified exceptions below. Minimal build, not minimal product.

## 1. Repository shape and ownership

Start with one repository named `keli`, one private-to-the-repo package named `keli`, one `package.json`, one committed `bun.lock`, and one version source beginning at `0.1.0`. “Private” here prevents accidental package-registry publication; the repository and product are open source. Do not claim an unverified npm namespace or GitHub organization. Repository initialization supplies the actual account and security contacts without reopening the product name.

Proposed layout (directories are plans, not files already implemented):

```text
keli/
  README.md                    # promise, quick start, access model, support matrix
  PRD.md                       # normative product/build/acceptance contract
  PRODUCT_RESEARCH.md          # dated evidence and issue register
  DISCOVERY.md                 # preserved historical decisions and closure
  PRD_INPUT.md                 # handoff index
  REPO_GOVERNANCE.md
  CONTRIBUTING.md  SECURITY.md  LICENSE  THIRD_PARTY_NOTICES.md
  CHANGELOG.md  AGENTS.md
  package.json  bun.lock  bunfig.toml  tsconfig.json
  src/
    cli/                       # init, doctor, run, update; typed control client
    core/                      # runs, behavior, grants, jobs, delivery ownership
    model/                     # one bounded loop; context and usage accounting
    state/                     # SQLite repositories, migrations, atomic config
    execution/                 # dispatch, cancellation, OS backend contracts
    credentials/               # minimal secret-source interface
    adapters/                  # providers, Discord, Telegram, MCP, web, delegates
    update/                    # manifest verification, staging, recovery
  tests/
    unit/  invariants/  acceptance/  adapters/  platform/  fixtures/
  scripts/                     # dev.ts, build.ts, release.ts, check.ts
  install/                     # tiny bootstrap; service templates, no live state
  docs/                        # user, operator, architecture, integration guides
    evidence/                  # sanitized immutable experiment reports/manifests
    decisions/                 # only substantial post-PRD decisions
  .github/
    workflows/                 # ci.yml, release.yml, security.yml
    ISSUE_TEMPLATE/            # bug, feature, docs, integration + private-report link
    PULL_REQUEST_TEMPLATE.md  CODEOWNERS  dependabot.yml
  dist/                        # ignored generated artifacts
```

Core depends on typed adapter contracts, never on Discord/Telegram/provider implementations; adapters cannot import a direct authority-bypassing state writer. Separate action dispatch, policy, persistence and presentation by responsibility. No giant agent class containing everything, and no one-file-per-trivial-function rule. A module above roughly 500 authored lines prompts a responsibility review, not an arbitrary release failure. Review cyclic imports and direct executor/credential imports in `bun run check`. Keep the loop small without excluding capabilities.

Do not introduce workspaces merely to simulate isolation. [Bun workspaces](https://bun.sh/docs/pm/workspaces) support package organization when independently consumed packages become real; extract `core`, `cli`, `executor` or adapters then, retaining one lockfile. An OS process boundary can use the same executable with an internal, authenticated executor mode; a package boundary alone grants no isolation. Historical experiments remain unchanged in their original directories. A later sanitized evidence import preserves names, hashes, fixture descriptions and limitations; never put disposable spike source on the production import path.

Required root documents ship with repository initialization. README covers `keli init`, `keli doctor`, `keli run`, `keli update`, first successful chat, security scope and upgrade recovery. CONTRIBUTING uses the same scripts as CI. AGENTS.md specifies authority boundaries, no secrets/real-user test state, ADOPT → ADAPT → BUILD, trace IDs and required checks. LICENSE uses the PRD's open-source recommendation after actual dependency/license clearance; Apache-2.0 is still an engineering recommendation, not a newly invented owner decision. Record upstream MIT notices and bundled-runtime obligations in THIRD_PARTY_NOTICES; source and redistribution materials must match each released artifact.

## 2. Current remote practices and Keli choices

This is a bounded read-only remote audit on 2026-09-11, separate from the earlier installed-runtime and issue snapshots. Nanobot main was `aeb7b207d7e501b1dd5d8b68208813f493411331`; Hermes main was `05d705dd695d1084388529124dc2ffe5ce919e89`. Tree, selected source/docs/workflows, public rulesets, labels and recent releases were inspected. Counts describe scope, not quality or defect rates. Repository settings can change after this snapshot.

| Practice | Nanobot evidence | Hermes evidence | Keli decision and fit |
|---|---|---|---|
| Organization and docs | `nanobot/`, `tests/`, `docs/`, channel packages, separate `tui/` and `webui/`; focused contributing advice | `agent/`, `tools/`, `gateway/`, CLI, website docs, plugins and apps; documented extraction of large facades | ADAPT clear capability boundaries and operator docs; avoid multi-UI/multi-language layout before needed |
| Runtime size | Inspected `agent/loop.py` 2,400 lines; context and skills already separate | Inspected `run_agent.py` 1,556 lines; CONTRIBUTING maps extracted conversation/state modules | ADAPT explicit responsibility review; these counts do not prove either architecture defective |
| README/contributions | Quick start, supported channels/providers; asks for focused patches and simpler abstractions | Capability/setup/docs navigation; asks contributors to search first and prefer standalone integrations | ADOPT user outcome first and upstream inspection; do not force every thin v0.1 adapter into a plugin platform |
| Forms and PRs | Bug/feature forms request reproduction/version/redacted logs; no PR template at inspected tree | Bug/feature/setup forms plus PR template with issue, testing and platform details | ADAPT four short forms and a smaller PR template; redact by default |
| Security/license | SECURITY requests private reports; root MIT license | SECURITY gives private advisory/contact route and explicitly distinguishes OS confinement from in-process heuristics; root MIT | ADOPT honest trust-model and reporting docs; Keli must enforce its own stronger contracts and preserve reuse notices |
| CODEOWNERS | No CODEOWNERS file found in inspected tree | No CODEOWNERS file found in inspected tree; path-specific reviewer rule exists instead | Add explicit sensitive-path owners plus enforced rules; file absence does not mean absence of review protection |
| Labels | Small-ish mixed type/priority/provider/channel set with synonyms | Much broader component/provider/platform/triage automation set; inspected first 100 labels only | Use a short taxonomy; avoid synonym labels and automated “implemented” claims |
| CI | Read-only default CI permission, change detection, Python/WebUI/TUI tests; many Actions use major-version refs | Reusable workflow orchestration, SHA-pinned examples, install/OS tests, lockfile checks, OSV and narrow supply-chain scan | ADOPT locked tests and SHA pins; start three workflows, no large review-bot system |
| Dependencies/scanning | pyproject plus channel manifests; CI adds channel dependencies after sync; no Dependabot config found | uv/npm locks; Dependabot file schedules Actions only; OSV workflow present | One Bun lock and explicit lifecycle-script policy; `bun audit` first, additional scanners only for coverage gaps |
| Public rules | Active `Protect main`: PR + one approval, deletion/force-push prevention; this rule lists no required status checks | Active `protect-main`: PR and aggregate CI check; `dep-version-gate` requires team review on dependency/CI paths | ADAPT aggregate CI plus stronger review of sensitive paths; do not infer all branch settings from these rules |
| Releases and installation | Recent `v0.3.0`/`v0.2.2`/`v0.2.1`; TUI manually published for an existing tag; Bun build/hash script; matching package/archive and notices contract | Release script previews changelog, explicitly publishes, combines CalVer tags with SemVer package versions; substantial platform installer and install tests | ADOPT preview, matching artifacts, notices and install tests; one `vX.Y.Z` scheme and automatic tag builds; no layered source-runtime installation |
| Changelog/evidence | No root CHANGELOG.md found | No root CHANGELOG.md found; release script generates notes; evals/research directories exist | Root human-readable changelog plus generated release notes; sanitized evidence separate from shipped source |

Pinned sources: [Nanobot tree](https://github.com/HKUDS/nanobot/tree/aeb7b207d7e501b1dd5d8b68208813f493411331), [contributing](https://github.com/HKUDS/nanobot/blob/aeb7b207d7e501b1dd5d8b68208813f493411331/CONTRIBUTING.md), [CI](https://github.com/HKUDS/nanobot/blob/aeb7b207d7e501b1dd5d8b68208813f493411331/.github/workflows/ci.yml), [TUI build](https://github.com/HKUDS/nanobot/blob/aeb7b207d7e501b1dd5d8b68208813f493411331/tui/scripts/build.ts), [release workflow](https://github.com/HKUDS/nanobot/blob/aeb7b207d7e501b1dd5d8b68208813f493411331/.github/workflows/tui-release.yml), [security](https://github.com/HKUDS/nanobot/blob/aeb7b207d7e501b1dd5d8b68208813f493411331/SECURITY.md); [Hermes tree](https://github.com/NousResearch/hermes-agent/tree/05d705dd695d1084388529124dc2ffe5ce919e89), [contributing](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/CONTRIBUTING.md), [CI](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/.github/workflows/ci.yaml), [dependency policy](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/.github/dependabot.yml), [OSV](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/.github/workflows/osv-scanner.yml), [security](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/SECURITY.md), [release script](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/scripts/release.py). Public rule snapshots: [Nanobot rule](https://api.github.com/repos/HKUDS/nanobot/rulesets/13884831), [Hermes main](https://api.github.com/repos/NousResearch/hermes-agent/rulesets/14161644), [Hermes dependencies](https://api.github.com/repos/NousResearch/hermes-agent/rulesets/16277411). API links are live refresh points, not immutable snapshots.

**Unknown, not absent:** actual secret-scanning/push-protection settings, private-reporting enablement, undisclosed advisories, privileged security configuration, and any additional legacy branch protections. A policy document or workflow is not evidence that every repository setting is enabled or every run passes. The visible Hermes dependency policy describes security-update settings, but this audit could not independently verify them. Current repository organization does not revalidate the 39 historical issues or change the tested E1 pin.

Specific lessons: Hermes's installer describes a hash-verified lock tier and weaker resolution fallbacks; Keli release installation must fail rather than silently fall back to unpinned dependencies ([source](https://github.com/NousResearch/hermes-agent/blob/05d705dd695d1084388529124dc2ffe5ce919e89/scripts/install.sh)). Nanobot's contributing policy avoids macOS runners for cost; Keli cannot adopt that constraint because macOS is day-one scope. Hermes's extracted facades show ongoing modularization, not evidence that Keli needs the same number of modules. Relevant historical failure classes remain config/update corruption, profile-secret inheritance, unowned child processes and context growth; see the dated register in [PRODUCT_RESEARCH.md](PRODUCT_RESEARCH.md).

## 3. Local development automation — Bun first

The intended contributor workflow is:

```sh
bun install
bun test
bun run dev
bun run build
bun run release
```

These commands are **planned**, not presently runnable in this documentation directory. `bun run release` prepares and validates local artifacts/notes only; it does not create tags, upload, sign with production credentials or deploy. The explicit publication boundary is a protected SemVer tag pushed by an authorized maintainer.

| Command / primitive | Planned responsibility | Boundary / justified exception |
|---|---|---|
| `bun install` | Resolve declared dependencies with committed text `bun.lock`; pin Bun version in repo and CI | CI uses `bun install --frozen-lockfile`; no npm/pnpm lock in parallel |
| `bun test` | Offline unit/invariant/acceptance fixtures by default | Real credentialed connector and OS tests explicitly selected, never silently treated as passing when skipped |
| `bun run check` | Types, dependency-boundary check, docs/trace consistency | Add TypeScript `tsc --noEmit`: Bun transpiles TypeScript but does not type-check it; no Jest/Vitest/esbuild stack |
| `bun run dev` | `scripts/dev.ts` supervises development using isolated temporary state | Watch only safe modules; quiesce/fence owned children before restart; no automatic watch restart of live external jobs |
| `bun run build` | Bun build/compile for local target into `dist/` | All targets via explicit script flag; inspect bundled assets and dynamic/native dependencies |
| `bun run release` | Reuse build, smoke checks, manifest, notices, checksums, release-note preview | Local output only; signing/notarization and publication occur in protected CI |
| `Bun.$` | Short trusted dev/release commands where shell composition helps | Never concatenate user/model text into a shell command; escaping does not enforce authority |
| `Bun.spawn()` | Managed child argv, explicit cwd/env/stdin/output, exit collection and cancellation | Still needs process-tree/OS enforcement; do not inherit the controller's credentials |
| `bun:sqlite`, `Bun.file`, `Bun.write`, `fetch` | Embedded data access, bounded file I/O and HTTP with fewer packages | Atomic replacement/fsync/transactions are still application contracts; use Node-compatible OS APIs where Bun conveniences lack required semantics |
| `Bun.secrets` | First candidate adapter for compatible OS credential stores | Experimental; must pass unlock/restart/update/service tests; locked or unavailable stays locked |

Sources verified 2026-09-11: [lockfile](https://bun.sh/docs/pm/lockfile), [test runner](https://bun.sh/docs/test), [TypeScript](https://bun.sh/docs/runtime/typescript), [watch/hot modes](https://bun.sh/docs/runtime/watch-mode), [Shell](https://bun.sh/docs/runtime/shell), [Spawn](https://bun.sh/docs/runtime/child-process), [SQLite](https://bun.sh/docs/runtime/sqlite), [file I/O](https://bun.sh/docs/runtime/file-io). Prefer Bun's standard fetch implementation; retained provider SDKs must earn their dependency cost through protocol/auth correctness.

Current docs advertise Bun **1.4.2**; the experiments tested **1.4.0**. Plan to pin 1.4.2 for initial implementation, with required compatibility tests before release; this is not a claim it has already passed. Record the exact chosen patch version in a single machine-readable toolchain field and derive workflow setup from it. Upgrade Bun via an ordinary reviewed compatibility PR.

Bun documents Linux `spawn` cgroup integration, requiring root or a delegated subtree, and notes that the option is ignored on other platforms. Therefore the backend must probe effective enforcement; passing an option is not a portable resource limit. Prefer this API where the pinned version and host permit it; do not add a Rust wrapper merely to expose an existing primitive. Timeouts still need termination escalation, exit collection and descendant tests.

`Bun.secrets` uses macOS Keychain and Linux libsecret/secret-service infrastructure; a headless Linux host may lack or lock it. Wrap it behind Keli's narrow credential-source interface. An explicitly configured unattended source may be needed; missing services must produce actionable `keli doctor` output and pause dependent work, never plaintext fallback. Retrieved JavaScript strings and same-user/controller compromise remain outside any promise of secret isolation. [Bun Secrets](https://bun.sh/docs/runtime/secrets)

Use `--watch` only where the supervisor can shut down safely; HMR is optional for stateless development utilities, not policy/state/lease replacement in a live run. No production hot reload of authority modules. Keep development fixtures separate from the real `KELI_STATE_DIR`.

## 4. CI automation

Use small GitHub Actions wrappers around repo-owned Bun scripts. Required PR checks have stable names: `types-and-boundaries`, `tests-linux`, `tests-macos`, `build-smoke`, `dependency-security`, and a final **`required-checks`** that fails if any required job failed, was cancelled or was wrongly skipped. Documentation-only changes may select a lighter path but must still produce the aggregate check and verify links/trace IDs. Workflow/security/state changes always select relevant full suites. Do not use event-level path filters that leave a required check pending forever.

Pin Actions to full commit SHAs and Bun to the reviewed version; set default `permissions: contents: read`, disable checkout credential persistence, bound job timeouts, cache by OS/arch/Bun/lock hash and keep untrusted PR caches away from privileged releases. Ordinary fork PRs receive no provider keys, signing secrets or write token. Do not use `pull_request_target` to execute PR code. GitHub's [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) supports the credential and pinning boundaries; specific Keli check names and policies are design decisions.

Run `bun test` plus type checking with frozen dependency installation, hermetic test environment and temporary state. Use fake providers for deterministic contracts; designated protected integration jobs run narrowly scoped disposable real accounts separately. Maintain per-target evidence for filesystem/network/process/credential enforcement, browser dependencies, MCP/delegate cancellation and install/upgrade recovery. A skipped unavailable backend is a failed support gate, not a green platform result. PR CI needs both OS families; release CI must execute every published OS/architecture artifact on matching hardware. Cross-build success is not runtime validation.

Start dependency security with `bun audit --json`, scheduled and on dependency PRs, plus reviewed lifecycle-script allowlisting. Bun's audit uses registry advisory endpoints; some registries can be unaudited. Track those coverage gaps and Bun/runtime/browser/system advisories separately. Never run `bun audit fix` automatically in release CI. Critical/high exploitable findings block publication; exceptions need a named reviewer, documented reachability/mitigation and expiration. Scanner outage or skipped registry cannot become “no vulnerabilities.” [Bun audit](https://bun.sh/docs/pm/cli/audit)

Enable GitHub secret scanning and push protection where available; select one maintained secret scanner in CI if coverage is unavailable, since Bun has no substitute established here. Add CodeQL/default code scanning where supported without a custom platform. Configure Dependabot for pinned Actions; dependency update PRs must regenerate the Bun lock through the repo workflow (manual reviewed Bun updates are acceptable initially). Pinning does not justify leaving dependencies unpatched. Avoid custom heuristic scanners, multiple overlapping bots or a supply-chain dashboard. Security settings and a synthetic non-secret test of detection are repository-initialization checks, not assumed active today.

## 5. Release automation and supported artifacts

Bun documents compile API/CLI and cross-compilation for all four selected targets. It can embed assets and selected native addons; dynamic loading still needs inspection. The runtime is included, so users need not install Bun to run Keli. These are documented capabilities, not four tested Keli binaries. [Bun executable support](https://bun.sh/docs/bundler/executables)

| Release asset | Compile target | v0.1.0 validation baseline |
|---|---|---|
| `keli-linux-x64` | `bun-linux-x64` | Ubuntu 24.04-class glibc x64; real backend/credential availability checked |
| `keli-linux-arm64` | `bun-linux-arm64` | Same Linux contract on native arm64 |
| `keli-darwin-arm64` | `bun-darwin-arm64` | macOS 14+ Apple Silicon, actual permissions and signed update tests |
| `keli-darwin-x64` | `bun-darwin-x64` | macOS 14+ Intel, actual permissions and signed update tests |

These are support targets, not tested minimum OS versions. CI must validate minimum supported OS and current supported OS before claims. Do not silently delete Intel/macOS or arm64 when runner availability is inconvenient; provision an appropriate runner or keep that release blocked. Windows and musl binaries remain later although Bun supports additional targets. No Docker requirement.

Planned build example (not an implemented command here):

```sh
bun build --compile --target=bun-linux-x64 src/cli/index.ts --outfile dist/keli-linux-x64
```

Prefer `Bun.build()` in `scripts/build.ts` for the manifest-driven matrix. Bundle immutable migrations, default templates and notices explicitly. **Never embed the live SQLite database, credentials, user config or user-created skills.** Test runtime resolution of schema/assets/native modules in the compiled artifact, not only source-mode tests. Disable ambient dotenv/bunfig loading for the compiled control plane where supported by the pinned compile API; test other runtime-option injection surfaces rather than assuming compilation is isolation.

Publication sequence:

1. Reviewed version PR updates the single package version, CHANGELOG and compatibility/migration declaration. Tags use only `vX.Y.Z`, beginning `v0.1.0`; prereleases use SemVer suffixes. No competing CalVer scheme.
2. Protected tag push triggers release CI. Verify tag matches version, allowed commit ancestry and source tree; frozen install; run required checks and build all targets from that exact commit.
3. On native runners, smoke actual binaries with `--version`, `doctor`, isolated init/run, assets/SQLite, shutdown and upgrade/rollback fixtures. Check capabilities and OS enforcement per PRD. Do not publish a partial matrix as the promised full release.
4. Generate manifest containing version, git SHA, Bun version, target, minimum tested OS, schema read/write ranges, files/digests and capability-specific prerequisites. Include matching source archive, dependency locks/notices and any required runtime source/relinking materials. Reproducible inputs/scripts are required; byte-identical notarized output is not promised without measurement.
5. Sign/notarize macOS artifacts using platform tooling and a stable identity; use a maintained signature/attestation mechanism for the release manifest. Bun scripts orchestrate platform tools, not recreate them. Keep release secrets in a protected environment; only publication jobs get `contents: write`, and identity/attestation permissions only where required.
6. Compute SHA-256 over **final signed/distributed bytes**, using Bun hashing; generate notes from merged PRs plus the reviewed changelog. Checksums catch corruption but do not authenticate a compromised download source. Publish signed manifest, artifacts, checksums, source/notices and acceptance evidence together, then mark the release available to `keli update`.
7. Retain prior binaries/manifests and migration compatibility data. Never replace bytes under an existing stable tag; fix with a new patch release. Failed or interrupted builds can be rerun without creating a conflicting release.

One Keli executable is the baseline, not a promise to pack the entire tool ecosystem into it. Playwright browser engines, user-selected coding CLIs and some MCP servers need their own installed binaries/runtime/accounts. Provide lazy verified setup with explicit size/location/version/permissions and readiness diagnostics; do not require Python, Node, Cargo, a browser or Docker merely to launch Keli's core. Bundle maintained JS SDKs where compatible and license-cleared. Test external/native dependencies per target and list them in the release manifest.

Optional Rust/system components: start with none. If an OS primitive demonstrably needs a helper, use a small versioned executor protocol and target-specific helper manifest. CI conditionally installs a pinned Rust toolchain, uses `Cargo.lock`/locked builds, native signing and the same artifact tests; ordinary Bun contributors need Cargo only when editing/building that optional component. Bun cross-compilation does not cross-compile arbitrary Rust or system libraries. Prefer native runner builds over adding another cross-toolchain. A helper can be an accompanying signed asset or embedded and extracted to a verified, non-workspace version directory; either way test tamper resistance, version negotiation and fail-closed absence. If the helper becomes essential on a supported platform, include it automatically for that platform and document the dependency rather than calling it optional to that user.

## 6. Installation and update automation

First install cannot depend on `Bun.$` because Bun is not installed. Keep a small inspectable POSIX/curl bootstrap in `install/` to detect OS/arch, obtain the authenticated release manifest, verify the selected artifact and hand over to `keli init`. This is the concrete exception to Bun-native scripting. Provide download/inspect/run instructions as well as the owner-preferred curl entry point. If platform verification needs an unavailable prerequisite, stop with the exact prerequisite or provide a verified manual path; never silently skip verification. Select a maintained verifier compatible with the release signing mechanism, not homemade cryptography.

Use per-user installation without sudo by default: immutable version directories plus one atomically switched `keli` launcher/symlink. Linux service is systemd user; macOS is launchd user, with explicit consent and an honest explanation of login/sleep/unlock availability. Preserve a stable macOS signing identity; `doctor` verifies actual effective access after updates, since signing alone does not preserve every OS permission.

Engineering path defaults: Linux config at `${XDG_CONFIG_HOME:-~/.config}/keli`, durable data at `${XDG_DATA_HOME:-~/.local/share}/keli`, cache at `${XDG_CACHE_HOME:-~/.cache}/keli`; macOS config/data at `~/Library/Application Support/Keli/config` and `~/Library/Application Support/Keli/state`, cache at `~/Library/Caches/Keli`. These are explanatory path expressions, not literal shell interpolation instructions. Immutable versions live under `~/.local/lib/keli/versions/<version>` and the default launcher at `~/.local/bin/keli` on both platforms, with PATH setup explained. An explicit absolute `KELI_STATE_DIR` groups config/data/cache under that root for isolated operation; resolve paths once, create with restrictive permissions and exclude controller state from tools. Backups/artifacts stay within the selected durable-data tree unless explicitly exported elsewhere. Cache may be disposable; user records never are. Treat these defaults as compatibility surface from v0.1.0 onward.

`keli update` is Bun-authored application code: check/verify/download → stage → acquire exclusive ownership and stop/fence work → snapshot state and migration metadata → check compatibility → migrate transactionally → health/permission checks → atomic binary activation. Retain the previous version until success. Failed activation restores a compatible binary/state pair; it cannot blindly downgrade the binary against a newer incompatible schema. Restore must keep revocation and external-effect receipts safe, with imported jobs paused and unknown effects unreplayed. Explicitly document if restoring a snapshot loses post-snapshot edits and require the user to select that recovery, rather than hiding data loss. PRD I10 and A33 remain authoritative.

`keli update --check` performs no mutation; normal updates are explicit, and future auto-update policy requires user configuration. Uninstall removes owned binaries/service only by default; state deletion is a separate destructive action. Installation/update scripts must have interrupted-download, wrong-hash/signature, wrong-target, disk-full, locked-store and incompatible-schema fixtures. A clean host must install without dev tooling; optional capability setup may add its declared dependencies afterward.

## 7. Lightweight contribution and security governance

Use labels `type:bug`, `type:feature`, `type:docs`, `type:integration`, `type:maintenance`; `priority:p0`/`p1`/`p2`; `status:needs-repro`/`blocked`; and only initially useful areas `area:runtime`, `area:security`, `area:state`, `area:integrations`, `area:release`. Add `good first issue` when curated. Public `area:security` is for hardening, not unpatched vulnerability disclosure. Avoid stale bots on unresolved data-loss/security reports and avoid mandatory labels for every axis.

Forms: bug = version/OS/target, expected/actual, minimal redacted reproduction, affected run/action ID if safe, outcome uncertainty; feature = user problem, existing workaround, fit to PRD, smallest useful result; docs = page/section, confusion and proposed correction; integration = upstream protocol/library/license, auth/scopes, lifecycle/cancellation, setup and tests. All link to SECURITY for private reporting and warn against pasting tokens or private chat histories. Reporter trace IDs are optional.

PR template: concrete problem and resulting behavior; linked issue/PRD invariant/A-ID; ADOPT/ADAPT/BUILD rationale and provenance if relevant; tests/evidence; state/API/permission/update impact; known limits. Do not require every tiny docs change to fill an architecture essay. New failure classes add regression tests; revisions to existing acceptance scenarios preserve their stable IDs.

Protect main and release tags: PR-only main, no force push/delete, required aggregate CI, resolved conversations and stale-review dismissal. Require an independent approval and code-owner review for sensitive changes. CODEOWNERS covers `.github/**`, `src/execution/**`, `src/credentials/**`, `src/state/**`, `src/update/**`, `scripts/*release*`, `scripts/*build*`, `install/**`, dependency/toolchain locks and SECURITY itself. Assign actual maintainers at initialization; a placeholder owner is not an enforced control. Keep ordinary changes lightweight; sensitive changes require at least one qualified reviewer other than the author. If initially solo, document that independent review is unavailable and obtain a reviewer before sensitive release changes; do not claim self-review provides it. Restrict tag creation and release environment access to maintainers. Any emergency bypass must be visible, justified and followed by review.

Enable GitHub private vulnerability reporting before public launch and put the real repository advisory URL in SECURITY and issue contact links; add a tested maintainer contact rather than inventing an email. Publish supported versions (initially latest stable and active prerelease), trust boundaries, reporting instructions, acknowledgement target of three business days and best-effort progress within seven; do not promise fix dates before triage. Coordinate disclosure after remediation and release notes. Public hardening requests are welcome without treating all adversarial prompt behavior as a proven containment breach.

## 8. Repository/release acceptance

These five checks supplement, not replace or renumber, PRD A01–A46:

| ID | Pass condition | Trace |
|---|---|---|
| G01 | Fresh checkout with pinned Bun can install, test, type-check, run dev with isolated state, build and prepare local release without Node/Python/Cargo by default | DEC-TOOLING-01; EXP-NATIVE; I8 |
| G02 | Protected tag builds and natively executes all four final artifacts; manifests/checksums/signatures/notices match; forbidden mutation/tag paths fail | I2/I10; ACCEPT-A33 |
| G03 | Clean Linux/macOS install, interrupted update and compatible rollback preserve seeded durable records; incompatible rollback stops; secret-store lock is honest | I2/I10; ACCEPT-A33, ACCEPT-A44 |
| G04 | Fork PR cannot obtain secrets/publish; sensitive changes cannot bypass required review/checks; private reporting and scanning are verified configured | I2; EVIDENCE-HERMES-82936 |
| G05 | Every port records upstream pin/license/changes, relevant I/A IDs and contract evidence; all historical issue states retain review dates | I1/I9; PRODUCT_RESEARCH register |

Implementation can start with repository documents and the minimal Bun scripts alongside the first PRD vertical increment. No separate tooling platform, deployment experiment or reopened architecture decision is required. Release success remains conditional on the real security/platform/product acceptance evidence, not completion of this plan.
