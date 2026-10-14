# Local demo adapter

This adapter implements the user's requested database-free demo. It does not
replace the database architecture for the full platform. It uses the existing
Pi agent harness, four skill definitions, tool profiles, and source citations.

## Storage and evidence

- Read only the four cases under `TRACE_v03_investigator_data/fixtures`.
- Verify each original file against its SHA-256 in the capture manifest.
- Parse CSV, five TXT log formats, and the single-sheet Excel diary in TypeScript.
- Preserve identifiers, including four-character Mode 3/A codes, as strings.
  Decode JSON log messages before extracting numeric key/value fields.
- Convert source timestamps to UTC. Interpret Excel dates as local wall-clock
  values using the manifest offset. Preserve reported precision and recording time.
- Keep events in memory. Persist successful chat turns and approved answers in
  `.state/<case_id>.json` with serialized, atomic writes.
- Use exact substring search. There are no embeddings or semantic search.
- All query and calculation tools close over the active case. They do not accept
  a filesystem path. Runtime code never imports the simulator or its answer keys.
- Citations use `[file:Lnumber]`. CSV line 1 is its header. Diary lines are worksheet
  rows. The response includes the sheet name. Manifest citations also use line numbers.
- The diary inspector shows decoded cell values, not the binary workbook bytes.
- Decoded diary dates carry the manifest's local offset. They are rounded to the
  same second precision as normalized event times and never mislabeled as UTC.
- Do not use this in-memory adapter for multi-GB evidence. This demo loads about
  109,000 sniffer rows across four fixed cases.

## HTTP contract

