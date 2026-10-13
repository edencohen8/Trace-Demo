# Missed radar detection — case_001

> **PRIVATE ANSWER KEY — DO NOT UPLOAD TO TRACE.** This is for the evaluation team, not for the investigating agent.

## Scenario

All cases contain routine scans, target movement, background IFF traffic, health reports, logs and Hebrew diary notes. The system is mostly healthy.

- **Incident reference:** `2026-10-08T14:03:00+03:00` (Israel time, UTC+03:00 for this example)
- **Case ID:** `case_001`
- **Input for TRACE:** `fixtures/case_001/raw/` plus `fixtures/case_001/capture_manifest.json` and `public_system_catalog.json`

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

- T-017 appears in repeated sensor candidates, with confidence below the active filter threshold.
- There is no confirmed TrackUpdate or UiTrackPublished for T-017 while the fault is active.
- The tracking-service log records a policy change shortly before the observation.
- Ordinary targets continue to produce tracks; not all radar processing stops.

## Example evidence locations

- `sniffer.csv`, message `MSG-00017234`, 14:02:30 Israel time: `FilterConfigApplied` (threshold=0.8, filter_revision=R32)
- `sniffer.csv`, message `MSG-00017521`, 14:03:10 Israel time: `DetectionCandidate` (target_id=T-017, confidence=0.747)

Message IDs are examples from this generated run, not fixed requirements for future random seeds. Recompute evidence locations after regeneration.

## Suggested investigation path (for human reviewers)

1. Search near the diary reported time.
2. Compare candidate counts and track updates for the target.
3. Inspect the active policy revision.
4. Check whether the sniffer export includes the relevant message types.

## Expected final conclusion

The track processor changes its confidence threshold from 0.64 to 0.80 for a short period. The sensor still reports low-confidence observations for T-017, but no track is confirmed for this target.

## Benchmark: pass conditions

- [ ] Find the active threshold and the target confidence values.
- [ ] Confirm that the target has detections but no corresponding confirmed track.
- [ ] Relate the missing downstream records to the short configuration interval.
- [ ] Distinguish this from a radar power failure or a UI-only outage.

## Benchmark: claims to reject

- [ ] Do not say the radar never saw the target.
- [ ] Do not infer a hardware malfunction without evidence.

## Evidence policy

Any factual conclusion must point to an original raw file row or log line. Absence from a filtered export is **not** proof that an event did not happen. An evaluation result must distinguish what the simulator knows from what the uploaded files prove.
