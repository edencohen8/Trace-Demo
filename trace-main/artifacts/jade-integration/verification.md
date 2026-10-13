# Jade integration verification

Reference: `http://127.0.0.1:5188/?view=dock&theme=teal`
Working application: `http://127.0.0.1:5180/`

## Visual comparison

- Jade accent: `#70c6b2`; base: `#151819`.
- At a 1502px viewport, both use a 1446px-wide overview, a 1061px main column,
  a 362px chat column and a 24px gap. The overview is 115px tall.
- Source panel: 220px on desktop, 210px below 760px viewport height, matching
  the reference breakpoints. Source tabs stay centered in the panel header.
- Source content scrolls independently. Keyboard PageDown moved the source pane
  148px while the document stayed at scroll position zero.
- Inspected the rendered app at 390×844 and 1024×768 in local viewport frames.
- Timeline values and text differ from the prototype because they use the
  existing investigator fixtures and saved sessions. No prototype data is imported.
- Existing English system names are retained. Radio System has no supplied data.
- No design or color switcher is present.

## Functional checks

- Timeline source point opens its exact record in the bottom card. Selection preserves the time window and all system filters.
- Record page 81–160 opens record 81. Previous moves to record 80 on the preceding
  page, and Next returns to record 81.
- Radio filter shows zero records and explicitly states that data was not supplied.
- Source and text filters show an empty result with recovery instructions.
- Switching to case_004 loads its own session and partial capture coverage.
- Summary, fields and exact-source tabs retain timestamps, original lines and hashes.
- Attached `[sniffer.csv:L16434]` to a real Claude turn. The answer passed source
  validation, persisted after reload, and its citation opened that exact source.
- Existing investigation progress, lesson approval and export remain connected to
  their original code paths and API.

## Automated checks

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run test:demo`: 30 passed.
- `npm run test:progress`: 5 passed.
- `git diff --check`: passed.

Screenshots: `prototype.png`, `working-ui.png`, `source.png`, `responsive.png`.
The source and responsive captures precede the final desktop tab-centering adjustment.

## Log-selection regression fix

- Reproduced the old bug: one click changed 14:00:30–14:05:30 to
  14:00:24–14:00:39 and reduced five lanes to IFF only.
- After the fix, the same click preserves the window, all five lanes, marker
  count and every marker position; only source selection changes.
- Selecting a 13:36 diary entry keeps the 14:00:30–14:05:30 window.
- A chat citation opens its exact source without clearing an active Radio filter.
- Same-time group navigation changes the source record while keeping the window.
- System markers use exact source timestamps. Only the top overview retains bins.
- Source records include real periodic cadences: case_001 IFF messages occur
  about every 30 seconds, with fractional-second differences. No random jitter
  is added to their display positions.
- Six new timeline tests pass, plus 30 demo tests and five progress tests.
- Type checking, build and whitespace checks pass.

## Full-height chat and vertical point layout

- The overview now belongs to the left investigation column. Chat spans from
  the workspace top to its bottom. This supersedes the original full-width overview.
- At 1680×920, both timeline sections are 1194px wide. Chat and the investigation
  column both run from y=52 to y=908.
- Point heights vary within five collision-aware vertical bands. Stable offsets
  prevent a rigid grid. Height carries no measurement or severity meaning.
- Selection preserves the full list of point IDs, horizontal and vertical positions,
  system lanes and time window. The source card updates to the clicked record.
- Checked desktop, 1024×768 and 390×844 layouts in the browser.
- Eight timeline tests, type checking, production build and whitespace checks pass.
- Current screenshots: `full-height-chat.png`, `full-height-responsive.png`.
