# TRACE project memory

## 2026-10-14 — All ten log grouping prototypes rejected

The user wants fewer visible logs so the operator can focus on useful evidence.
The current numbered activity bars do not suit them. They asked for ten different
ways to present grouped logs inside the working Jade timeline.

We built and checked these alternatives with the existing case data, five system
lanes, shared time window and source dock. The user rejected the entire set:
“nothing is relevant”. They asked to remove the prototype and remember the result.

| Key | Attempt | Presentation |
| --- | --- | --- |
| G1 | בועות נפח — Volume bubbles | One circle per group; area shows count |
| G2 | ענן צפיפות — Density clouds | Soft shading over each group's time range |
| G3 | קו עומס — Volume line | A thin line joins the counts of successive groups |
| G4 | אשכול נקודות — Dot clusters | One dot represents up to ten records |
| G5 | ערימת רשומות — Record stacks | Layered document symbols open on hover |
| G6 | קצוות פתוחים — Open brackets | Only the first and last times mark the group |
| G7 | שורות לפי סוג — Rows by message type | Separate small rows show the actual message types |
| G8 | שקט כברירת מחדל — Routine logs folded away | One control per system reveals routine groups |
| G9 | עדשת זמן — Time lens | Small marks gain detail near the pointer or on focus |
| G10 | מפת משבצות — Tile map | A nine-cell texture shows relative group volume |

Decision: all ten specific prototypes were rejected. No winner or combination
was approved. Do not present this same set again as new alternatives. Revisit a
rejected prototype only if the user asks. A new proposal needs a different approach.

The user gave no separate reason for each rejection. Do not invent one or treat
this as a permanent ban on every use of circles, lines or grouping. Removing the
experiment does not mean the user approved the previous numbered bars. The log
presentation problem remains open.

The prototype components, switcher, launch command, route integration and
screenshots were removed from the working tree. Existing grouping logic, source
inspection, timeline navigation, chat and separate tooltip work were preserved.

Historical reference only: commit `12bfb60` on local branch
`prototype/log-grouping-options` captures the rejected experiment. Its code and
screenshots are not a design recommendation. This commit also contains earlier
working grouping and navigation changes; reverting it as a whole would remove
those unrelated features.

## 2026-10-14 — The app URL must open the full working demo

After removing G1–G10, the user still saw an older design study with A–F choices.
The root entry point still used `variant=F` and other legacy values to load mock
screens with prepared chat replies. Redirecting only G1–G10 did not fix this.

The root entry point now always loads `DemoApp.vue` and its working API-backed
timeline, source dock and chat. It clears the old `variant` parameter while
preserving `case` and other URL state. Legacy prototype source files remain in
the repository, but the app URL does not route to them. Future experiments must
use an explicit separate entry point so old links cannot replace the working UI.
