# TRACE UI and agent audit: findings and recorded-demo recommendations

Audit date: 2026-10-14, Asia/Jerusalem.

## Purpose and version scope

This report records all 66 findings from the read-only audit in the project conversation. It also records the later recommendations for a filmed demo. Each finding has a proposed action. These actions are recommendations, not approved implementation changes or new interface contracts.

The audit covered the running local demo and its working files at that time. Those files included uncommitted focused-timeline changes. The audit did not record a single immutable commit for that entire state. Do not treat these findings as proof that every issue exists on every branch.

At report preparation, `main` was at `a8ee4cd84e372d3ce65c318b4cf9cd4fbb15e344`. The separate `prototype/log-grouping-options` branch was at `4c621f9`. That branch contains later work, including chat/evidence navigation changes. Those later changes were not re-audited for this document. Recheck a finding on the selected filming build before calling it open or fixed. Source paths below identify the audited modules; some focused-timeline modules were not yet on `main`.

No application code or saved app data was changed during the audit. This documentation change does not implement any recommendation. No screenshots, credentials, raw source exports, or private ground truth are included in this report.

## Evidence and limits

Evidence labels:

- **Observed:** Reproduced in the browser or through a read-only local API request.
- **Code:** Found in the implementation. The reported path was not necessarily triggered in a live session.
- **Saved conversation:** Read from an existing answer in the current app. This is not a new model-quality test.
- **Assessment:** A usability judgment based on the inspected screen or behavior.

Severity describes product impact. It does not mean every finding must be fixed before recording. **High** findings can mislead the investigation, block a core interaction, or corrupt working context. **Medium** findings cause substantial friction or weaken reliability. **Low** findings affect clarity or efficiency.

| Step | Area checked | Result |
| --- | --- | --- |
| 1 | All four cases; timeline, zoom, navigation | Time display, density, and navigation problems |
| 2 | Search, source/target filters, empty results | Scope and recovery are unclear |
| 3 | Groups, records, fields, source tabs, citations | Evidence is accessible, but navigation is difficult |
| 4 | Saved chat and investigation history | Weak context visibility and bulky history |
| 5 | Desktop, narrow/mobile, and short-screen layouts | Incorrect mobile time labels and obstructed timelines |
| 6 | Local APIs, routing, workers, validation, persistence | Trust and lifecycle risks in the code |

The in-app browser was unavailable. The audit used the available Chrome connection. Screenshots were inspected during the audit but were not saved as report artifacts because the original request prohibited file changes. The browser reported no console warnings or errors during the inspected flows. This does not rule out interaction or logic failures.

Checks run on the audited working state:

```text
npm run typecheck
TSX_DISABLE_CACHE=1 node --import tsx --test scripts/verify-agent-quality.ts scripts/verify-progress-order.ts scripts/verify-timeline-points.ts scripts/verify-timeline-focus.ts
```

The type check passed. All 41 selected regression tests passed. These results belong to the earlier working state. They are not a new test run against the documentation branch, and they do not establish live answer quality.

Fresh live-provider QA did not run. Automatic approval review rejected the command because it could transmit fictional fixture data to the configured provider and might write files. The audit continued with browser checks, local API reads, source inspection, and local tests with scripted model responses. Provider outages, fresh model behavior, live cancellation, and live concurrency remain untested. No full screen-reader or accessibility compliance assessment was performed.

## What matters most for a filmed demo

The main goal is a correct story that is easy to follow. Select one case, one question, and a small set of supporting records. Review the real answer before filming. A recorded demo can omit unused paths, but its claims must still match the evidence.

| Priority | Demo risk | Relevant findings | Recommendation for the video |
| --- | --- | --- | --- |
| 1 | Unsupported or incorrect answer | 49-55, 66 | Check every claim against the cited rows. Verify times, values, units, and uncertainty. Do not present source-reference validation as proof of a conclusion. |
| 2 | Chat and timeline show different scopes | 22-23, 32 | Set the timeline to the exact interval discussed. Name the time and target in the question. Attach the relevant evidence. Keep the visible timeline and answer consistent. |
| 3 | Important events are hard to see | 3, 12, 47 | Use a narrow interval and relevant systems. Check that each important marker is visible. Use close-up shots for record text and citations. |
| 4 | Evidence navigation interrupts the story | 19, 25-27, 30 | Rehearse event to source to chat citation. Check every click on the selected build. Avoid a path that resets the list or leaves unrelated evidence on screen. |
| 5 | The agent is slow or ends without a useful result | 58, 63, 65 | Complete and review the actual investigation before the main capture. Record its real progress and answer. Edit waiting time without implying that the investigation was instantaneous. |

