# TRACE local demo

The default page now uses the live backend. Run from this folder:

```bash
npm ci
cp .env.example .env   # Only if .env does not exist yet.
# Edit .env and set OPENAI_API_KEY.
npm run dev
```

Open http://127.0.0.1:5180. Use `PORT=5181 npm run dev` if that port is occupied.
Keys stay on the server. The timeline and evidence inspector work without a key.
AI chat requires a valid provider key. There is no prepared-answer fallback.

The server reads `.env` on each AI request. After adding a key, click the connection
refresh button. You do not need to restart the server for key or model changes.

## Select an AI provider

| Provider | Settings in `.env` |
| --- | --- |
| OpenAI (default) | `TRACE_AI_PROVIDER=openai`, `OPENAI_API_KEY=…`, `TRACE_MODEL_ID=gpt-6-luna` |
| Claude | `TRACE_AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=…` |
| Gemini | `TRACE_AI_PROVIDER=gemini`, `GEMINI_API_KEY=…` |
| LiteLLM | `TRACE_AI_PROVIDER=litellm`, `LITELLM_URL=…/v1`, `LITELLM_MASTER_KEY=…`, `TRACE_MODEL_ID=<gateway alias>` |

Leave `TRACE_MODEL_ID` empty for the provider default: `gpt-6-luna` (OpenAI),
`claude-haiku-5-5` (Claude), or `gemini-2.5-flash` (Gemini).
The requested `gpt-6-luna` API ID is not in the installed SDK catalog and has not
been verified against OpenAI. If your account rejects it, set `TRACE_MODEL_ID` to
an API model ID available to your account; no code change is needed. Clear an old provider's model ID when switching providers.
Shell variables take precedence over `.env`. Never prefix a secret with `VITE_`.

Run `npm run check:ai` to test a real model call with a source citation. This uses
your provider account. The automated test suite uses a scripted provider and does
not need a key.

Run `npm run test:quality` for the answer-quality regression checks. For opt-in
live QA, run `node --import tsx scripts/qa-agent-live.ts numeric /tmp/trace-qa.json`.
Replace `numeric` with `sensor`, `coverage`, `cause`, `gaps`, or `followup` to test
another path. The follow-up scenario runs three turns with isolated history.
The live check uses the configured provider and fictional public fixtures. It
records timings, tool requests, answers, and source citations without changing
saved chat sessions. A completed run still needs review of its factual claims.

## Try the demo

1. Open `case_001` and read the operator note near 14:03.
2. Click an overview interval to change the window. Filter by source or target.
3. Open a record to inspect its exact source row, clock metadata and hash.
4. Attach a record to chat. Ask for a timeline summary or system health.
5. Ask why the reported event occurred to start the delegated investigation flow.
6. Click an answer citation to open the source. Approve an answer to save a lesson.
7. Switch to `case_004` to inspect an export with missing message types.
8. Export the session as JSON. Reload to check that completed chat and lessons persist.

Data is fictional. The fixed evidence files are checked against their manifests.
Queries run in memory. State is stored in ignored `.state/*.json` files.
See [the local demo contract](docs/contracts/06-local-demo.md) for scope and limits.

## Checks and stable presentation mode

```bash
npm run typecheck
npm test
npm run build
# Stop the development server before using the same port.
npm start
```

`npm start` serves the built UI and the same backend. Restart it after server-code
changes. The old design studies remain available at `?variant=L1`, `?variant=T7`,
and the other URLs documented below. Those old studies still use prepared data.

---

# TRACE UI prototype

Interactive Vue 3 prototype for the fictional investigation in Architecture.md.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:5173. The dev server uses polling because this workspace is on a network drive.

## Interaction

- Select a labeled timeline event to open its details directly below the timeline. Duration events are shown as intervals, including intervals that cross the current window boundary.
- Search the timeline by text or identifier; filter to anomalies; toggle sources using the fixed system-name column.
- Move the time window with the arrow buttons or slider, zoom in/out, focus on the incident, or reset to the full six-minute sample.
- Ask one of the suggested questions; click a citation to select its event.
- Approve a conclusion to save it locally under Lessons. Export downloads those lessons as JSON.

