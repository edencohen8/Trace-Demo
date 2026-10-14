# THROWAWAY: log grouping study

Question: Which presentation makes periodic log groups easy to inspect without
the filled, numbered activity bars?

Ten alternatives live inside the working Jade timeline. They share the current
case, time window, filters, source groups, event markers and evidence dock.
The user explicitly requested ten variants, overriding the skill's normal cap.
No winner has been selected. Keep this study out of main.

From `trace-main`, run:

```sh
npm run prototype:groups
```

Open <http://127.0.0.1:5189/?variant=G1>. Use the bottom buttons or left/right
arrow keys. The keys do not intercept editing in inputs, textareas or selects.
The URL keeps the selected variant. `G1`–`G10` avoid the earlier `L`, `M`, `T`
and numeric prototype keys already used by `src/main.ts`.

| Key | Hebrew name | Visual encoding | Main tradeoff |
| --- | --- | --- | --- |
| G1 | בועות נפח | Circle area scales with count, with an 8px minimum | Duration is in the tooltip |
| G2 | ענן צפיפות | Soft intensity over each group's actual bounds | Soft group boundaries |
| G3 | קו עומס | A line joins group counts at their time midpoints | No internal composition |
| G4 | אשכול נקודות | One dot represents up to ten records | Large groups use more space |
| G5 | ערימת רשומות | A layered document stack suggests volume and opening | Layers show order of magnitude |
| G6 | קצוות פתוחים | Open brackets at the first and last record | Count needs hover or click |
| G7 | שורות לפי סוג | Small rows of actual message types | More types need more height |
| G8 | שקט כברירת מחדל | Fold routine groups behind one control per system | Routine patterns start hidden |
| G9 | עדשת זמן | Tiny ticks gain detail near the pointer or on keyboard focus | Comparison needs interaction |
| G10 | מפת משבצות | Nine-cell texture encodes relative group volume | Quantized count and no visible duration |

The volume scale is shared across visible systems in the selected window.
Midpoint symbols represent a group, not a new event timestamp. Grouped source
records retain their original timestamps. No visual asserts healthy operation.
The line is a summary of group counts, not a measured or interpolated signal.
All variants keep the non-periodic event, change, warning and diary markers.
The Radio System still reports that no data was supplied.

G7 reads the existing `timeline-group` endpoint. It combines series of the same
message type for drawing only. Four read requests run at a time, with one source
row per response. Clicking opens the original group, whose dock still separates
source, type and target. No backend contracts are changed for this study.

The info button explains the encoding and its tradeoff. It also exposes current
case, filters, window, group counts, scale and selection. The same state is logged
to the browser console on changes. Prototype UI state is in memory. Existing
host chat remains the working chat; browsing variants makes no model calls.

The prototype import and switcher are gated by `import.meta.env.DEV`. The normal
production app remains on port 5180. The development study runs on port 5189.

Capture: local branch `prototype/log-grouping-options`. This branch also captures
the prior uncommitted focused-grouping, panning and hover work needed to reproduce
the current host UI. There is no active implementation issue for this local study;
this README and the capture commit record its context. Do not publish an issue or
send lane notifications for this local-only display experiment.

Verdict: pending the user's comparison. After selection, implement the chosen
behavior in production code and keep these experiments on the throwaway branch.
Screenshots and browser checks: `artifacts/grouping-prototypes/`.
