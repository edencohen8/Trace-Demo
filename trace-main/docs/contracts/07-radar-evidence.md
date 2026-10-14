# Local radar evidence and calculations

This extends contract 06 for the local demo only. It does not change the historical
lane APIs. Runtime queries remain closed over one case and never accept file paths.

Manifests can declare `title`, `description`, `files` (format, family and source),
per-file counts and `coverage_by_type`. Only simple file basenames are accepted.
All declared files must match SHA-256 and counts. `case_report.txt` is a human report,
with reported time/position uncertainty. It is not a radar measurement.

JSON-line TXT records contain `timestamp`, `source`, `type`, `severity`, `message`
and scalar `fields`. CSV diary rows use these columns with JSON-encoded fields.
CSV sniffer records preserve the original row locator. Catalog text is also an
immutable, hashed file with source line citations.

State records have `valid_until`. They define a half-open validity interval from
their timestamp to that value or the next state record, whichever comes first.
No state is inferred through a gap. State must come from the reporting component;
a request or receipt does not count as applied state.

Angles are degrees clockwise from true north. Positive sweep from start to end
wraps through zero. Sector boundaries are inclusive. Equal endpoints mean zero
width, not a full circle. Ranges are km, inclusive. Unknown coordinates or validity
produce an unknown result. Report uncertainty is a region, not a radar track.

Tools:
- `trace_request(request_id)`: bounded cross-source event chain, counts, coverage
  and the latest software-version record per participating component at request time.
- `reconstruct_state(at_utc)`: current valid snapshots, provenance and missing state.
- `inspect_region(report_badge)`: detection/track counts in the report's region and
  time window; capture coverage; scan and inhibit overlap over the whole interval.
  Geometry and time calculations run in TypeScript. Returns inputs, method,
  limits and original references. A calculated result has no invented source row.
  Source locators accept wrapped or unwrapped `file:Lnumber` and `file:number`.
  An invalid report reference returns a bounded list of available report citations;
  no filename or ordinal is guessed.

Progress reports real tool results or explicit worker observations. Search row
order does not establish support for a claim. Do not attach the first two search
results to a semantic finding. Final findings and concise answers preserve citations.

`submit_findings` accepts `summary_finding_ids` with 1–4 IDs from its findings.
The controller renders their claims and their own evidence references in that
order. Claim review checks the rendered answer and the detailed findings before
acceptance. No case ID selects an answer, a tool sequence or a conclusion.

A rejected submission retains its candidate findings. `submit_findings.corrections`
updates only the named fields of a finding by ID. Other claims and citations stay
unchanged. The complete resulting candidate is reviewed again before acceptance.
Region results combine unchanged state intervals, return at most 50 input source
references and report truncation. Full-window calculations use all records.

Observation `count` has `count_unit: 'records'`. `distinct_recorded_id_count`
counts different `(source, target_id)` pairs in matching rows. `recorded_ids`
returns at most ten examples; `missing_id_count` and truncation remain explicit.
These recorded IDs do not prove exercise-target identity.

Each shown sector interval includes `continuous_state`: the maximal contiguous
sequence with the same effective state and bounds around that report interval.
It checks every valid snapshot in the source stream, stops at any gap or state
change, and stays within capture bounds. It returns start/end, snapshot count and
original boundary references. This can support a duration outside the report
window; isolated snapshots cannot. Calculation method fingerprint version is
`region-v2`. No extra raw state dump is sent to the model.

Completed messages retain bounded region/statistics results in `computations`.
Focused follow-ups reuse these checked results and receive semantic claim review
inside a bounded repair loop with up to two corrections. Edited reviewed drafts
are checked again. A failed check never becomes a supported observation.
Review scope comes from the selected answer route. Full incident reviews check
causal completeness. Focused reviews check the requested property and any stated
facts; they do not require an unrelated cancellation history or recovery study.

A Hebrew incident summary receives one optional wording edit after factual
acceptance. It must retain the exact citation set and pass scope, source and claim
review again. A failed edit leaves the accepted answer intact. This is language
editing of model findings, not a case-selected answer or a replacement for inquiry.

## Calculation references

`inspect_region` returns `calculation_citation` in the form
`[calc:region:<case_id>:<report_ordinal>]`. The positive ordinal identifies a report
with explicit window bounds in the immutable case package. It is not a source row.
`get_evidence` and the case evidence API accept this handle as well as raw badges.
Unknown ordinals and cross-case handles fail. Resolution reruns the deterministic
calculation, so the link still works after a session or server restart.

The evidence response is `RawSource | ResolvedCalculation`. A calculation has
`kind: 'calculation'`, `operation: 'region'`, `badge`, `title`, the bounded `result`,
original `inputs` badges, package `inputHashes`, and a method/input `fingerprint`.
It has no source file, line, or synthetic event timestamp. Findings use citation
kind `calculation` and omit source locator fields for these handles.

The calculation dock presents the result, limits and input links. Timeline focus
uses actual input events. A calculation never creates a fictitious timeline point.
Claim review receives the resolved result and all references in the answer,
finding claims, rationales and evidence arrays. Complete request-query counts use
their request records and capture metadata as anchors, without an invented row
for absence.