If preparation time is short, focus on three things: **check the answer, align the scope, and make the evidence readable**.

### Recommended recording sequence

1. Open the operator report and explain what was observed.
2. Show a narrow timeline interval with the relevant systems.
3. Open a key event and its exact source record.
4. Attach the evidence and ask an explicit question with time and target context.
5. Show the actual investigation progress. Shorten waiting time in the edit if needed.
6. Show a concise answer with its uncertainty intact.
7. Open a citation and confirm the supporting source row.

### Conditions to check before recording

- Choose the exact build and recheck the findings that affect the planned sequence.
- Use a desktop layout with every relevant lane visible. Check the final capture dimensions and text size.
- Confirm that the chosen answer matches every cited row. Correct the script or choose another run if it does not.
- Confirm that timeline, record, and answer refer to the same case, target, and interval.
- Check that the intended markers can be selected without overlap.
- Rehearse the complete navigation sequence, including the return path from a source record.
- Keep qualifications such as incomplete capture or unknown cause in the recorded answer.
- If showing sampled points, describe the view as sampled. Do not call it a complete list of events.
- Use close-up shots when the full workspace makes evidence text too small to read.
- If fresh provider calls are needed, obtain the required approval before sending fixture data.

### Work that can wait if it is outside the recording

Mobile layout, short-screen scrolling, attachment limits, export scope, conclusion management, and rare request races can wait when the video does not use those paths. This is a filming scope decision, not a claim that those issues are resolved. A validator rewrite is not required solely to record one manually checked answer. The underlying validation risks still require engineering work before broader use.

Avoid these two claims in narration or on-screen copy:

- **“Full view”** when points are sampled. Prefer a narrow focused view, or disclose the sampling.
- **“Verified conclusion”** when only source references were checked. State what the evidence supports and what remains uncertain.

## Timeline and navigation findings

Main source references: `src/demo/DemoApp.vue`, `src/demo/demo.css`, `src/demo/point-layout.ts`, `src/demo/time-window.ts`, `src/server/evidence-store.ts`, and `src/server/timeline-focus.ts`.

### 01 — Mobile time labels are incorrectly positioned

**Severity:** High. **Evidence:** Observed; Code.

A window from 14:00:30 to 14:05:30 puts 14:02:30 at its midpoint. That position should show 14:03:00. Mobile CSS hides some labels, then flex spacing redistributes the remaining labels independently of event positions.

**Recommendation:** Position ticks from their timestamp values on the same scale as events. Test label positions at each responsive breakpoint. Use the desktop view for filming until the mobile axis is corrected.

### 02 — Scrolling prevents access to lower system lanes

**Severity:** High. **Evidence:** Observed; Code.

At a 1280×600 viewport, the lane area was only 75 pixels tall. Scrolling over it changed the time window instead of revealing the lower lanes. Its vertical scroll position stayed at zero.

**Recommendation:** Separate vertical lane scrolling from time zoom. Keep a clear zoom control and a reliable way to reach every lane. For the video, use a viewport where the relevant lanes fit without vertical scrolling.

### 03 — Timeline markers overlap heavily

**Severity:** High. **Evidence:** Observed.

In the full recording, another element covered the center of 149 of 586 markers. This does not prove that every covered marker was entirely inaccessible, but it makes direct selection unreliable. Simultaneous changes form dense vertical stacks.

**Recommendation:** Provide a clear collision drill-down or more space for simultaneous events. Preserve access to every underlying record. For filming, narrow the interval and confirm each intended marker can be selected. This report does not select a new grouping design.

### 04 — “All recording” excludes loaded records

**Severity:** High. **Evidence:** Observed; Code.

Case 001 reports 29,362 records, but its full timeline shows 29,360. Startup records at `tracking_service.txt:L1` and `notification_service.txt:L1` occur just before the manifest start. Timeline navigation cannot reach them.

