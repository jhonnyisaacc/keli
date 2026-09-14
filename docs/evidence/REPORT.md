**Parallel architecture spikes — completed 2026-09-11.**

# Rust / execution boundary spike

**Verdict: RUST OPTIONAL / OS PRIMITIVES SUFFICIENT.** Landlock provided the demonstrated boundary before Rust was introduced. Rust adds a small typed broker and IPC lifecycle; this experiment found no security property that depends on choosing Rust over another correctly implemented launcher. An unsandboxed Rust broker alone would retain the same user authority as Bun/Python.

## 1. Built

A disposable Bun controller talks to a single-threaded Rust broker over bounded line-oriented stdin/stdout. Requests contain an alphanumeric ID, enumerated operation, hexadecimal UTF-8 path, and bounded timeout. The broker returns a JSON receipt with ID, status, exit code, and elapsed microseconds. It permits a fixed harmless write operation, rejects paths outside an explicit workspace, and executes the child under Linux Landlock. A deliberately exposed `probe_escape` negative-test operation bypasses the broker's path filter to prove that the kernel independently prevents the escape; this is experiment instrumentation, not a proposed product API. A fixed sleep operation tests timeout termination/reaping. No arbitrary shell command is accepted.

The independent Python probe was executed first. It demonstrates that the OS boundary does not require Rust: an unrestricted process could read a fake outside fixture; after Landlock restriction it could write within the workspace, but outside reads, outside writes, and a symlink escape were denied.

## 2. Exact files / authored LOC

All paths are under `$HOME/personal-agent-rust-spike/`.

| File | Lines | Role |
|---|---:|---|
| `broker.rs` | 90 | Standard-library Rust broker, Linux libc calls, policy, timeout, receipt |
| `controller.ts` | 48 | Bun IPC, assertions, restart, timing |
| `os_probe.py` | 38 | Independent OS-first Landlock probe using Python standard library |
| **Total** | **176** | Physical source lines, including blanks/comments |

Evidence: `os-probe.json`, `results.json`, this report. `broker` is the compiled executable. An isolated Rust toolchain is in `toolchain/` and `cargo/`; neither is required in the evidence archive. No Cargo project or third-party Rust crates, Bun packages, framework, container, or production configuration was added.

## 3. Boundary actually demonstrated

A newly spawned effect child is restricted to filesystem writes within the experiment workspace, with read/execute access to standard runtime directories `/usr`, `/bin`, `/lib`, `/lib64` and read access to `/etc/ld.so.cache`. It cannot access the fake outside fixture or write outside the workspace through a symlink. Child standard streams are redirected, its environment is cleared, and restrictions are installed before exec; installation errors prevent spawn.

Bun and the trusted Rust broker remain ordinary same-user processes with ambient user authority. This does **not** isolate a compromised controller or broker, protect against same-user interference, filter network operations, demonstrate a CPU/memory quota, cover arbitrary daemonizing descendants, or establish a macOS boundary. The runtime read allowlist is intentionally small but not a complete product security policy. No production secrets were read. The Python comparison is an unrestricted-versus-restricted fake-file probe, not an attack on deployed Nanobot.

## 4. OS primitives

On this host: Linux `6.8.0-138-generic`, Landlock ABI **4**, x86_64.

- Initial ordinary namespace probe: `unshare --user --map-root-user --mount --pid --fork /bin/true` failed with `uid_map: Operation not permitted`; `bwrap` is absent. No privileged workaround was attempted.
- Landlock `create_ruleset`, `add_rule`, `restrict_self`, with filesystem rights bits 0–14 (including REFER and TRUNCATE).
- `prctl(PR_SET_NO_NEW_PRIVS)` before installing the ruleset.
- `setpgid`, process-group `SIGKILL`, and wait/reaping for a fixed timeout case.
- Ordinary subprocess stdio pipes and `O_PATH`/`O_CLOEXEC` path handles.

