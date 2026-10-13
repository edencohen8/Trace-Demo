# Restricted sniffer export — case_004

> **PRIVATE ANSWER KEY — DO NOT UPLOAD TO TRACE.** This is for the evaluation team, not for the investigating agent.

## Scenario

All cases contain routine scans, target movement, background IFF traffic, health reports, logs and Hebrew diary notes. The system is mostly healthy.

- **Incident reference:** `2026-10-08T14:03:00+03:00` (Israel time, UTC+03:00 for this example)
- **Case ID:** `case_004`
- **Input for TRACE:** `fixtures/case_004/raw/` plus `fixtures/case_004/capture_manifest.json` and `public_system_catalog.json`

## What fails (private)

The track processor changes its confidence threshold from 0.64 to 0.80 for a short period. The sensor still reports low-confidence observations for T-017, but no track is confirmed for this target.

## Which files to inspect

- sensor.txt: routine scans and sensor state
- tracking_service.txt: processing and configuration
- ui_gateway.txt: published tracks and normal gateway health
- external_position_adapter.txt: reference source status
- notification_service.txt: alert delivery and retries
- operator_diary.xlsx: human notes; reported times are approximate

## Clues to look for

- The sniffer export does not contain DetectionCandidate or FilterConfigApplied messages.
- The original bus history does contain both messages; they were removed by the export filter.
- The diary mentions an expected target that was not visible. This does not prove a filter failure.

## Example evidence locations

- **Private check only:** unfiltered message `MSG-00017521` is a `DetectionCandidate` for T-017, but it is absent from `sniffer.csv`.

Message IDs are examples from this generated run, not fixed requirements for future random seeds. Recompute evidence locations after regeneration.

## Suggested investigation path (for human reviewers)

1. Search near the diary reported time.
2. Compare candidate counts and track updates for the target.
3. Inspect the active policy revision.
4. Check whether the sniffer export includes the relevant message types.

## Expected final conclusion

**Evidence is not sufficient to prove the root cause from the selected sniffer export.** The simulator knows the filtering cause, but the investigator should describe the missing message types and any limits of available TXT logs instead of pretending to know the hidden configuration.

## Benchmark: pass conditions

- [ ] State which message types are missing from the selected export.
- [ ] Report that the available sniffer data alone cannot confirm the filtering cause.
- [ ] Name the missing records that could resolve the uncertainty.

## Benchmark: claims to reject

- [ ] Do not claim that no detection occurred just because DetectionCandidate was not exported.
- [ ] Do not give the hidden filter threshold as a proven fact unless independent uploaded evidence supports it.

## Evidence policy

Any factual conclusion must point to an original raw file row or log line. Absence from a filtered export is **not** proof that an event did not happen. An evaluation result must distinguish what the simulator knows from what the uploaded files prove.