**Recommendation:** Reconcile the manifest window with actual source times. Either include out-of-window records in the navigable extent or expose them with an explicit exception count. Do not claim that the displayed full interval contains every loaded record.

### 05 — “Full view” is sampled

**Severity:** Medium. **Evidence:** Observed; Assessment.

The full view showed 1,080 of 28,736 time points. A small sampling notice conflicts with the main label.

**Recommendation:** Name the mode by what it shows, such as sampled record points. Keep the shown/total count near the mode control. Use a narrow view for the filmed sequence.

### 06 — The overview ignores timeline filters

**Severity:** Medium. **Evidence:** Observed; Code.

Filtering to T-014 reduced the detailed view to 84 records. The overview stayed unchanged. It does not clearly state that it still represents all sources and targets.

**Recommendation:** Either apply the same filters to the overview or label its global scope explicitly. Show which scope each count describes.

### 07 — Overview and detail axes do not align at full extent

**Severity:** Medium. **Evidence:** Observed; Assessment.

The overview extends across the system-name column. The detailed plot ends before that column. The same time therefore has a different horizontal position when both show the full recording.

**Recommendation:** Align the plotting extents or make their different scales explicit. Avoid visual framing that suggests a shared vertical time alignment when there is none.

### 08 — Time navigation is too coarse

**Severity:** Medium. **Evidence:** Observed; Code.

There is no direct start/end input or jump-to-time field. Clicking the overview always changes the window to five minutes, which discards the selected zoom level.

**Recommendation:** Add precise time navigation and preserve the current duration during overview navigation unless the user chooses another duration. Prepare the exact interval before recording.

### 09 — Collapsed filters hide their meaning

**Severity:** Medium. **Evidence:** Observed; Assessment.

The search button shows only a filter count. Users must reopen it to learn which target, source, or search term is active.

**Recommendation:** Keep active filter values visible as concise labels with individual clear actions. Make the current scope readable without opening a panel.

### 10 — Empty results give the wrong instruction

**Severity:** Medium. **Evidence:** Observed.

With `operator` and T-014 selected, the empty timeline still said to zoom in for detail. Zooming cannot solve that filter combination.

**Recommendation:** Use a true empty state. Explain the active scope and offer actions to clear filters or expand the interval. Do not show a detail hint for zero results.

### 11 — Target filtering removes useful surrounding context

**Severity:** Medium. **Evidence:** Observed; Assessment.

Operator notes and system-level records without a target ID disappear under a target filter. The interface does not explain that related context may be excluded.

**Recommendation:** Disclose this behavior. Consider an explicit option to retain system and diary context alongside target-specific records. Keep target evidence distinct from contextual evidence.

### 12 — Event labels do not identify the event well enough

**Severity:** Medium. **Evidence:** Observed.

Several markers share a generic component-report or track-change label and timestamp. Labels often omit the source, target, and changed field.

**Recommendation:** Include enough identity in visible details, tooltips, and accessible names to distinguish simultaneous records. Give changes a clear before/after description when the source supports it.

### 13 — Approximate diary times look exact

**Severity:** Medium. **Evidence:** Observed; Assessment.

A diary note marked ±2 minutes appears as one precise timeline point. The time uncertainty becomes visible only after opening the record.

**Recommendation:** Show the reported-time uncertainty on the timeline or in an immediately visible label. Preserve the distinction between reported occurrence time and recording time.

### 14 — Time precision and context are inconsistent

**Severity:** Medium. **Evidence:** Observed; Code.

Timeline labels and record rows omit milliseconds even when the source contains them. The main workspace also lacks a persistent recording date and timezone label.

**Recommendation:** Show the case date and timezone. Expose milliseconds when they distinguish nearby records. Keep source precision and local/UTC conversion clear across the timeline, inspector, and answer.

### 15 — System, source, and chat names do not match

**Severity:** Medium. **Evidence:** Observed; Assessment.

Services Server contains several separate services. Chat uses Hebrew component names. Filters use IDs such as `position-bridge`. Users must infer the mapping.

**Recommendation:** Use one consistent display vocabulary. Keep original IDs available beside the display names. Explain when a lane is a display group rather than a physical system.

### 16 — The empty Radio System lane consumes useful space

**Severity:** Low. **Evidence:** Observed; Assessment.