All records and chat answers are simulated. Chat uses prepared scenario answers, with an explicit fallback for unrelated questions. There is no backend, model connection or shared multi-user state. Lessons persist only in the current browser using localStorage. The UI is Hebrew and RTL, with chat on the right and a dark blue palette; chronological time progresses left to right.

## Verify

```powershell
npm.cmd run build
node scripts/check-ui.mjs
```

The browser check requires the dev server at port 5173 and installed Microsoft Edge. It uses an isolated browser context, verifies search/filtering, evidence navigation, approval persistence, timeline focus, chat fallback and narrow-screen overflow. Screenshots are written to artifacts/.

Source: src/App.vue (interactions and layout), src/data.js (fictional scenario), src/style.css (design tokens and responsive styles).

## Six-design exploration

Run `npm run dev` and open http://localhost:5173/?variant=A. The floating bottom bar switches among six structurally different designs; left/right arrow keys also switch unless you are editing a field. Each URL is reload-stable.

| Variant | URL | Direction |
| --- | --- | --- |
| A — Quiet | http://localhost:5173/?variant=A | Light editorial sequence, generous space, optional assistant |
| B — Playback | http://localhost:5173/?variant=B | Dark single-moment stage with chapters and playback controls |
| C — Connections | http://localhost:5173/?variant=C | System/evidence relationship canvas with a detail drawer |
| D — Notebook | http://localhost:5173/?variant=D | Warm document layout with source footnotes and temporary notes |
| E — Studio | http://localhost:5173/?variant=E | Light blue source timeline, movable time window and side assistant |
| F — Conversation | http://localhost:5173/?variant=F | Charcoal conversation-first workspace with on-demand evidence |

The previous prototype remains at http://localhost:5173/?variant=original.

These are throwaway Vue components in `src/prototypes/`, built to answer: **Which layout and information hierarchy make a shared investigation feel light and readable?** No design has been selected yet. The six intentionally prioritize different interactions; they are not six complete production applications. They share the fictional scenario and prepared assistant answers. The variants store state only in memory; a reload clears it. State is visible through the switcher's info control and logged when switching variants.

The comparison bar is development-only. Production builds can open each variant by its URL but hide the comparison controls. Desktop screenshots are in `artifacts/design-A.png` through `design-F.png`. The existing `scripts/check-ui.mjs` remains targeted at the original prototype.


## Ten-timeline exploration

The first timeline study starts at **?variant=T1**. These throwaway views answer: **How can an operator scan a dense investigation, discover patterns independently of the assistant, and drill down to evidence?** The chat stays on the right in every view. No timeline has been selected yet.

Run `npm run dev`; switch with the floating 01–10 bar or left/right arrows. The switcher is development-only. Each view is also directly addressable:

| Key | URL | Design question |
| --- | --- | --- |
| T1 — Source lanes | http://localhost:5173/?variant=T1 | What happened across systems at the same moment? |
| T2 — Density matrix | http://localhost:5173/?variant=T2 | Which source/time cell deserves investigation? |
| T3 — Activity river | http://localhost:5173/?variant=T3 | Which sources contributed to a change in total volume? |
| T4 — Entity tracks | http://localhost:5173/?variant=T4 | What happened to the same entity across sources? |
| T5 — State ribbons | http://localhost:5173/?variant=T5 | Which durations, outages and evidence gaps overlap? |
| T6 — Chronicle | http://localhost:5173/?variant=T6 | What did each system record in successive time windows? |
| T7 — Time lens | http://localhost:5173/?variant=T7 | Can we investigate seconds while retaining the full-day context? |
| T8 — Message paths | http://localhost:5173/?variant=T8 | Where does a traceable message path stop having delivery evidence? |
| T9 — Small multiples | http://localhost:5173/?variant=T9 | Do patterns change together, including in quieter sources? |
| T10 — Window comparison | http://localhost:5173/?variant=T10 | How does the incident differ from another five-minute window? |

