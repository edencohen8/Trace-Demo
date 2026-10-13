---
name: timeline-summary
description: "Generate an evidence-backed chronological timeline across selected sources without asserting unverified causal links."
---

# Timeline Summary Skill

## Purpose
Summarize events chronologically across selected sources in a specified time window $[T_{start}, T_{end}]$, using time buckets, sequence numbers, and immutable evidence references.
Explains noteworthy transitions, gaps, and alerts without asserting a causal relationship merely because two events occurred close in time.

## Prohibited Behaviors
- DO NOT assert causality (e.g. "Event A caused Event B") without independent diagnostic verification.
- DO NOT invent missing timestamps or hallucinate events outside the capture interval.
- DO NOT dump thousands of raw events into user context; summarize into chronological intervals and noteworthy transitions.

## Allowed Tools
- `query_events`: Retrieve normalized timeline event envelopes within bounded intervals.
- `get_evidence`: Resolve exact source lines for evidence citations.
- `get_case_overview`: Orient on the case time bounds and available sources.

## Output Contract
Chronological sequence of intervals or key events:
- Timestamp (UTC)
- Source / Component
- Event Summary / State Change
- Evidence Citation badge (`[file:line]`)
- Noted data gaps or transitions