The radio lane remains full height although no radio data was supplied. It has no collapse control.

**Recommendation:** Allow empty lanes to collapse while retaining a clear no-data indication. Do not imply that missing data means inactivity.

### 17 — Search scope and matching rules are unclear

**Severity:** Medium. **Evidence:** Observed; Code.

Search applies to the current time window. There is no direct whole-case search action, message-type selector, or explanation that matching is literal.

**Recommendation:** Show the search scope and matching rule. Add explicit whole-case search and message-type filtering if those tasks are supported. Offer a scope-expansion action when a query has no matches.

### 18 — The workspace cannot be restored or shared accurately

**Severity:** Medium. **Evidence:** Code.

The URL stores only the case. It does not preserve the interval, filters, selected record, or display mode. Reloading loses this working context.

**Recommendation:** Preserve the useful workspace state in a shareable URL or a saved view. Keep case navigation consistent with browser history. Record the intended filming setup before capture.

## Event and evidence findings

Main source references: `src/demo/EvidenceDock.vue`, `src/demo/TimelineGroupDock.vue`, `src/demo/DemoApp.vue`, `src/demo/demo.css`, and `src/server/timeline-focus.ts`.

### 19 — The desktop evidence panel is too constrained

**Severity:** Medium. **Evidence:** Observed; Assessment.

The fixed-height panel forces scrolling through fields, source lines, and groups. It has no resize or expand control.

**Recommendation:** Add a larger reading view or a resizable panel. Keep record identity and navigation visible. Use close-up shots when showing evidence in the video.

### 20 — Mobile opens with most of the timeline covered

**Severity:** Medium. **Evidence:** Observed.

Selecting a case automatically opens its diary record in a large fixed panel. Users must close it before inspecting most system lanes.

**Recommendation:** Use a deliberate mobile entry state or a compact panel that users can expand. Do not cover the main investigation view automatically. Keep the filmed demo on desktop if mobile is outside scope.

### 21 — Mobile hides important record identity

**Severity:** Medium. **Evidence:** Observed; Code.

The evidence header hides event time and type. Record tables also hide the source column.

**Recommendation:** Retain time, type, and source in a compact mobile identity block. Reduce secondary metadata before removing the fields needed to distinguish records.

### 22 — Selected evidence can contradict the active view

**Severity:** Medium. **Evidence:** Observed.

The timeline showed zero matching records while the old diary record remained in the source panel. There was no indication that it fell outside the active filters.

**Recommendation:** Mark evidence that is outside the current view. Keep the source open if useful, but explain its scope and provide a way to locate it.

### 23 — There is no clear action to locate selected evidence

**Severity:** Medium. **Evidence:** Observed; Code.

A citation can open a record outside the current interval without showing where it belongs on the timeline.

**Recommendation:** Add an explicit locate action that reveals the event and explains any filter changes. Preserve a return path to the previous view. Recheck this finding against later navigation changes before implementation.

### 24 — Record navigation depends on the loaded page

**Severity:** Medium. **Evidence:** Observed; Code.

A valid record can have no previous/next pager because it is outside the current 80-row page. This also affects the initial diary selection.

**Recommendation:** Resolve the record's position in the relevant result set or offer source-neighbor navigation independently of the loaded page. Label which ordering the pager uses.

### 25 — Pagination keeps the old scroll position

**Severity:** Medium. **Evidence:** Observed.

After scrolling to the bottom of records 81-160, selecting Next opened records 161-240 at the bottom. The start of the new page was not visible.

**Recommendation:** Move to the start of the new page and announce the new range. Preserve scroll position when returning to a previous page only if that behavior is deliberate and clear.

### 26 — Returning from a record loses the group view

**Severity:** Medium. **Evidence:** Observed; Code.

Back to group resets the panel to the group overview. It does not return to the previous record list and scroll position.

**Recommendation:** Preserve the selected series, subview, page, and scroll position. Treat source inspection as a drill-down with a reliable return path.

### 27 — File buttons do not provide usable file browsing

**Severity:** Medium. **Evidence:** Observed; Code.

Opening `capture_manifest.json` showed only lines 1-3. There was no control to read further. Other file buttons also open line 1 with limited context.

**Recommendation:** Open a file-aware view with pagination or a structured manifest view. Clearly distinguish a source snippet from the complete file.

