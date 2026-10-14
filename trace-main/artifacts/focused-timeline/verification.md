# Focused timeline trial

Baseline committed and pushed to GitHub `main`: `a8ee4cd`.
The focused timeline trial is a separate local change after that checkpoint.

## Observed behavior

- Case 001, 14:00:30–14:05:30: 98 markers represent all 2,135 filtered records.
- The previous view remains available: 910 sampled points out of 2,075 source-time points.
- Opening a sensor activity group shows 72 original records split by source, type and target.
- Selecting T-014 shows its six DetectionCandidate rows. Source navigation moves 1/6 to 2/6.
- Selecting a services group shows 81 rows. Group paging reaches 81–81/81; source navigation crosses back to 80/81.
- Group opening and source navigation preserve the exact window and every marker position.
- A 30-second window shows 211 individual markers for 211 records, including 200 periodic records.
- Switching to case 003 clears the old group and shows 88 markers for 2,197 records.
- Screenshot checks at 1680×920, 1024×768 and 390×844 found no new layout overflow.
- Direct mouse-wheel input was not exercised by browser automation; existing zoom controls were tested.

## Checks

- `npm run typecheck`
- `npm run test:timeline`: 17 tests
- `npm run test:demo`: 30 tests, including focused-group HTTP routes
- `npm run test:quality`: 17 tests
- `npm run build`
- `git diff --check`

Tests cover exact record accounting, source-time boundaries, target/state separation,
INFO-level lifecycle events, transitions across viewport boundaries, warning floods,
numeric extrema with original citations, pagination and all four public evidence cases.

This trial uses deterministic display rules. It does not assess root cause, suppress
original evidence, or classify numerical anomalies. Periodic activity is not proof
of healthy operation. Field ranges stay within each source/type/target/state series.

## Drag and hover follow-up

- Added horizontal pointer dragging on system plots and the time axis, with a
  five-pixel threshold, pointer capture, release-click suppression and preserved zoom.
- Pan calculations pass tests for both directions, recording edges and invalid inputs.
  Timeline test suite now has 19 passing tests; typecheck and build also pass.
- Native drag input was not exercised by the available browser automation surface.
- Browser inspection confirms source tabs use 13px text and padded hover/selected
  states. System labels have 34px button height and an 8px right margin. No names
  are clipped at the checked desktop size, and the page has no horizontal overflow.
- Source-tab clicks and system filter toggles still work in the updated build.
