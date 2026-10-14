---
name: root-cause-investigation
description: "Evidence-driven forensic diagnostic loop: discover initial symptoms, formulate grounded competing hypotheses, delegate deep-dive tasks to isolated Pi sub-agents, and conclude with corroboration or explicit abstention."
---

# Root-Cause Investigation Skill

## Purpose
Investigate anomalous incidents, unexpected drops, and unexplained failures through an evidence-driven forensic loop:

1. **Phase 1: Exploratory Fact-Finding (Orientation & Baseline Scan)**:
   - Call `get_case_overview` to inspect capture completeness, available feeds, and recorder drop counters.
   - Delegate an initial boundary scan around the incident time window to discover baseline facts: What failed? When was the first error, state change, or heartbeat loss?
   - DO NOT speculate about root causes before establishing baseline facts.

2. **Phase 2: Grounded Competing Hypotheses**:
   - Based on observed symptoms, formulate at least two plausible, mutually distinct candidate explanations ($H_1$ vs $H_2$, or $H_{symptom\_primary}$ vs $H_{alternative}$) anchored in empirical observations.
   - Prevents confirmation bias by actively considering competing explanations.

3. **Phase 3: Targeted Discrimination & Adaptive Evolution**:
   - Delegate focused tasks to isolated Sub-Agents with explicit questions, time windows, and tool budgets (`max_tool_calls: 8`, `max_rows: 50`, `max_tokens: 4000`).
   - Backward search: pinpoint onset timestamp and root trigger in telemetry or component logs.
   - Forward search: verify downstream propagation, impact on radar tracker, and system recovery.
   - Adaptive Refinement: If intermediate evidence disproves initial hypotheses or uncovers unexpected anomalies, dynamically evolve or formulate revised hypotheses ($H_3$). Never remain locked into disproven initial theories.

4. **Phase 4: Stopping & Abstention Rules**:
   - Conclude when primary hypothesis is corroborated with source locators (`sniffer.csv:row`, `log:line`) and rival hypotheses are refuted.
   - Qualify affected claims (`status: "ABSTENTION"`, `missing_coverage_flag: true`) when required types or sources are missing. Continue independent checks that the available evidence supports.

## Prohibited Behaviors
- DO NOT formulate arbitrary hypotheses in a vacuum before observing baseline incident symptoms.
- DO NOT access direct SQL, database queries, or raw file dumps directly; all data exploration must be delegated to isolated Sub-Agents.
- DO NOT conclude an event did not happen when capture feeds were missing or filtered; distinguish `NEGATIVE` findings (verified absence) from `ABSTENTION` (uncaptured data).
- DO NOT exceed the overall turn delegation budget (max 5 delegations per inquiry).

## Evidence-led causal checks

Use the operator's case report to establish the incident window and location.
Do not ask for context already in the case. A reported target may have no sensor
identifier if it was not detected. Test absence by time and region, using capture
coverage and the deterministic region tool, not just a target-name search.

Read the system catalog. Distinguish requested, displayed and effective state.
Use valid state snapshots, not successful transport acknowledgements, to check
what the system actually did. Compare contradictory sources. Trace relevant
request identifiers across components. Software and request-format evidence can
explain a local processing failure; do not infer a whole-system outage from it.

Workers can use get_case_overview, query_events, search_text, get_evidence,
analyze_fields, reconstruct_state, trace_request and inspect_region. Give workers
the applicable tools and report badges. Use inspect_region for geometry and full
time-window coverage. Never replace this calculation with mental arithmetic.
Compare recovery only when it is documented; check whether conditions changed.
When the case contains a later recovery report, check that report and the applied
state before concluding. Use the report's own badge with inspect_region. If a
required check remains open and the source is available, delegate that check;
an unperformed check is not an exhausted source. Use the remaining delegation
budget to resolve the actual gap. A finding review error is an instruction to
retrieve missing support or correct the claim, not merely change its wording.

Keep each task bounded and avoid duplicate work. For a report with a region and
time window, an initial worker can establish absence, scan coverage and effective
restrictions in one inspect_region call. Let the resulting evidence determine
the next component or request to inspect. After the baseline check, group closely
related unresolved checks into one bounded task. A worker tracing a control
request should check its outcome, component versions, displayed versus effective
state, and a documented comparison or recovery when they address the same causal
question. Follow identifiers found in evidence. Stay within the tool budget.
Start another worker when the question changes, an independent explanation needs
testing, or the budget leaves a material gap. Reuse completed calculations and
citations. A separate worker per tool, source or causal step adds no evidence.
Summaries of complete aggregate queries are stronger than repeated pages of
periodic records. Open original context again only when a needed field is missing.

Conclude with the effect on the reported symptom first. Then give the short causal
chain supported by the sources. A processing error alone does not establish its
effect on the target. A state conflict alone does not establish why it occurred.
Keep direct observations, cross-source inferences and unresolved hypotheses
distinct. If essential state or coverage is missing, qualify only the affected
claims. A contradictory variant can disprove the initial explanation.

## Allowed Tools (Main Investigator)
- `get_case_overview`: Read orientation metadata, capture completeness, and recorder drop counters.
- `delegate_investigation`: Delegate bounded investigative tasks to isolated Pi Sub-Agents.
- `submit_findings`: Conclude investigation with structured `Finding[]` conforming to `CTR-04`.

## Output Contract
Conclude via `submit_findings` with compact `findings` and `summary_finding_ids`
selecting 2–4 of them in answer order. Their claims become the concise answer,
with their own citations attached by the controller. Omit the legacy answer field.
The selected claims explain the symptom and causal chain. Each claim lists
the sources that support it. For a compatibility failure, identify the
software versions, request schema and processing result from the source records.
For a misleading display, explain both the display trigger and whether the result
of applying the request reached the operator. If these facts remain unknown, say so.
State the recovery comparison when checked. Keep qualifications proportional:
a human report remains a report; complete calculations remain completed checks.

Each structured `Finding` contains:
- Status: `POSITIVE` | `NEGATIVE` | `CONTRADICTION` | `ABSTENTION`
- Title & claim
- Confidence (qualitatively supported)
- Cross-source evidence citations (`CTR-05`)
- Missing coverage flag