### 28 — Summary and source views remain too technical

**Severity:** Medium. **Evidence:** Observed; Assessment.

Summary often repeats strings such as `scan=546;return_class=PSR`. Raw CSV lacks column headers beside the inspected rows. Decoded fields lack descriptions.

**Recommendation:** Add short field explanations from the public catalog. Show CSV headers with source rows. Preserve the exact values and offer the raw source as a separate inspection level.

### 29 — Measurement groups lack interpretation tools

**Severity:** Medium. **Evidence:** Observed; Code; Assessment.

Groups show minimum and maximum values without a trend view. Units depend on field names. Series separated by categorical state can still have identical visible source/type/target labels.

**Recommendation:** Show units and state identity explicitly. Add a small trend view when needed to understand change over time. Keep extrema linked to exact source rows, and do not imply that a range establishes continuity or health.

### 30 — Attaching grouped evidence takes too many steps

**Severity:** Medium. **Evidence:** Observed; Assessment.

Users must open a group, find a series, open a record, and then attach it. There is no action to ask about the selected group or interval.

**Recommendation:** Provide a clear group or interval context action with a visible scope description. Any new group attachment contract must be agreed before implementation. For filming, prepare the exact record attachments in the rehearsed sequence.

### 31 — Mobile overlays lack expected keyboard behavior

**Severity:** Medium. **Evidence:** Observed; Code.

Escape did not close the overlay. The implementation does not move focus into it or keep focus within it. Background controls remain available.

**Recommendation:** Choose clear modal or nonmodal behavior. Add matching semantics, focus handling, Escape behavior, and focus restoration. Prevent hidden background interaction if the panel behaves as a modal.

## Chat and response-interface findings

Main source references: `src/demo/DemoApp.vue`, `src/demo/client.ts`, `src/demo/InvestigationProgress.vue`, `src/demo/messages.css`, `src/server/config.ts`, and `src/server/api.ts`.

### 32 — Chat does not receive the visible timeline scope

**Severity:** High. **Evidence:** Code; Assessment.

The audited request sent only the question and attached references. It did not send the selected interval, source, target, or filters. A question such as “What happened here?” could refer to a different scope than the user sees.

**Recommendation:** Show and transmit the intended chat scope through an explicit contract. Distinguish view scope from whole-case investigation scope. Recheck later branch changes. For the video, name the interval and target in the question and attach the evidence.

### 33 — “Ask about this record” only attaches it

**Severity:** Medium. **Evidence:** Observed; Code.

The action does not insert a question or explain the next step. Selecting a record alone also does not make it chat context.

**Recommendation:** Use an accurate action label and show an attachment confirmation. Explain whether the user must type a question. Make selected evidence and attached evidence visibly distinct.

### 34 — Attachment chips are difficult to inspect

**Severity:** Medium. **Evidence:** Code; Assessment.

Chips show a short source label and row number. They omit time, target, and event type. Clicking the chip removes it instead of opening a preview.

**Recommendation:** Separate preview and remove actions. Expose enough identity to confirm the intended record before sending.

### 35 — The attachment limit fails silently

**Severity:** Medium. **Evidence:** Code.

Adding a ninth reference does nothing. There is no limit message or disabled attachment state.

**Recommendation:** Show the current count and limit. Explain why another attachment was not added and provide a direct removal action.

### 36 — Changing cases discards unfinished work

**Severity:** Medium. **Evidence:** Code.

Case changes discard the draft and attachments. They also cancel the active request. Returning to the case does not restore the draft.

**Recommendation:** Preserve drafts per case. Explain cancellation when leaving an active run. Keep unsent work separate from saved conversation history.

### 37 — Users cannot prepare the next question during a run

**Severity:** Medium. **Evidence:** Code; Assessment.

The composer is disabled while the agent works.

**Recommendation:** Allow drafting while a request runs. Keep sending disabled or provide an explicit queue policy. Do not let a new draft overwrite the active question.

### 38 — The input limit is enforced only after submission

**Severity:** Medium. **Evidence:** Code.

The server rejects questions longer than 4,000 characters. The UI has no matching limit or counter.

**Recommendation:** Apply the same limit in the composer and show useful feedback before submission. Preserve the draft after a validation error.

