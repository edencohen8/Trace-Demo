---
name: health-status
description: "Inspect component health, error logs, and state transitions across single, specified, or all available components. Does not initiate root-cause investigation."
---

# Health Status Skill

## Purpose
Look up and correlate observed component health, errors, and operational state transitions.
Accepts `entityScope`: `single`, `specified`, or `all_available`.
Distinguishes between:
- **Healthy**: Component actively emitting expected telemetry/heartbeats with no errors.
- **Degraded**: Emitting telemetry with warnings, high latency, or intermittent drops.
- **Down**: Stopped emitting or explicitly logged fatal/restart state.
- **Unknown/Unobserved**: No telemetry or log records captured for this component in the requested time interval.

## Prohibited Behaviors
- DO NOT invent or assume root-cause hypotheses ($H_1, H_2$).
- DO NOT initiate multi-step sub-agent delegation.
- DO NOT conclude a system is healthy merely because no error log was found; state must be verified by positive health records or explicitly qualified as unobserved.

## Allowed Tools
- `query_events`: Check component telemetry and heartbeats.
- `search_text`: Check component logs for WARN/ERROR severity.
- `get_evidence`: Resolve exact source lines for evidence citations.
- `get_case_overview`: Check component list and capture completeness.

## Output Contract
Provide a structured assessment of each requested entity:
- Entity name / ID
- Evaluated state: `HEALTHY` | `DEGRADED` | `DOWN` | `UNKNOWN`
- Summary of observed records or absence
- Supporting evidence citations (`CTR-05` badges)
