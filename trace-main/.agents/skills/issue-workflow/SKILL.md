---
name: issue-workflow
description: "Work one engineering issue through our existing task structure, executing a full workflow of grilling, planning, implementation, and testing for every subtask, followed by three-axis review and lightweight QA. Prioritize desired output, working behavior, product polish, and performance."
---

# Issue workflow

One run, one issue. Drive that issue through our repository's existing task structure (`## Sub-tasks / Implementation Plan`), executing a complete engineering workflow—including grilling, planning, implementation, and testing—for every subtask. Carry the issue's acceptance criteria from investigation through verified implementation, optimizing for a polished, working product with focused feedback and lightweight verification.

## Scope and priorities

1. **Desired output:** implement the selected issue's requested behavior and deliverables through its subtasks.
2. **Working system:** exercise each subtask's verification contract, then verify the integrated system through its real public interface.
3. **Product quality:** polish and responsive performance across the issue's affected surface.

The larger product is context, not the deliverable of this run. Scope research, subtask execution, review, and QA to the selected issue and its directly affected components. Capture unrelated improvements as follow-up candidates instead of expanding scope or auditing unrelated code.

Security is a lower priority. Address obvious serious risks in touched code (such as exposed credentials or dangerous access); a broad security audit is outside this workflow unless requested.

Honor the user's stopping point: a planning request ends with an issue plan and decomposed subtask plans; an implementation request executes each subtask's full lifecycle (grilling, planning, implementation, testing) through to issue review and QA. Carry existing authorization forward. Creating/editing/closing tracker issues, messaging others, deploying, merging, and other external actions require applicable authorization. An issue URL identifies the work; it does not alone authorize closing the issue or changing its parent.

This workflow owns orchestration. Reuse model-invoked Matt Pocock disciplines (`grilling`, `codebase-design`, `tdd`, `code-review`, `diagnosing-bugs`, `research`) at the relevant stages. User-only skills such as `to-spec`, `to-tickets`, `implement`, `implement-spec`, `retro`, and `handoff` remain user entrypoints; perform this workflow's corresponding steps directly.

## 1. Select and ingest the issue and task structure

Resolve the supplied issue ID, URL, local ticket (`.scratch/issues/NN-<slug>.md`), or inline issue description. Read its full requirements, parent context, comments, and attachments through available tools (e.g. `glab issue view <iid> --comments` for GitLab issues). If multiple issues are supplied, use an explicitly selected issue or supplied execution order; otherwise ask which one to run. Process additional issues only when requested, keeping a separate record for each run.

Read applicable repo instructions (`AGENTS.md`, `TRACE_ARCHITECTURE.md`), glossary/ADRs (`GLOSSARY.md`, `docs/adr/`), and available run/check commands.

### Ingest the task structure

Our repository organizes issues with a defined task structure:
- **Parent Context & Scope:** `## Parent` (e.g. `Part of #1`) and `## What to build` describing the system capability.
- **Issue Acceptance Criteria:** High-level acceptance criteria under `## Acceptance criteria` labeled `- [ ] AC-1: ...`, `- [ ] AC-2: ...`.
- **Sub-tasks / Implementation Plan:** The primary execution structure under `## Sub-tasks / Implementation Plan` (or `## Sub-tasks`), composed of:
  - Checkbox and identifier: `- [ ] **Sub-task X.Y: <Title>**`
  - Implementation requirements: bulleted list of functional requirements, data schemas, or component behaviors.
  - Verification contract: an explicit `- *Verification*: <executable check>` defining the unit test, data query, assertion, or benchmark required to verify the subtask.
- **Dependencies:** Preconditions and blockers under `## Blocked by`.

Parse and record:
1. The issue's identity, authoritative requirements source, and parent Acceptance Criteria (`AC-1`, `AC-2`, ...).
2. The ordered list of subtasks (`Sub-task X.1`, `Sub-task X.2`, ...), their current checkbox state (`[ ]` or `[x]`), their detailed requirement bullets, and their explicit `*Verification*` specifications.
3. Map each subtask to the parent Acceptance Criteria it fulfills or advances.
4. If an issue lacks this task structure (e.g. an unstructured prompt or plain ticket), decompose the issue into this exact structure (`## Sub-tasks / Implementation Plan` with `Sub-task X.Y` and explicit `*Verification*` targets) before executing.

### Inter-lane contracts and cross-lane notes

When working concurrently across vertical lanes, contracts must stay centralized and synchronized:
1. **Consult Central Contract Registry:** Read [`docs/contracts/README.md`](../../../../docs/contracts/README.md) to discover all contracts produced or consumed by this lane.
2. **Fetch Cross-Lane Notifications:** Run `glab issue view <iid> --comments` on the current lane's issue to detect any incoming `📢 [CONTRACT UPDATE]` notifications posted by other lanes.
3. **Map Contract Constraints:** Note any active schemas, API signatures, locator formats, or breaking changes from upstream lanes that affect this issue's acceptance criteria and subtasks.

