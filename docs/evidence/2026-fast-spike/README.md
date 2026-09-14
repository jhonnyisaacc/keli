# 2026 fast spike evidence index

Historical screening evidence, now imported onto `feat/v0.1.0` so the branch is
self-contained. Frozen baseline `40743b53fa884a2eec00bfdf5aebc432f97967fa`. Original
research branch `research/2026-fast-spike` at `a4adf90fafa176df9aa259967d9ff78053de3cf7`.
Sanitized path fields are derivatives; see [ORIGINAL_HASHES.json](ORIGINAL_HASHES.json)
and [../PORTABILITY.md](../PORTABILITY.md). No production source changes were made by the
spike.

Current next work is [general-purpose autonomy](../../../plans/general-purpose-autonomy.md),
not a second literature survey.

- [Source screening matrix](../../research/2026-agent-architecture-matrix.md)
- [Pinned code contrast and reuse notes](../../research/hermes-nanobot-keli-gap-analysis.md)
- [Predeclared hypotheses and acceptance gates](../../research/keli-experiment-plan.md)
- [Results and limitations](../../research/keli-experiment-results.md)
- [Architecture decisions](../../architecture/keli-agent-architecture-proposal.md)
- [Reproducible harness](../../../experiments/2026-fast-spike/README.md)
- [Final machine summary](run-final/summary.json), [complete trace](run-final/trace.jsonl)
- [Final validation commands/results](validation-final/summary.json)
- [Repository metadata](recon.json), [pinned source hashes/symbols](reference-index.json)

Experiment selection is explicit via `--only A,B,...`; none is wired into production.
Reproduce to a NEW output directory. Raw traces contain only purpose-built synthetic inputs
and local fixture command outputs, not personal chat histories or secrets. Initial
successful evidence remains in `run-001` and `validation-initial`.

Commit sequence: `45554f3` screening + preregistration; `9a361b5` harness/contrast/initial
evidence; `9f3898f` derived completion metrics and trace-link correction. Final benchmark
executed at `9f3898f80aa5b9eac68e0c72483238ebcc3fa9d5`. Later commits add final
evidence/synthesis only; consult that branch log for their hashes.

## Follow-up: from reference gaps to implementation

[Reference findings](../../research/hermes-nanobot-reference-findings.md),
[exact-source trace](reference-probes/trace.jsonl),
[source hashes and method](reference-probes/summary.json), and the
[current implementation prompt](../../architecture/keli-autonomy-implementation-prompt.md).
All 21 unit/API probes matched recorded expectations. The earlier broad pre-implementation
benchmark requirement is superseded. The research-watch slice those findings justified is
implemented at `e32b2ad`.