These maintained kernel mechanisms enforce filesystem restriction. The Rust source uses host-specific raw syscall numbers and FFI; it is a disposable probe, not a maintained cross-platform sandbox library recommendation. An adopted launcher/library would need independent evaluation outside this spike.

## 5. Test results

**14/14 Bun assertions passed.**

| Case | Observed result |
|---|---|
| Allowed harmless write | Executed; expected file content checked |
| Explicit outside path | Rejected by broker before effect |
| `../` traversal | Rejected by broker |
| Symlink to outside directory | Rejected by broker |
| Same symlink with broker path check deliberately bypassed | Kernel prevented effect; child failed; no outside file created |
| Unknown `delete` operation | Rejected; existing allowed file remained |
| Malformed hex path / NUL path / zero timeout | Rejected |
| Fixed one-second sleep with 30 ms deadline | Killed/reaped; observed total **38.908 ms** |
| Broker after timeout | Responded normally |
| Clean shutdown, real process restart, new allowed write, final shutdown | Passed |

Separately, the OS-first probe succeeded on allowed write and denied outside read/write and symlink write. This is bounded functional evidence, not a security audit or arbitrary-code adversarial evaluation.

## 6. Warm IPC overhead

After 20 warm-up pings, **200** measured requests:

- Median round trip: **212.145 µs (0.212 ms)**.
- p95 round trip: **937.172 µs (0.937 ms)**.
- Broker-reported median internal ping work: **0 µs at integer-microsecond resolution**, not literally zero cost.

Measurement includes Bun request encoding/pipe write, Rust parse/validate/receipt, and Bun pipe read/JSON parse. It excludes child spawn, sandbox setup, model work, and fake effect execution. This is a single noisy host sample, not a production performance claim. Runtime versions: Bun 1.4.0; Rust 1.98.1.

## 7. Complexity added

One executable (~4.4 MB unstripped), one persistent process, a small protocol, Rust compilation/toolchain, and platform-specific FFI plus child lifecycle handling. Third-party package dependencies: **zero**. Boundary correctness rests on the allowlist and kernel restriction, not Rust's language branding. The Python-only probe already produced the core confinement result. A Bun application still needs a supported way to apply restrictions to a child; this spike does not demonstrate that Bun exposes Landlock directly or select a production launcher.

## 8. Verdict and scope

**RUST OPTIONAL / OS PRIMITIVES SUFFICIENT.** The filesystem boundary is meaningfully stronger for the effect child than an unrestricted same-user subprocess. A dedicated Rust broker is not justified as a required architectural component by these results. Keep an OS confinement boundary; do not infer that this minimal Linux filesystem probe is a complete sandbox or that a Rust rewrite is needed.

No product, PRD, E2, scheduler, transport, real delegate, external message, browser, or production modification was performed. Architecture B evidence was not changed.

Reproduce locally on compatible Linux (writes only spike fixtures):

```sh
cd $HOME/personal-agent-rust-spike
python3 os_probe.py
./toolchain/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustc --edition 2024 -O broker.rs -o broker
$HOME/.hermes/node/bin/bun controller.ts
```


---

**Native Bun model slice — NATIVE BUN CLEARLY BETTER for the narrow proposal role tested.**

The replacement is a 29-line Bun adapter using built-in `fetch`. It sends one small OpenAI-compatible request, parses one candidate, rejects tool-call responses, and returns to the existing Bun authorization gate. It introduces no tool execution or second reasoning layer. The result does not justify porting Nanobot or claim equivalent intelligence on live models.

**Files and code size**

All files are in `$HOME/personal-agent-native-spike`.

| Source | Lines | Provenance |
|---|---:|---|
| `native.ts` | 29 | New native proposal adapter |
| `test.ts` | 77 | New shared provider fixture, correctness and matched warm tests |
| `cold.ts` | 8 | Two additional cold Nanobot readiness samples |
| `core.ts` | 120 | Copied Architecture B control core; only child environment gains `PYTHONDONTWRITEBYTECODE=1` |
| `adapter.py` | 66 | Copied/adapted B comparator; uses shared fixture instead of its own server |
| **Total** | **300 in 5 files** | **114 new lines; 186 copied/adapted comparison/control lines** |