The shared deterministic fixture contains **21,015 simulated records over 16 hours** (08:00–24:00), five sources, multiple targets, routine traffic variation, the existing 102-second incident, an unrelated archive-error burst, a sensor-quality interval, and a missing sensor-file interval. This is an interaction study with thousands of records, **not a benchmark for hundreds of thousands or millions**.

All variants support filtered evidence inspection. Overview bins count record starts; detail windows include overlapping duration records. Click an aggregate to page through its underlying records, then open an event and its raw source. Use the incident/30-minute/day presets, zoom, pan or the time slider in T1–T6 and T9. T7 has its own five-minute lens, T8 has correlation-group selection, and T10 has its own reference-window selector. These independent controls are explicit in the UI.

T5 deliberately separates simulated state spans from event filters. The no-action span is derived for T-041 only and links its endpoint evidence; missing source data is hatched and does not imply inactivity. T8 separates shared message IDs from entity-only correlation and does not imply causation from temporal order. T9 labels independent per-source scales; T10 uses the same scale in both windows.

Evidence can be sent to the demo assistant. Its prepared replies are marked as simulated. Operator observations can be saved in memory with an optional selected evidence link; they are not approved conclusions. Reloading clears the session. The switcher's information control and console log expose study state.

A useful evaluation pass:
1. Start at the full-day overview and identify a suspicious period without opening chat.
2. Distinguish the alert-service outage from the later unrelated archive burst.
3. Find the missing sensor interval and distinguish it from the derived operator-action gap.
4. Drill into the 102-second interval, inspect source records, and write an evidence-linked observation.
5. Compare a quiet source with a noisy source; decide whether aggregation hid something important.

Implementation: `src/prototypes/timelines/`. The fixed shell is intentionally shared because the decision is about timeline representation, not chat placement or visual branding. The ten views differ in grouping, geometry, time scale, information hierarchy or investigation operation. Screenshots: `artifacts/timeline-T1.png` through `timeline-T10.png`. Browser review exercised all ten primary drill-downs, source evidence, chat citations, observation capture, wraparound switching and laptop-width overflow. Production build and direct production URLs were checked.

The prior six layout designs remain at `?variant=A` through `?variant=F`; the original remains at `?variant=original`. Captured on `media/one-brain-video`; no implementation issue was supplied. Verdict pending operator review.

## Eight dark-mode refinements of the selected time lens

**Decision from operator review:** use T7's structure: a full-investigation interval overview, a magnified timeline with individual records grouped by system, raw data and metadata below, and chat on the right. The user requested eight visual/interaction refinements, all dark, using the local Apple Design skill. The eight-count and fixed overall structure are explicit user requirements for this round.

The default route now opens **L1**. Run `npm run dev`, then use the floating design selector or the left/right arrows. Each refinement is directly addressable:

| Key | Link | What changes |
| --- | --- | --- |
| L1 — Focus | http://localhost:5173/?variant=L1 | Quiet, mostly borderless timeline; side-by-side source and metadata |
| L2 — Signals | http://localhost:5173/?variant=L2 | Volume overview, outlined anomaly symbols, metadata above full-width raw data |
| L3 — Chapters | http://localhost:5173/?variant=L3 | Explicit interval blocks, grouped source lanes, grouped metadata rows |
| L4 — Precision | http://localhost:5173/?variant=L4 | Time scrubber, detailed ruler and shared cursor, raw-first inspector |
| L5 — Review | http://localhost:5173/?variant=L5 | Larger system labels, inline unusual-event captions and reading-oriented evidence |
| L6 — Connections | http://localhost:5173/?variant=L6 | Shared-message highlighting, related-evidence attachment controls and link shelf |
| L7 — Instruments | http://localhost:5173/?variant=L7 | Separate source panels and property-list metadata |
| L8 — Workspace | http://localhost:5173/?variant=L8 | Open black canvas, floating selection controls and a broad evidence drawer |