### 39 — Completion forces chat to the bottom

**Severity:** Medium. **Evidence:** Code.

The final scroll is unconditional. It can interrupt a user reading an earlier answer.

**Recommendation:** Follow new content only when the user is already near the bottom. Otherwise show a new-answer control.

### 40 — Reopened conversations start at old messages

**Severity:** Medium. **Evidence:** Observed.

Saved conversations opened at earlier messages. There was no clear jump-to-latest control.

**Recommendation:** Restore the prior reading position or open at the latest turn. Provide a visible way to reach the latest answer.

### 41 — Saved conclusions have no useful management view

**Severity:** Medium. **Evidence:** Observed; Code.

The UI shows a count and disables the approval button. It has no conclusions list, edit action, or revoke action. Approval saves the whole answer.

**Recommendation:** Provide a reviewable conclusions list. Let users approve a specific finding and correct or revoke that approval. Keep user approval distinct from evidence validation.

### 42 — There is no clean conversation reset or branch

**Severity:** Medium. **Evidence:** Code; Assessment.

A case has one continuing conversation. The UI offers no new-chat, edit-question, or retry action for an earlier turn.

**Recommendation:** Define a clear conversation lifecycle per case. Support a fresh conversation and safe retry without silently mixing contexts or deleting saved work.

### 43 — Investigation history is bulky and weakly grouped

**Severity:** Medium. **Evidence:** Observed; Saved conversation; Code.

Opening a saved run expands many steps above the answer. Coordinator actions and evidence checks share a flat list. A cited answer can show zero checks, while another run shows 36 checks and 35 completed. These counts use different meanings without enough explanation.

**Recommendation:** Group steps by investigation task. Distinguish attempted, successful, failed, and attachment-only checks. Keep the answer easy to reach when history is expanded.

### 44 — “AI connected” only means a key exists

**Severity:** Medium. **Evidence:** Code.

The status endpoint checks whether a key is present. It does not establish authentication, model availability, or provider reachability.

**Recommendation:** Label this state as configured. Expose a separate connection-check result with its time and failure reason when such a check is authorized.

### 45 — Error recovery does not match the failed operation

**Severity:** Medium. **Evidence:** Code; Assessment.

Many errors are raw English server messages. The general retry button reloads the timeline even when provider status, session loading, or evidence opening failed.

**Recommendation:** Track the failed operation and retry that operation. Use concise user-facing messages with clear next steps. Keep technical details available separately.

### 46 — “Export investigation” overstates the export

**Severity:** Low. **Evidence:** Code; Assessment.

The export contains saved chat and lessons. It does not contain the selected timeline, filters, source data, or complete analytical results.

**Recommendation:** Label the export by its actual contents or define a fuller investigation export. Do not imply that the JSON alone reproduces the entire analysis.

### 47 — Text, targets, and keyboard navigation are too small or dense

**Severity:** Medium. **Evidence:** Observed; Code; Assessment.

Many labels are 9-11 pixels. Citation targets are about 15 pixels high. Timeline markers are 12-15 pixels. Sequential keyboard navigation passes through 90 overview buttons before reaching later controls.

**Recommendation:** Increase text and target sizes. Provide efficient keyboard navigation within dense timelines and a way to skip them. Use close-up shots for the video. These observations are not a full accessibility compliance result.

### 48 — Saved replies handle ambiguous time questions inconsistently

**Severity:** Medium. **Evidence:** Saved conversation.

In case 002, “between 3 and 4” produced an evidence-follow-up answer and asked for clarification afterward. “4:26” was interpreted as 14:26 before asking whether the user meant 16:26. These were existing saved answers, not new model calls.

**Recommendation:** Clarify ambiguous time requests before making a scoped claim. If an assumption is acceptable, state it before the answer and use it consistently. Use explicit times in the filmed question.

## Server and agent-loop findings

Main source references: `src/server/chat.ts`, `src/server/api.ts`, `src/server/evidence-store.ts`, `src/server/investigation-progress.ts`, `src/server/session-store.ts`, `src/agent/action-validator.ts`, `src/agent/intent-router.ts`, `src/agent/delegation-controller.ts`, `src/agent/root-cause-orchestrator.ts`, `src/agent/blackboard.ts`, and `src/agent/tool-profiles.ts`.

