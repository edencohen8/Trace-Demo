# External position jump — case_002

> **PRIVATE ANSWER KEY — DO NOT UPLOAD TO TRACE.** This is for the evaluation team, not for the investigating agent.

## Scenario

All cases contain routine scans, target movement, background IFF traffic, health reports, logs and Hebrew diary notes. The system is mostly healthy.

- **Incident reference:** `2026-10-08T14:03:00+03:00` (Israel time, UTC+03:00 for this example)
- **Case ID:** `case_002`
- **Input for TRACE:** `fixtures/case_002/raw/` plus `fixtures/case_002/capture_manifest.json` and `public_system_catalog.json`

## What fails (private)

The external reference position shifts for 92 seconds while manual and GPS references remain nearly stable. The simulation treats these as WGS84 site positions.

## Which files to inspect

- sensor.txt: routine scans and sensor state
- tracking_service.txt: processing and configuration
- ui_gateway.txt: published tracks and normal gateway health
- external_position_adapter.txt: reference source status
- notification_service.txt: alert delivery and retries
- operator_diary.xlsx: human notes; reported times are approximate

## Clues to look for

- Compare all three position fields on the same record before and after the incident.
- The external value jumps suddenly and later returns.
- The independent GPS and manual references stay near their previous positions.
- External-position service logs report an elevated innovation statistic and profile changes.

## Example evidence locations

- `sniffer.csv`, message `MSG-00017446`, 14:02:58 Israel time: `PositionReport` (site_external_lat=31.5167705, site_external_lon=34.7661665)
- `sniffer.csv`, message `MSG-00017474`, 14:03:00 Israel time: `PositionReport` (site_external_lat=31.5274411, site_external_lon=34.7520868)
- `sniffer.csv`, message `MSG-00018086`, 14:04:32 Israel time: `PositionReport` (site_external_lat=31.5167936, site_external_lon=34.7662207)

Message IDs are examples from this generated run, not fixed requirements for future random seeds. Recompute evidence locations after regeneration.

## Suggested investigation path (for human reviewers)

1. Plot latitude and longitude for external, manual and GPS over time.
2. Check position adapter log warnings.
3. Find the interval where the external reference differs substantially.

## Expected final conclusion

The external reference position shifts for 92 seconds while manual and GPS references remain nearly stable. The simulation treats these as WGS84 site positions.

## Benchmark: pass conditions

- [ ] Calculate the distance between external, GPS and manual reference positions.
- [ ] Identify the start and end of the jump.
- [ ] Confirm that the data uses a common coordinate frame.
- [ ] Conclude that the fault affected the external position reference, not all position sources.

## Benchmark: claims to reject

- [ ] Do not claim that every tracked target physically moved.
- [ ] A profile change near the incident is evidence, but not proof of the exact internal software defect.

## Evidence policy

Any factual conclusion must point to an original raw file row or log line. Absence from a filtered export is **not** proof that an event did not happen. An evaluation result must distinguish what the simulator knows from what the uploaded files prove.
