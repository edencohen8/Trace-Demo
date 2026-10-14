# Grouping prototype check

Checked in the connected browser at 1680 × 920 using the working local API.
No new prototype test suite was added.

- All ten variants render on the existing Jade page and retain the five systems.
- Each variant opens the same tested group: 72 source records, 14:00:30–14:00:55.
- Group selection leaves the timeline at 14:00:30–14:05:30.
- The initial window has 2,135 records, 98 source groups, 30 periodic groups.
- G1–G6 retain identical event IDs and positions during variant changes.
- G7 draws 55 message-type marks from the actual group-series metadata.
  Sensor types: DetectionCandidate, RadarScan, SensorHealth. Operator type:
  UiTrackPublished. Service types: PositionReport, TrackUpdate.
- G8 initially hides all 30 periodic marks. Opening Sensor Controller reveals
  its groups. The control correctly totals 716 periodic records for that system.
- G9 reveals the selected group's count and time. Its source click opens the dock.
- Group source inspection opens `sniffer.csv:16354` (RadarScan at 14:00:30).
  Source tabs remain available and the timeline window remains unchanged.
- Next wraps from G10 to G1. Left arrow wraps G1 to G10. Arrow input in the chat
  textarea preserves G10 and moves the caret. No message was sent.
- The info panel presents the reading guide, tradeoff and relevant state.
- TypeScript checking and a Vite production build pass. New grouping prototype
  components and CSS are excluded from production. Existing older prototype
  routes are outside this change.

This is a visual study. Native drag and wheel gestures were not exercised again.
Existing timeline navigation controls and source actions are shared with TRACE.
No variant is approved for production yet.
