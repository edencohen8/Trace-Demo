# T015I demo implementation

Baseline: `c51d922`. The working tree was clean. Requirements: the user's full
T015I request in this session. This is the local GitHub demo. The historical
GitLab lane issues do not apply (see `docs/contracts/README.md`).

## Sub-tasks / Implementation Plan

- [x] **Sub-task 1.1: Reproducible evidence package and case context**
  - Add a seeded TypeScript generator, one case, source metadata, hashes and counts.
  - Keep the initial report separate from later observations. No answer keys in runtime inputs.
  - *Verification*: public EvidenceStore loading, hashes, counts, row resolution and old cases.
- [x] **Sub-task 1.2: Deterministic investigation tools**
  - Add request tracing, effective state and region analysis with coverage and uncertainty.
  - *Verification*: source-based tool tests for event order, angular wrap, boundaries, missing state and contradictory variants.
- [x] **Sub-task 1.3: Agent and operator experience**
  - Generic investigation guidance, evidence-linked findings, concise replies and case titles.
  - *Verification*: progress events and source links, isolation, persistence and real browser interaction.
- [ ] **Sub-task 1.4: Live acceptance and report**
  - Five questions × three clean runs, three multi-turn sessions, four isolated counterfactuals.
  - Record first useful update, conclusion time, tools, model calls, sources and failures.
  - *Verification*: real configured provider; `npm run typecheck`, `npm test`, `npm run build`; read-only integration review.

## Settled technical choices

Use stable internal ID `case_005` and the operator's Hebrew title. Keep existing
cases. Add manifest-declared source files to the existing immutable evidence store.
Use generic typed TXT records for component logs and a CSV diary (the architecture
allows equivalent diary formats). Use the existing source badge format.
Recovery upgrades the configuration service, then sends a new cancel request.
The public test seams are EvidenceStore, the tool interface, runChat and the browser.
These cover the data/tools/agent/UI checks explicitly requested by the user.

## Evidence so far

- Live connection check passed with `anthropic/claude-haiku-5-5`.
- No credentials were printed. No private ground truth was read.

## Current verification ledger

- Package: 660 events, eight files including catalog and manifest, seed 15015.
- `npm run typecheck`, `npm test` and `npm run build` pass on the current candidate.
  The suite includes 22 radar tests and 22 answer-quality tests.
- Three independent read-only reviewers checked standards, correctness and product.
  Their code findings were fixed and rechecked. Performance acceptance is pending.
- Browser verified the exact Hebrew title, live progress, summary disclosures,
  and an answer link to the exact `sniffer.csv` source row.
- Earlier live iterations exposed wrong citation attachment, ignored skill-file
  instructions, unnecessary final rewriting, and repeated repairs that timed out.
  Traces remain under `/tmp/trace-radar-pilot*` and `/tmp/trace-radar-acceptance{1,2,3}`.
- The last matrix, `/tmp/trace-radar-acceptance10`, was stopped at the user's
  explicit request to close the work. Its 29 saved turns include 27 completed
  answers and two failures. All 15 openings ran; 14 completed. Traces and measured
  results are saved under `artifacts/t015i/acceptance`.
- Same configured provider/model: `anthropic/claude-haiku-5-5`. Agent and claim
  review reasoning: medium. Routing: low. Safety deadline: 480 seconds.
- The user explicitly accepts long investigations for a sped-up video and asked
  to stop improving response speed. No further latency optimization is planned.
  Correctness, evidence and presentation remain acceptance requirements.

## Handoff and remaining limits

The user explicitly asked to finish even without maximum accuracy. No further
implementation or model tests are running. The local demo remains served.

The final code adds explicit record/ID counts, verified adjacent state continuity,
focused review scope and a checked Hebrew wording edit. Targeted tests and full
code checks pass. A new full live matrix after these changes remains unrun.
The broad evidence follow-up can still exhaust its tool budget during repair.
Two contradictory live variants were stopped before completion; their tool tests
pass. See `docs/T015I-VALIDATION.md` for the exact results and limits.