### 49 — Validation does not establish support for each claim

**Severity:** High. **Evidence:** Code.

The active validator checks citation syntax, source availability, and some entity names. It does not verify each factual, numerical, temporal, or causal claim against its evidence. One valid citation can accompany unsupported statements.

**Recommendation:** Add checks that connect material claims to the cited evidence and requested scope. Until then, describe the result as source-reference validation. Manually verify every claim in the chosen filmed answer.

### 50 — Entity coverage checks have gaps

**Severity:** High. **Evidence:** Code.

The validator checks specified and all-available scope but skips single-entity scope. For non-health answers, required components are rebuilt from literal source IDs in the question. Hebrew names can lose their required coverage.

**Recommendation:** Normalize requested entities through the same vocabulary used by the UI and router. Check single-entity requests as well as lists. Preserve explicit user scope through all answer modes.

### 51 — Requested scope is not enforced at the tool boundary

**Severity:** High. **Evidence:** Code.

Time, entity, and worker-task scope are largely instructions to the model. Tools can query outside the requested interval. Final validation does not check the answer's time range.

**Recommendation:** Carry an explicit requested scope through tool calls and validation. Require deliberate, disclosed scope expansion when useful. Check answer times and entities against the original request.

### 52 — Worker confidence is assigned without evidence calibration

**Severity:** High. **Evidence:** Code.

Every extracted worker finding receives `confidence: 0.9`. The controller does not calculate this value from the evidence.

**Recommendation:** Remove the fixed numerical confidence or replace it with an evidence-based assessment and clear criteria. Do not show a numerical confidence in the video unless its meaning is justified.

### 53 — Worker finding status uses fragile text matching

**Severity:** High. **Evidence:** Code.

English phrases such as “no error” or “0 drops” determine negative status. Hebrew wording and mixed findings are not handled reliably. The whole worker response becomes one finding.

**Recommendation:** Require structured worker findings with explicit status per claim. Validate the structure and supporting references. Do not infer investigation status from a few words in free text.

### 54 — Structured uncertainty is lost between layers

**Severity:** High. **Evidence:** Code.

Worker contradiction arrays are always empty. Extracted findings set `missing_coverage_flag` to false. The coordinator omits separate negative-finding and contradiction fields. The UI detail mapping drops finding status and coverage flags. Some qualifications may survive in prose, but their structured meaning is lost.

**Recommendation:** Preserve contradictions, negative findings, abstentions, and missing coverage through worker, coordinator, persistence, and UI contracts. Validate that compression does not remove material uncertainty.

### 55 — Coverage restrictions are too broad and incomplete

**Severity:** High. **Evidence:** Code.

Any excluded message type or recorder drop blocks every negative finding, including findings about unrelated evidence. Positive findings do not receive an equivalent check for required missing coverage.

**Recommendation:** Evaluate coverage per claim and required source. Allow qualified negative observations where the relevant capture supports them. Require explicit limits for positive claims that depend on missing evidence.

### 56 — Worker budget reporting can report success after exhaustion

**Severity:** High. **Evidence:** Code.

Calls stop incrementing at the limit, but completion checks whether the count is greater than the limit. That success-path condition cannot become true. Declared worker token budgets are not enforced by this controller.

**Recommendation:** Track exhaustion explicitly and return it even when the worker later produces text. Enforce token limits and report consumed budgets consistently. Preserve supported partial findings when a limit is reached.

### 57 — Tool capabilities do not fully support the promised tasks

**Severity:** Medium. **Evidence:** Code.

The timeline skill reads small chronological pages but cannot request timeline aggregates. The signal skill cannot discover records through `query_events`. Declared profile limits differ from limits used by the live chat controller.

**Recommendation:** Align skill promises, tool access, and enforced limits. Provide bounded aggregate and schema-discovery operations where required. Test broad questions without relying on the earliest pages alone.

### 58 — Repair cannot recover from the wrong route

**Severity:** Medium. **Evidence:** Code.

Normal-answer repair uses the same agent and tool profile. It does not reroute to a better skill. Causal answers do not receive the same final-answer repair loop.

**Recommendation:** Use bounded repair that can distinguish missing evidence, poor wording, and wrong task selection. Allow controlled rerouting when the selected tools cannot answer the request. Apply clear final validation behavior across modes.