The `Core` behavior/authorization/effect implementation is unchanged. Its local SQLite database is fresh. The `.venv` link points to B's existing comparison environment for read-only reuse; Python bytecode writes are disabled. All 15 files in B's evidence manifest retain their hashes, recorded in `b-evidence-verification.json`. No production files or B evidence were edited.

**What was replaced**

Only B's proposal-engine invocation: build a prompt from user request, current rule projection and action identity; perform one configured model request; parse a candidate; return it. The native request has a tiny system instruction and a JSON user payload, requests JSON output, uses a five-second fetch timeout, and fails on HTTP errors, malformed JSON, oversized candidate text, non-final responses, or tool-call responses. Authorization still belongs entirely to the reused Bun core.

This is one model step, sufficient for the current proposal flow. It is not a generalized multi-turn agent loop. The candidate has `id`, `scope`, `key`, `revision`, and `delegate`; the existing gate validates exact fields and matches current authority before the fake effect.

**What was not replaced**

No skills system, model-routing ecosystem, provider authentication ecosystem, streaming/realtime support, provider retries/fallbacks, compaction, memory, scheduler, transports, MCP, browser, subagents, tools, plugin system, or general Nanobot capability set. No live provider compatibility or model-quality comparison was performed. The mocked endpoint accepts the requested JSON response mode; support across real OpenAI-compatible providers is not established.

**Executed tests**

13 assertions passed: wrong delegate blocked, correct delegate allowed, forged terminal status blocked, wrong scope blocked, wrong action ID blocked, provider tool-call response rejected, HTTP 503 rejected, malformed JSON rejected, revision changed between proposal and gate enforced, next action uses OpenCode, undo restores Codex, both benchmark engines make one provider call and pass the gate, and native requests contain no tools.

The native adapter is effect-free. All fake effects and terminal records come from the copied B gate. The fixture deliberately supplies adversarial outputs; neither adapter is credited with detecting policy conflicts before the gate. This verifies the data/control path, not whether a real model will consistently choose the right candidate.

**Matched comparison**

Bun 1.4.0; Python 3.12.3; Nanobot upstream pin `c4a25c9a0977f5729ffabde0b10f641dae08774d`. Both adapters call the **same Bun-hosted loopback OpenAI-compatible fixture**, which returns the same deterministic candidate behavior. The fixture's controlled test request supplies the expected candidate for either arm; this avoids treating the canned response as an intelligence test. Each arm goes through the same Bun prepare/authorize/fake-effect/terminal path, with identical SQLite durability settings.

13 alternating pairs were run; pair 0 was excluded, leaving **12 warm samples per arm**. The mock provider contributes no real inference delay. It records actual HTTP request bytes and a common compact-JSON serialization of message context, avoiding cross-language whitespace inconsistencies. Raw requests are retained in `requests.json`.

| Metric, median unless stated | Native Bun | Bun → Python/Nanobot |
|---|---:|---:|
| Provider calls per successful action | 1 | 1 |
| Actual HTTP request-body bytes | **521** | **23,147** |
| Compact serialized message-context bytes | **450** | **8,929** |
| Common `cl100k_base` tokens of serialized full request | **131** | **5,017** |
| Common tokens of compact serialized messages | **116** | **2,059** |
| Engine duration | **2.95 ms** | **174.38 ms** |
| Full Bun action, including durable records | **16.56 ms** | **185.71 ms** |
| Full-action observed range | 9.69–44.49 ms | 155.58–298.39 ms |
| Bun deterministic wall time, including SQLite I/O | 12.19 ms | 10.08 ms |
| Cold readiness, three launches each | **38.19 ms** | **1,883.59 ms** |
| Runtime processes, excluding a real external model provider | **1 Bun process** | **1 Bun + 1 Python process** |
| Third-party package requirements for native slice | **0** | Nanobot declares 35 active direct requirements |

