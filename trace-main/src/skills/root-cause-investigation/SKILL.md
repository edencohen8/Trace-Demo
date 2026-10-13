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
   - Immediately abstain (`status: "ABSTENTION"`, `missing_coverage_flag: true`) if required message types or sources were filtered out of capture (e.g. `case_004`).

## Prohibited Behaviors
- DO NOT formulate arbitrary hypotheses in a vacuum before observing baseline incident symptoms.
- DO NOT access direct SQL, database queries, or raw file dumps directly; all data exploration must be delegated to isolated Sub-Agents.
- DO NOT conclude an event did not happen when capture feeds were missing or filtered; distinguish `NEGATIVE` findings (verified absence) from `ABSTENTION` (uncaptured data).
- DO NOT exceed the overall turn delegation budget (max 5 delegations per inquiry).

## Allowed Tools (Main Investigator)
- `get_case_overview`: Read orientation metadata, capture completeness, and recorder drop counters.
- `delegate_investigation`: Delegate bounded investigative tasks to isolated Pi Sub-Agents.
- `submit_findings`: Conclude investigation with structured `Finding[]` conforming to `CTR-04`.

## Output Contract
Conclude via `submit_findings` with structured `Finding` objects containing:
- Status: `POSITIVE` | `NEGATIVE` | `CONTRADICTION` | `ABSTENTION`
- Title & claim
- Confidence (qualitatively supported)
- Cross-source evidence citations (`CTR-05`)
- Missing coverage flag