### 59 — Conversation memory is short and loses structure

**Severity:** Medium. **Evidence:** Code.

Only the last six messages are retained, each cut to 4,000 characters. Earlier requested scope and structured findings are not preserved. Previous citations can remain eligible without loading their original content into the new turn.

**Recommendation:** Retain a compact structured record of scope, established findings, uncertainty, and references. Reload source evidence when a new claim depends on it. Explain when earlier context is no longer available.

### 60 — Language handling is inconsistent across turns

**Severity:** Medium. **Evidence:** Code.

Explicit English detection uses a narrow expression on the current question. A follow-up can lose the earlier language request. Progress labels remain Hebrew. Other requested languages lack equivalent validation.

**Recommendation:** Store the conversation language explicitly and apply it to answers, clarifications, and progress. Honor changes when the user requests them. Use one chosen language throughout the filmed sequence.

### 61 — Clarification bypasses the normal answer checks

**Severity:** Medium. **Evidence:** Code.

The clarification branch returns before normal final validation. The router's greeting and short-input guard is bypassed in normal use because case context is appended before routing.

**Recommendation:** Separate the original question from contextual data before routing. Validate clarification output for scope and language. Clarifications need not invent evidence citations, but they must not contain unchecked factual conclusions.

### 62 — Investigation state is not a verified, resumable record

**Severity:** Medium. **Evidence:** Code.

Blackboard facts receive a verification timestamp without evidence verification at insertion. The initial blackboard summary is embedded once. Full blackboard state is not saved with the chat result. `submit_findings` marks completion but does not itself stop further agent turns.

**Recommendation:** Distinguish proposed facts from verified facts. Keep coordinator state current, save the state needed for review or resume, and make successful submission a clear terminal state. Avoid extra model work after the result is accepted.

### 63 — An optional wording pass can discard a valid result

**Severity:** Medium. **Evidence:** Code.

If the shortening or language-editing call fails, the request fails instead of returning the already validated draft.

**Recommendation:** Preserve the validated draft. Treat optional shortening failure as a recoverable presentation failure. If a required language correction fails, return a clear status without losing the underlying result.

### 64 — Asynchronous UI actions have race risks

**Severity:** High. **Evidence:** Code; not reproduced live.

Sending sets `busy` after awaiting provider refresh, so rapid sends can start twice. Approval responses replace the session without checking whether the user switched cases. These paths can produce conflicting UI state.

**Recommendation:** Reserve the send operation before the first asynchronous step. Associate every response with its original case and request. Ignore stale responses and make repeated submissions safe.

### 65 — Cancellation and delivery lack reliable recovery state

**Severity:** High. **Evidence:** Code; not reproduced live.

Only successful turns are saved. There is no checkpoint or resume path. A disconnect after saving but before delivering `done` can leave the server and client disagreeing about success. Retrying has no request ID to prevent duplication.

**Recommendation:** Give each run a stable request ID and a readable status. Reconcile persisted success after reconnection. Make retries idempotent. Preserve useful partial progress and distinguish canceled, timed-out, failed, and completed runs.

### 66 — Calculation and progress records are insufficient for full review

**Severity:** Medium. **Evidence:** Code.

Calculations lack a durable calculation reference and machine-enforced unit compatibility. Gap calculations can mix streams unless the model filters correctly. Completed progress steps replace their original scope details with result counts, so the UI cannot reconstruct the exact query. The numerical method text also calls the arithmetic exact, although not every aggregate uses decimal arithmetic.

**Recommendation:** Store calculation parameters, units, stream identity, method, and source references. Keep query scope alongside result summaries. Distinguish arithmetic guarantees accurately. Make each material numerical result reproducible without relying on prose alone.

## Suggested follow-up order

1. Select the filming build and recheck the five video priorities.
2. Prepare one manually verified investigation and rehearse the evidence path.
3. Fix any display, scope, or navigation failure that still occurs in that exact path.
4. Record the real flow with readable close-up shots and honest uncertainty.
5. After the video, address claim validation, structured uncertainty, scope enforcement, and request recovery before broader live use.

Keep findings 01-66 as stable references when creating implementation tickets. Reproduction on a later build should be recorded separately. Do not remove the original observation or mark a code risk as a reproduced failure without new evidence.