The question is now **which interval, point, anomaly, metadata and tagging treatments make the chosen layout easiest to operate?** No visual winner has been chosen. The variants share the same fixture; the latest irregular-data revision is described below. Separate composition components use common evidence and interaction primitives so comparing designs does not change the data or behavior.

Every overview interval is clickable and opens its complete 15-minute window (30 minutes in Chapters). The initial incident lens spans five minutes; zoom and pan are available as buttons, with a range scrubber in Precision. Every visible record has its own 28px hit target; colliding points are staggered vertically rather than silently dropped. Duration records retain horizontal intervals. The selected time is aligned across source lanes. Larger windows can therefore make the lanes taller; this remains a throwaway interaction study, not a production-scale renderer.

Suspicious items use a symbol/shape plus a warm semantic highlight. The inspector explains that the marker comes from the simulated record's severity, not a verified agent conclusion. Missing sensor-file coverage is distinct from source activity. Selecting an item reveals raw data and 12 metadata fields: record/source/entity IDs, severity, timestamp and offset, end/duration, evidence type, time certainty, message ID, separate ingestion time (not supplied), simulated source reference, and simulation status. Missing original payloads are explicitly labeled normalized demo records rather than invented source payloads.

Attach evidence with the visible `@` action or Shift-click on a point. The chat supports multiple removable evidence chips, typed `@EV-...` lookup, a separate mention picker, Ctrl/Cmd+Enter to send, and clickable citations that restore the time window and clear conflicting filters. Attaching evidence does not send a message. Chat answers are prepared demo text. No backend, persistence or live anomaly detector was added.

Design implementation follows the supplied Apple Design references: near-black opaque content surfaces, elevated neutral layers, restrained floating glass controls, a monochrome Lucide icon family, system/Inter fallback fonts (no bundled SF fonts), and reduced-motion, reduced-transparency and increased-contrast treatments. A permanently dark treatment follows the explicit user preference. These are Apple-inspired web prototypes, not native Apple components or an accessibility certification.

Source: `src/prototypes/lenses/`. Screenshots: `artifacts/lens-L1.png` through `lens-L8.png`. Browser review covered all eight evidence inspectors, attachment/removal, multi-evidence sending, typed mentions, citations after filtering, full overview intervals, copyable JSON, time scrubbing and laptop-width overflow. Earlier `?variant=T1..T10`, `A..F`, and `original` links remain available. Prototype state is displayed through the development switcher's info control and logged on design changes. Captured on the existing non-main `media/one-brain-video` branch; no implementation issue was supplied.

### Timeline clarity and irregular data pass

All eight L variants now use continuous source timelines with direction arrows, a shared major/minor ruler, aligned time gridlines, a selected-time needle and a labeled link to the overview window. Events retain their real horizontal position. Overlapping hit targets move vertically and keep a stem back to their source timeline; height is only for separation, not an event metric. Duration bars reserve their occupied horizontal space.

The current shared fixture has **21,015 simulated records**. Each source has independent, seeded activity episodes, uneven inter-arrival times, quiet stretches and local bursts. Operator records occur in sessions; voice records have variable durations and overlaps. Record types and payload fields vary by source, including request latency, queue depth, channel, signal quality, workstation, message IDs and transcript text. Archive retries also use irregular timing. This is plausible illustrative traffic, not measured operational data.

Browser inspection confirmed unique IDs, nonuniform gaps in all five sources, the unchanged EV-106 → EV-111 102-second interval, the 146-second EV-107 outage, and the missing sensor-file interval. All eight views opened and retained evidence/tagging behavior without browser errors or desktop/laptop horizontal overflow. The L screenshots were refreshed; screenshots from earlier design rounds retain their historical fixture.