Cold native measurement includes launching a Bun process, importing the adapter, printing readiness and exit; Nanobot measures child readiness after SDK initialization via a ping, without inference. Native samples were 63.25, 38.19 and 17.44 ms; Nanobot samples were 1,593.31, 2,043.87 and 1,883.59 ms. This is process initialization on this host, not a cold filesystem or cold model-service benchmark. Normal native operation adds no child process to the existing Bun core.

The comparison virtualenv contains **89 distributions excluding pip**, including Nanobot and its dependencies. That environment count includes packages retained from the B lock and is not a claim that every installed package is necessary for the narrow slice. The native model path needs no Python environment. Bun itself and its built-in runtime components are not counted as third-party npm dependencies.

Token figures use the same locally available tokenizer for both serialized requests; they are **comparative estimates, not provider prompt-token accounting or billing**. Full-request token estimates include serialized tool schemas and metadata; native requests omit tool definitions entirely. Cache behavior and real provider usage are unavailable. No caching advantage is inferred.

The differences are large for this deliberately narrow mock workload: the native adapter avoids generic runtime context, unused tool descriptions and Python/SDK initialization. The original B run measured 163.73 ms for full actions and 151.74 ms inside Nanobot; this matched rerun measured 185.71/174.38 ms. Host variation and the shared-fixture change make the new paired comparison preferable to comparing historical runs. Tiny differences in SQLite timings have no architectural significance.

**Operational complexity and verdict**

The native path removes child lifecycle management, JSON-lines IPC and Python dependency deployment for this proposal function. It retains one endpoint, one model setting, a small request, response parsing, and the existing authoritative gate. The comparator files and `.venv` link are test apparatus, not native runtime dependencies.

**NATIVE BUN CLEARLY BETTER for this tested proposal-only slice.** It is materially smaller in request/context footprint, dependency surface, process count and measured synthetic latency. This does not establish real-model instruction quality, parity with Nanobot's broader features, or a reason to rewrite those features. Production retry, provider quirks, real model latency and security isolation remain outside this spike.

No product implementation or PRD was started. The companion execution-boundary spike runs independently; this report makes no sandbox claim.

Evidence: `results.json`, `requests.json`, `cold-extra.json`, `summary.json`, `test.log`, and `b-evidence-verification.json`. API references: [Bun fetch](https://bun.sh/docs/api/fetch), [pinned Nanobot SDK](https://github.com/HKUDS/nanobot/blob/c4a25c9a0977f5729ffabde0b10f641dae08774d/docs/python-sdk.md). Exact measurements come from execution, not documentation.


**Final recommendation — C. Fully native Bun core/model slice + OS sandbox.**

For the near term, keep the existing Bun authority/effect gate, replace only the tested proposal-engine role with the tiny native Bun adapter, and confine execution children with OS-enforced restrictions. Rust is not a required architectural component on this evidence.

This recommendation is deliberately narrower than a native Nanobot rewrite. Neither spike replaces skills, provider ecosystems, tools, memory, scheduling or transports. The scripted-provider result does not establish live-model quality or full provider compatibility.

The security evidence is Linux Landlock filesystem confinement of an effect child plus a fixed-command timeout. It is not a complete sandbox, network policy, macOS solution, or defense against a compromised controller/broker. A production launcher/library has not been selected, and the spikes were not combined into an end-to-end sandboxed native product. The independent Python Landlock probe proves the demonstrated restriction does not depend on Rust; it does not prove Bun has a direct built-in Landlock API.

Both disposable spikes ran in parallel. All 27 main assertions passed, plus the independent OS-first allowed/denied probe. Architecture B evidence was verified unchanged. No product implementation or PRD followed.
