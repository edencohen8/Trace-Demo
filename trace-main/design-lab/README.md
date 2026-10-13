# TRACE log presentation lab

Open `http://127.0.0.1:5188/?view=dock&theme=teal`.

The current preferred direction is **Jade with the bottom panel**. The panel is 210px tall on shorter desktop screens and 220px on larger screens. Its fixed header combines tabs, record navigation, attachment, and close controls. Only its content scrolls, with a visible Jade scrollbar. The Summary tab pairs the complete description and source locator with compact metadata. Fields shows all eight values. Raw shows the complete record without pagination. Overview bars remain tall, and duplicate timeline/player rows remain removed. A fresh URL defaults to this direction; comparison controls remain available.

Use the **LOG VIEW** selector or its previous/next arrows to compare the original floating window with five alternatives: side inspector, bottom panel, inline detail, focus reader, and pinned-record comparison. Use the color buttons independently: Amber, Jade, Cobalt, Plum, or Graphite. View and color choices are stored in the URL. Changing them preserves the selected event.

The log viewer has Summary, Fields, and Raw tabs. The bottom panel scrolls continuously; other views retain pagination. Previous/next record buttons browse records in the current time window. The focus reader adds a paginated record list. The comparison view keeps a reference record fixed while the current record changes. Attach a record to ask about it in the demo chat.

These are working UI prototypes, not generated images. The six presentations share one typed `LogViewer` component and the same synthetic fixtures. The overall workspace fits the viewport. The bottom panel's source area is independently scrollable.

## Earlier design context

Two interactive design prototypes based on the user's selected Product Design images.

- `http://127.0.0.1:5188/?design=1`: Obsidian, neutral charcoal and teal.
- `http://127.0.0.1:5188/?design=2`: Edit Bay, warm graphite and amber, with the same side-chat layout and replay controls.

Run from this directory:

```sh
npm run dev
npm run build
```

The workspace's existing Vue, Vite, TypeScript, and Lucide packages support this isolated prototype. No new packages were installed. For a standalone copy, install the dependencies in this directory first.

All application code is TypeScript/TSX. The existing TRACE application is unchanged. The Product Design default starter includes JavaScript files, so this prototype uses the existing repository's TypeScript toolchain instead.

The top histogram selects a time window. Zoom and pan change the five aligned system timelines. Select an event to see its compact summary. Click that summary for the full source. Search and filters open from the search button. Chat citations return to their event. Evidence can be attached to a demo question or saved for the current session. The amber design adds replay and event stepping.

Both designs fit the viewport without page scrolling. Scrollbars are hidden on internal chat history and source dialogs, which remain scrollable by wheel, touch, and keyboard. At phone widths, timeline and chat use tabs so neither needs a long page. The amber version has no menu rail.

All records and chat responses are synthetic fixtures. No backend, agent, database, external service, or ground-truth file is accessed. State resets on reload. Dates preserve the source example's 5 October 2026 incident.

`references/` contains the two revised visual targets generated with the built-in Image Gen tool. `artifacts/` contains browser captures. Validation details are in `design-qa.md`.