### Prerequisites and baseline

Check prerequisites. If a required dependency in `## Blocked by` is unfinished, explain the blocked criterion and complete independent in-scope subtasks; ask before expanding scope to implement another issue's work.

Capture a baseline before edits. With Git, record a fixed SHA plus initial staged, unstaged, and new files; include uncommitted/new files in review. Without Git, keep before-edit copies of relevant files outside the source tree and a manifest of added/deleted files. Preserve user changes.

For tracking progress across sessions, initialize or update `.scratch/workflows/<issue-id-or-slug>/work.md` (or the repo's existing notes location). Record issue identity, scope, baseline, acceptance criteria mapping, active contract versions, and a subtask ledger tracking stage and verification evidence for each `Sub-task X.Y`.

**Gate:** The issue and its task structure are parsed: acceptance criteria are mapped, inter-lane contracts and cross-lane notes are checked, subtasks and their verification contracts are identified, and the initial baseline is recorded.

## 2. Research cross-cutting technical uncertainty

Inspect the repository first. Before entering the subtask loop, resolve any global architectural or external technical uncertainty that impacts multiple subtasks:
- Consult repository guidelines (`AGENTS.md`, `TRACE_ARCHITECTURE.md`, `GLOSSARY.md`, and relevant ADRs). Honor ground-truth isolation and deterministic tool boundaries.
- Verify cross-lane contract dependencies in `docs/contracts/` against upstream producers and downstream consumers. If research indicates an inter-lane contract must change, draft the proposed change early and broadcast an alert to affected lanes.
- For meaningful external/API uncertainty, use [research](../research/SKILL.md): consult primary sources, gather version-aware facts, and produce a short cited note. A background researcher may investigate independent questions while work continues. Skip a separate artifact when a simple repo lookup settles the question.
- Define the question before researching. Stop when evidence supports the architectural decision. Distinguish facts, inference, and assumptions; record remaining uncertainty and which acceptance criteria it affects.
- Use a bounded [prototype](../prototype/SKILL.md) only when a quick experiment settles a material visual or interaction choice across subtasks faster than discussion; record its verdict and isolate throwaway code.
- Use [diagnosing-bugs](../diagnosing-bugs/SKILL.md) for hard failures or performance regressions. Obtain a reproduction or measurement before choosing a fix.

**Gate:** No unresolved architectural or technical uncertainty blocks subtask execution. Independent work may proceed while an unrelated prerequisite is pending.

## 3. Subtask workflow engine (Execute for every subtask)

Execute the subtasks in `## Sub-tasks / Implementation Plan` in order (respecting internal dependencies). **Every single subtask receives a complete, dedicated workflow cycle consisting of grilling, planning, implementation, testing, and check-off.**

Do not batch subtasks or skip subtask lifecycles. Run the following cycle for each `Sub-task X.Y`:

### 3.1 Subtask scoping and context
- Isolate the subtask's specific scope, child requirement bullets, and its designated `*Verification*` clause.
- Verify that prerequisite subtasks have completed and passed their verifications.
- Identify the parent Acceptance Criteria (`AC-n`) this subtask delivers or advances.
- **Contract Dependencies:** Check [`docs/contracts/README.md`](../../../../docs/contracts/README.md). Identify whether this subtask implements/updates a producing contract or consumes a contract produced by an upstream lane.

### 3.2 Subtask grilling
Use [grilling](../grilling/SKILL.md) (and [grill-me](../grill-me/SKILL.md)) to stress-test the subtask before writing code:
- Grill the specific subtask choices: function signatures, data schemas, coordinate frames/units, edge cases, error conditions, and interface boundaries.
- **Inter-Lane Contract Grilling:** If this subtask defines or touches a shared contract (e.g. Parquet schemas, Postgres tables, tool signatures, finding formats, or source locators), stress-test the contract boundaries. Identify all other lanes impacted by any change.
- Formulate the ready decision frontier as numbered questions with recommended answers:
  ```
  ❓ **Q1** - **<decision title>**: <context, options, implications>
  ➡️ <recommended answer>
  ```
- Look up repository facts and code structure yourself via available tools; do not ask the user for facts you can determine autonomously.
- Ask only genuine design, architectural, or behavioral decisions that require confirmation.
- Word questions so that accepting the recommendation is straightforward.
- Incorporate settled choices and proceed once the frontier for this subtask is clear.

**Subtask Grilling Gate:** Subtask edge cases, schemas, error paths, and behavioral decisions are settled; expected inputs and outputs are unambiguous.

### 3.3 Subtask planning
Use [codebase-design](../codebase-design/SKILL.md) to plan a clean, minimal change for this subtask:
- Map out the exact files to create or modify, public interfaces/seams, data structures, and helper modules.
- **Contract Publication & Cross-Lane Broadcast:**
  - If grilling/planning establishes or updates an inter-lane contract, write or update the specification file under `docs/contracts/<id>-<name>.md` and register it in `docs/contracts/README.md`.
  - **Broadcast Cross-Lane Notification:** Immediately post a structured update note to all affected lanes' GitLab issues:
    ```bash
    glab issue note <affected_iid> -m "📢 [CONTRACT UPDATE from Lane <X> (#<source_iid>)] <Contract Title>
    • Contract Spec: docs/contracts/<file>.md
    • Status: [PROPOSED | AGREED | MODIFIED | BREAKING]
    • Affected Lanes: Lane Y (#<iid_y>), Lane Z (#<iid_z>)
    • Decision / Changes: <summary of changes>
    • Action Required for Lane Y: <guidance>"
    ```
  - Reference the contract specification in the subtask plan and notes.
- Translate the subtask's `*Verification*` clause into concrete, executable check steps:
  - Exact test command or script (e.g. `pytest tests/test_ingestion.py -k test_subtask_1_1`, `node scripts/check-ui.mjs`, or DuckDB analytical query).
  - Target test seams, fixtures, assertion criteria, and contract schema conformance.
  - Corner cases and failure modes identified during subtask grilling.
- Keep the design minimal: favor existing seams, avoid speculative abstraction, and respect immutability boundaries (e.g. ground-truth isolation).

**Subtask Planning Gate:** The subtask has a concrete file modification plan, an executable verification plan matching its `*Verification*` contract, and any contract decisions are published to `docs/contracts/` and broadcast to affected lanes. *(For planning-only requests, repeat 3.1–3.3 for all subtasks, synthesize the overall plan, and stop here).*

### 3.4 Subtask implementation
- **Pre-Build Contract Sync Gate ("Look Before You Build Core Components"):**
  - **CRITICAL:** Immediately before coding core components, verify that no upstream lane has altered a consumed contract while planning was in progress:
    1. Run `glab issue view <iid> --comments` and inspect recent comments for incoming `📢 [CONTRACT UPDATE]` notices.
    2. Check the relevant contract spec in `docs/contracts/` for the latest agreed schema, field names, and types.
    3. Assert alignment: **Never build core components against stale or unverified interface assumptions.** If a contract changed upstream, reconcile the subtask design before implementing.
- Implement the subtask in focused vertical slices.
- Follow repository conventions, typing, and domain vocabulary (`GLOSSARY.md`).
- Implement the minimal code necessary to satisfy the subtask's requirements, grilling outcomes, and active contracts.
- Keep the codebase buildable and runnable as changes land.

### 3.5 Subtask testing and verification
Use [tdd](../tdd/SKILL.md) principles and execute the subtask's verification contract:
- Where writing new tests, write the test first at the agreed public seam, observe it fail for the intended reason (Red), then implement code until it passes (Green).
- Execute the specific `*Verification*` specified in the subtask definition:
  - Run the planned test suite, unit test, or script.
  - Run verification queries or data assertions against test fixtures.
  - **Contract Conformance Check:** Assert that serialized outputs, table columns, API responses, or locators conform to the active specification in `docs/contracts/`.
  - Exercise the edge cases, invalid inputs, and error states settled during grilling.
- Capture concrete execution output (test passes, query outputs, assertion logs).
- If verification fails, diagnose and fix within the subtask scope. Use [diagnosing-bugs](../diagnosing-bugs/SKILL.md) if failure causes are non-trivial.

**Subtask Verification Gate:** The subtask's code exists, its designated `*Verification*` command passes cleanly with concrete recorded evidence, contract conformance is verified, and existing repository checks remain unregressed.

### 3.6 Subtask review and checkbox update
- Perform a focused quality check on the subtask diff: verify coding standards, readable naming, no dead code, and clean adherence to the subtask scope and contracts.
- Confirm contract synchronization: verify that `docs/contracts/` reflects the code as built and that all cross-lane notifications were delivered.
- Update the task structure: mark the subtask checkbox complete in the issue description or ticket:
  - Change `- [ ] **Sub-task X.Y: ...**` to `- [x] **Sub-task X.Y: ...**` in the local issue file (`.scratch/issues/NN-<slug>.md`) or issue tracker description.
- Record the passing verification evidence in `.scratch/workflows/<issue-id-or-slug>/work.md`.
- If authorized and working with a remote tracker (e.g. GitLab), post a subtask completion note (`glab issue note <iid> -m "Completed Sub-task X.Y: ..."`).
- Proceed to the next subtask in `## Sub-tasks / Implementation Plan`.

## 4. Review on three axes (Full-issue integration)

Read [references/review-and-qa.md](references/review-and-qa.md). This extends the Standards/Spec model of [code-review](../code-review/SKILL.md) to the integrated candidate once all subtasks are complete.

Review the complete candidate across all completed subtasks, including all new and uncommitted files, with sufficient surrounding context:

1. **Standards and architecture:** readable, maintainable code consistent with repo conventions (`AGENTS.md`, `TRACE_ARCHITECTURE.md`), strict compliance with inter-lane contracts in [`docs/contracts/`](../../../../docs/contracts/README.md), proper separation of concerns, clean interfaces between subtask components, and no unnecessary complexity.
2. **Issue output and correctness:** verify that all parent Acceptance Criteria (`AC-1`, `AC-2`, etc.) are fully satisfied across the combined subtasks; ensure missing behavior, incorrect outputs, and scope drift are caught.
3. **Product polish and performance:** user/consumer experience, visual coherence, responsiveness, and resilient error recovery across the affected surface. Check for obvious severe security risks in touched code.

For a bounded issue, use three focused passes. For substantial changes, use independent read-only reviewers per axis when delegation is available and permitted; schedule within available slots. Each receives the same candidate, issue requirements, and baseline, with only its own lens and no other reviewer's verdict. Disclose when one agent performed review. Reviewers never edit files.

Fix confirmed in-scope defects and re-verify affected subtasks. Separate unrelated findings and optional improvements as follow-up candidates; they do not justify expanding the issue.

**Gate:** All three axes have passing verdicts and complete coverage, with no unresolved finding preventing the issue's promised behavior.

## 5. Run lightweight issue QA (End-to-end verification)

Use [references/review-and-qa.md](references/review-and-qa.md). Execute required repository checks and the planned integration smoke pass on the final candidate. Exercise the combined behavior through the real public interfaces; source inspection alone is not QA.

Verify every parent issue Acceptance Criterion (`AC-1` to `AC-n`) and cross-subtask integration:
- For analytical and data pipelines, run end-to-end queries against representative fixtures (e.g. `case_002`) and verify analytical outputs, schemas, and evidence locators.
- For UI changes, inspect rendered layout, interaction workflows, responsive behavior across viewports, and console logs using available tools.
- Verify that individual subtask outputs properly interlock (e.g. Ingestion -> Tools -> Agent -> UI) and adhere to inter-lane contracts.
- Measure performance only if the issue touches a performance-sensitive path, has an agreed budget, or shows visible slowness.

If QA reveals a defect, fix it, re-verify the affected subtask's verification contract, re-review affected axes, and rerun affected integration scenarios.

**Gate:** Every parent issue acceptance criterion has current passing evidence, required checks pass, and integrated behavior functions without material blockers.

## 6. Report the issue result and finalize

Report the issue result concisely:
- **Issue Summary:** Identity, title, and high-level deliverables.
- **Subtask Execution Summary:** Table or list of all `Sub-task X.Y` items with their status (`[x]`), key changes, and verification evidence.
- **Contract Ledger:** Summary of any contracts published, modified, or consumed in `docs/contracts/`, including cross-lane notifications broadcasted via GitLab.
- **Acceptance Criteria Verification:** Status of each parent criterion (`AC-1` ... `AC-n`) with concrete observed results.
- **Three-Axis Review Verdicts:** Summary of findings and verdicts across Standards, Output/Correctness, and Polish/Performance.
- **Lightweight QA Evidence:** Smoke pass results, test outputs, and reproduction/run commands.
- **Follow-up Candidates:** Unrelated defects, enhancements, or future optimizations clearly outside this issue.

Update issue state:
- Ensure all subtasks in the issue specification (`.scratch/issues/NN-<slug>.md` or GitLab issue) are checked off (`- [x] **Sub-task X.Y...**`).
- Update the parent Acceptance Criteria checkboxes to `- [x]` when completed.
- Update or close the selected issue only when authorized, using the relevant connector (e.g. `glab issue note <iid>` and `glab issue close <iid>`); never close a parent or unrelated issue as a side effect. Use [pr](../pr/SKILL.md) for an authorized PR description.

On interruption, leave the selected issue, current subtask, stage, required pending answers, exact next action, and evidence in `.scratch/workflows/<issue-id-or-slug>/work.md`. Resume by reconciling current files, then continue from the earliest affected gate.

**Done:** The requested stopping point for this issue is met. All subtasks have executed their full workflow (grilling, planning, implementation, testing), all issue acceptance criteria are verified, and review and QA gates have passed. Stop after this issue unless the user has authorized another run.
