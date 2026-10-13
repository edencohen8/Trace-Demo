# Delayed IFF notification — case_003

> **PRIVATE ANSWER KEY — DO NOT UPLOAD TO TRACE.** This is for the evaluation team, not for the investigating agent.

## Scenario

All cases contain routine scans, target movement, background IFF traffic, health reports, logs and Hebrew diary notes. The system is mostly healthy.

- **Incident reference:** `2026-10-08T14:03:00+03:00` (Israel time, UTC+03:00 for this example)
- **Case ID:** `case_003`
- **Input for TRACE:** `fixtures/case_003/raw/` plus `fixtures/case_003/capture_manifest.json` and `public_system_catalog.json`

## What fails (private)

The simulator receives an IFF 7500 reply, matches an alert rule, and queues a notification. The dispatcher transport is unavailable, and the delivery acknowledgement arrives 102 seconds after the request.

## Which files to inspect

- sensor.txt: routine scans and sensor state
- tracking_service.txt: processing and configuration
- ui_gateway.txt: published tracks and normal gateway health
- external_position_adapter.txt: reference source status
- notification_service.txt: alert delivery and retries
- operator_diary.xlsx: human notes; reported times are approximate

## Clues to look for

- T-088 has an IFF reply with code 7500.
- A rule match and a notification request exist.
- The dispatcher reports a degraded transport and later returns online.
- The notification request and delivered event are 102 seconds apart.
- The notification-service TXT log records retry attempts.

## Example evidence locations

- `sniffer.csv`, message `MSG-00017452`, 14:02:56 Israel time: `DispatcherState` (delivery_state=DEGRADED)
- `sniffer.csv`, message `MSG-00017464`, 14:03:00 Israel time: `IFFReply` (target_id=T-088)
- `sniffer.csv`, message `MSG-00017493`, 14:03:01 Israel time: `AlertRuleMatch` (target_id=T-088)
- `sniffer.csv`, message `MSG-00017494`, 14:03:02 Israel time: `NotificationRequest` (target_id=T-088, delivery_state=QUEUED)
- `sniffer.csv`, message `MSG-00018218`, 14:04:44 Israel time: `NotificationDelivered` (target_id=T-088, delivery_state=DELIVERED)

Message IDs are examples from this generated run, not fixed requirements for future random seeds. Recompute evidence locations after regeneration.

## Suggested investigation path (for human reviewers)

1. Trace T-088 through IFFReply and AlertRuleMatch.
2. Join NotificationRequest and NotificationDelivered by alert_id.
3. Read the alert dispatcher health events and retry lines.

## Expected final conclusion

The simulator receives an IFF 7500 reply, matches an alert rule, and queues a notification. The dispatcher transport is unavailable, and the delivery acknowledgement arrives 102 seconds after the request.

## Benchmark: pass conditions

- [ ] Separate IFF receipt, alert-rule match, request and delivery times.
- [ ] Calculate the delay using actual event timestamps.
- [ ] Explain why the delay aligns with degraded alert transport.
- [ ] State that the track data alone does not prove an alert was delivered.

## Benchmark: claims to reject

- [ ] Do not say the IFF reply was missed.
- [ ] Do not conflate message processing time with delivery time.

## Evidence policy

Any factual conclusion must point to an original raw file row or log line. Absence from a filtered export is **not** proof that an event did not happen. An evaluation result must distinguish what the simulator knows from what the uploaded files prove.
