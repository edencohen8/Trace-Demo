# Lane 5: Unified Timeline, Field Inspector & Investigator Chat Console UI

## Parent
Part of #1

## What to build
Web console (Vue 3 / Vite) providing:
1. Ingestion summary card showing source coverage and parse status.
2. Unified multi-resolution timeline with source bands (sniffer, logs, diary) and anomaly window markers.
3. Field Inspector component graphing time-series coordinate comparison (`site_gps_lat` vs `site_external_lat`) with unit tooltips.
4. Investigation chat interface displaying investigator hypotheses, structured findings, contradictions, and clickable citation badges.
5. Raw Evidence Inspector drawer that pops up on clicking a citation, showing the exact raw file line and surrounding context.

## Acceptance criteria
- [ ] AC-1: Displays ingestion manifest with coverage flags and total message counts for `case_002`.
- [ ] AC-2: Timeline visualizes event density and marks the time window where the position discrepancy occurs.
- [ ] AC-3: Field inspector charts the position jump comparing GPS and external latitude/longitude.
- [ ] AC-4: Chat UI displays investigator hypotheses, findings, and confidence rationale with clickable citation badges.
- [ ] AC-5: Clicking a citation opens the exact raw row in `sniffer.csv` or line in `external_position_adapter.txt` in the inspector drawer.

## Sub-tasks / Implementation Plan

- [ ] **Sub-task 5.1: Ingestion Dashboard & Case Header Component**
  - Build UI header displaying case metadata, source files list, total event counts, and coverage flags (`unknown completeness` or `filtered types`).
  - *Verification*: Load `case_002` manifest data; assert counts, flags, and time span render correctly.

- [ ] **Sub-task 5.2: Multi-Band Density Timeline**
  - Implement timeline component with 3 distinct stacked bands: Sniffer Messages, Component Logs, Operator Diary.
  - Render event density histogram per time bucket with interactive brush-to-zoom.
  - Highlight notable anomaly windows (e.g. position jump interval).
  - *Verification*: Renders timeline with density bars; brushing to zoom filters visible events.

- [ ] **Sub-task 5.3: Field Inspector & Coordinate Comparison Chart**
  - Build line chart component plotting numeric fields over time.
  - Specifically plot `site_gps_lat`, `site_manual_lat`, and `site_external_lat` for `case_002`.
  - Highlight deviation threshold and display unit tooltip (`WGS84 degrees`).
  - *Verification*: Confirm chart visibly displays external latitude jumping away from GPS/manual during incident window.

- [ ] **Sub-task 5.4: Investigator Chat & Findings Presentation**
  - Build chat stream component showing investigator thinking phases, active hypotheses, and final synthesized findings.
  - Distinguish positive observations, negative findings, and contradictions with distinctive visual badges.
  - Render evidence citations as clickable badges (e.g. `[sniffer.csv:L1420]`, `[external_position_adapter.txt:L88]`).
  - *Verification*: Mock findings render with clickable badges and proper visual hierarchy.

- [ ] **Sub-task 5.5: Raw Evidence Viewer Drawer**
  - Side drawer component that opens when an evidence badge is clicked.
  - Fetches and displays raw immutable file content at that line, highlighting the cited line with surrounding context and line numbers.
  - *Verification*: Click citation badge in chat → drawer opens displaying exact raw line in `sniffer.csv` or `external_position_adapter.txt`.

## Blocked by
- Blocked by #4 (Lane 4 Tools API)
- Blocked by #5 (Lane 3 Agent Harness)
*(Can start frontend scaffolding, mock data, and UI components immediately)*