All responses use JSON except the chat stream and the built frontend. Errors have
an `error` field. Each case endpoint rejects unknown case IDs.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/status` | Provider, model, credential-present flag; no secret values |
| GET | `/api/cases` | Coverage, counts, files and diary observations |
| GET | `/api/cases/:id/events` | Bounded rows, total, offset and nextOffset |
| GET | `/api/cases/:id/timeline` | 90 time bins, with counts and warnings per source |
| GET | `/api/cases/:id/timeline-points` | Bounded source-time markers, total point/record counts and truncation flag |
| GET | `/api/cases/:id/timeline-focus` | Display groups covering every filtered record, total record count and time resolution |
| GET | `/api/cases/:id/timeline-group?group=…&series=…` | Group metadata, source/type/target series, numeric ranges with exact references and a paged list of original records |
| GET | `/api/cases/:id/evidence?badge=…` | Exact original lines, source metadata and hash |
| GET | `/api/cases/:id/session` | Saved chat and approved answers |
| GET | `/api/cases/:id/export` | Download the same state as JSON |
| POST | `/api/cases/:id/chat` | `{text, evidence: string[], timeRange?: {start, end}}` → SSE progress and final answer |
| POST | `/api/cases/:id/approve` | `{messageId}` → save a validated answer as an approved lesson |

Event/timeline filters: `start`, `end` (ISO timestamps with offsets), `system`, `source`,
`target`, `messageType`, `query`, `alertsOnly`. Events also accept `limit` (max 500)
and `offset`. The UI shows 80 rows per page. Agent tools return at most 50 rows.
Timestamp filters without an explicit timezone are rejected. The server's local
timezone must not change the selected evidence.
Gap calculations return `count` for source records and `interval_count` for the
measured gaps between consecutive records. N records produce max(0, N−1) gaps.
Field differences use scaled decimal integers before conversion to the numeric
result, so binary subtraction tails do not appear as source measurement precision.

The timeline uses five named display groups. This mapping groups existing evidence
for display; it does not assert that the fixture's components share physical hardware.

| System ID | Track name | Evidence sources |
| --- | --- | --- |
| `iff` | IFF System | `iff-receiver` |
| `sensor` | Sensor Controller | `radar-psr-01` |
| `operator` | Operator Station | `ui-gateway`, `operator` diary |
| `services` | Services Server | `track-core`, `position-bridge`, `alert-router` |
| `radio` | Radio System | None in the current evidence package |

Radio System shows “No data supplied”; an empty track is not evidence of inactivity.
Each source belongs to one group. System filters and source filters can be combined.
Queries, citations and AI tools retain the original source IDs.

## Jade workspace

The working UI uses the final `design-lab` Jade bottom-panel design. It does not
import the prototype data, chat replies, or design/color controls. The recording
overview is the same width as the system timeline below it. The live chat spans
the full workspace height beside both timelines and the source panel.
The source panel is 220px tall on desktop (210px on shorter screens); its content
scrolls while its header, source tabs, timeline and chat remain in place.

The panel has summary, decoded fields and exact-source tabs. The source tab retains
line highlights, worksheet names and file hashes. Records, operator diary and
capture coverage are available from the timeline toolbar. Existing API filters,
80-row pagination, evidence attachments, validated citations, investigation progress,
approved conclusions and JSON export remain connected to the local demo API.
The overview retains its 90 aggregate bars. System lanes position points at the
original event timestamps, rather than at evenly spaced bin centers. Records in
the same system at exactly the same timestamp share a point. Its representative
prefers errors, warnings, then diary entries. The point opens the exact source;
the card's pager can inspect other records in that same-time group.
Each system returns at most 300 points. Wider windows use a deterministic sample,
prioritizing warnings/errors and diary entries, and disclose the shown/total
point counts. Zooming in exposes more detail. Sampling never moves a timestamp.
Points use five stable vertical bands within each system to separate nearby
records, with a small stable offset inside each band. The layout prefers a band
per evidence reference and avoids nearby points in it when space permits.
Vertical position is only for readability;
it does not encode severity or a measured value. Horizontal positions retain the
exact source timestamps. Selection does not recalculate the layout.

Selecting a point, diary entry or record row opens its source in the bottom card.
Chat citations also focus the exact cited event on the timeline. Hover and keyboard
focus preview it without moving the window; a source outside the view is identified
by its time. Sources without an event timestamp remain available in the inspector
and do not receive an invented timeline position.

A completed answer focuses all unique citations from its body and detailed
findings, excluding unrelated tool history. Saved answers have an explicit action
to restore their evidence view. The camera fits the actual timestamps with 20%
padding on each side and a 30-second minimum window, clamped to the recording.
Exact evidence pins remain visible independently of grouping or sampling. Other
timeline records dim but remain interactive. Diary pins retain their approximate
time distinction. Focus temporarily clears filters; Back restores the prior
window and filters. Clear removes highlights without moving the window.

The 560ms camera transition uses bounded interpolation with no endpoint overshoot.
Manual navigation cancels it. A turn never takes back the camera if the user
navigated while waiting. No camera changes occur during streamed tool progress.
Reduced-motion preferences skip the animation. Changing cases cancels pending
source focus and clears selections. Evidence resolution runs at most six reads
concurrently and reports unavailable or untimed sources.

The range-selection control or Shift-drag selects an interval. The selected range
appears in the composer before sending and can be removed. The current window can
also be attached without dragging. Individual evidence attachments retain the
eight-reference limit. Ctrl/Command-click attaches an individual timeline record.
The optional chat `timeRange` uses explicit timezone timestamps, is validated
against the active recording, and has positive duration. It is saved on the user
message and supplied to routing, investigation and answer validation as explicit
question scope. It contains no raw row dump. Existing messages remain compatible.
The mouse wheel over the system plot or its time axis zooms around the pointer:
up zooms in, down zooms out. It stops at 15 seconds or the full recording extent.
The axis updates immediately; event queries wait for a 90ms pause in the gesture.
Pending older responses cannot replace the new window. Chat and source-panel
scrolling, horizontal gestures, and Ctrl/Command browser zoom remain separate.
Dragging the system plot or time axis moves the content with the pointer: right
reveals earlier time, left reveals later time. It preserves the window duration
and clamps at the recording boundaries. A five-pixel horizontal threshold keeps
ordinary record clicks separate from drags. Pointer capture keeps an active drag
working outside the plot; its release click cannot select a record. The axis and
existing markers move during the gesture; fresh records load when it ends.
Vertical touch scrolling and the chat/source panels retain their normal behavior.
Record navigation crosses page boundaries within the current filtered result or
selected same-time group. A source opened outside that result does not claim a
position in it.
On mobile, timeline and chat have separate views; attaching evidence opens chat,
and following a citation opens the source panel over the timeline.

### Focused timeline trial

The default `focused` display replaces sampled dots with time-bounded activity
groups. The `records` display keeps the previous source-time markers and its
explicit sampling notice. Neither mode changes evidence or the agent's queries.

Focused mode accounts for every filtered row exactly once. Known periodic types
from the public catalog (RadarScan, DetectionCandidate, SensorHealth, TrackUpdate,
UiTrackPublished, IFFReply, PositionReport) share a quiet activity band per system
and time bucket. Buckets use UTC-aligned, rounded durations targeting ten buckets
per viewport. Their rendered endpoints are the first and last actual records,
not claims of continuous activity or healthy operation. Windows of 30 seconds or
less show individual periodic records. Activity bands are a display container;
their drill-down separates source, family, type, target, track/sensor identity,
severity and non-measurement content. Transport timestamps, message sequence/ID,
the scan counter, and the explicitly listed continuous numeric fields do not
split series. Each numeric range stays within one series and cites its extrema.
No global numeric anomaly score or relevance pruning is applied.

Diary notes, unknown/non-periodic messages, component reports and warnings stay
separate from activity bands. Exact repeated content can share a counted marker
within a time bucket. Changes to track state, filter revision, position quality,
delivery state, Mode 3/A code or reported sensor status get separate markers even
at INFO severity. State comparisons use the same source/type/target/track/sensor
stream across the full case, so zoom and text filters do not invent transitions.
The first observation has no assumed prior state. A change is not a causal claim.

Group IDs are deterministic hashes of kind and membership boundaries/count.
Group reads rebuild within the original case and filter scope; unknown groups or
series fail. Pagination is capped at 500 rows, with 80 rows in the UI. Clicking a
group opens the bottom panel, where source/type/target series, measurement ranges
and all original rows are available. Selecting a series or paging this panel does
not alter the timeline filters/window. Exact-source inspection retains a return
to the group and the existing chat attachment action.

## Answer presentation

Answers use natural Hebrew by default, unless another language is explicitly
requested. Simple questions get 1–3 sentences. Summaries target 30–70 words in two
short paragraphs, with the main observation first and uncertainty stated clearly.
Common component names have Hebrew aliases for both prose and coverage checks.
Answers over 120 words receive one editing pass unless the user requested detail.
Numeric and causal answers keep their validated first draft so editing cannot
drop measurements, supporting sources, or qualifications. Their prompt asks for
concise output with the requested units and time precision. Language correction
still applies. Any edited answer must pass coverage checks and preserve the full
set of original citations.
An explicit instruction such as `Use English` overrides the Hebrew default.
A draft that is still mainly Hebrew receives the same single editing pass before
final validation. The correction cannot introduce new citations.

The investigation `submit_findings` tool can return a concise `answer` alongside
its structured findings. The UI displays that answer and keeps detailed findings
under an expandable section. Chat messages can include an optional `details`
array of `{title, explanation, citations}`. Citation validation applies before
the answer is shown. Existing saved messages remain readable.
If `answer` is absent, one bounded composition call receives the complete findings,
including all citations and qualifications, and the original language request.
The resulting answer passes the same source and scope checks.

Markdown is parsed into Vue nodes, with bold text, paragraphs and lists. Hebrew
messages use RTL; citations and code are isolated LTR. Raw HTML is escaped. Model
output cannot load images or create arbitrary active links. Citation buttons
continue to open the exact source record.
Citation labels use short Hebrew source names and row numbers. The original
badge remains the lookup key and is available in the button tooltip.

SSE frames contain `data: <JSON>`. Event types are `status`, `tool_call`,
`tool_result`, `done` and `error`. Status and tool events can include a `step`:
`{id, title, detail, state, startedAt, completedAt?, completionOrder?, citations?}`. Tool steps use
the tool call ID so parallel calls update their own row, including failures.
The UI places completed/error steps in completion order, followed by one loading
row for the latest active tool (or the current phase when no tool is active).
Outer phases do not add duplicate spinners. Collapsed mode keeps the last three
finished steps plus that loading row. Saved steps retain their original timestamps.
A completion sequence breaks ties when several checks finish in the same millisecond.
Human-readable descriptions use the actual source/time filters, record counts,
numeric results and public investigation goals. They do not stream model reasoning
or unvalidated assistant text. A completed answer can retain these steps in its
optional `activity` array, displayed as expandable investigation history.
Only a `done` answer is saved. Client disconnects abort the
request. One turn can run per case at a time. The server deadline is three minutes.

## AI and validation

`TRACE_AI_PROVIDER=anthropic|gemini|litellm` selects the provider.
`TRACE_MODEL_ID` selects the model or gateway alias. Settings are read from the
local `.env` on each request. Shell values take precedence.
The default Claude model is `claude-haiku-5-5`.

Routing uses low reasoning effort and a 4,096-token output limit. Agent calls use
low effort and an 8,192-token output limit. Routing rejects truncated or empty
responses before JSON parsing. The model does not repeat the question or case
context in its routing JSON; the server retains those fields.

Normal turns use the existing intent router, one skill profile and bounded tools.
Causal requests use the existing main investigator and delegated workers.
Native Claude and Gemini calls, and OpenAI-compatible LiteLLM calls, all use Pi AI.
Evidence follow-ups can read both original evidence and the full case coverage
overview. Original context lines returned by a tool or attachment are eligible
citations. Unread lines remain ineligible. Groups of complete citation references
are split into individual badges before validation; this does not approve them.
Within a citation group, a line-only reference such as `L53` uses the preceding
explicit filename. Ranges and ambiguous references still fail validation.

Validation checks route shape, required entities, citation format, source existence
and whether cited evidence was available to the turn. A normal answer gets at most
one repair attempt. This validation does **not** prove that each causal claim is
correct. Live model quality still requires a human QA pass. A saved lesson is an
explicit user approval, not an automatic root-cause verdict.
Health questions about all systems must report every available component. For
causal questions, inferred candidate components do not create a new health-report
requirement. Component names explicitly requested by the user remain in scope.

## Local access

Bind to `127.0.0.1`. Reject cross-origin API requests. Vite blocks direct reads of
credentials, state, Git metadata and all simulator files. Production mode serves
only `dist` and the scoped API. The demo has no authentication or multi-user access
control and is intended for local use.
