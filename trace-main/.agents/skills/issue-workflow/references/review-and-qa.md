# Three-axis issue review and lightweight QA

Read at review time and reuse for QA. Focus on the selected issue's output and affected system behavior, with polished interactions and quick feedback.

## Verification architecture: Subtask testing vs. Issue QA

Our workflow employs a two-tier verification model:
1. **Subtask-Level Testing & Verification (Inner Loop):** Each subtask defined in `## Sub-tasks / Implementation Plan` specifies an explicit `*Verification*` contract (e.g. unit tests, parser fixtures, specific query assertions). This contract must be executed, passed, and evidenced before marking the subtask complete (`- [x]`).
2. **Issue-Level Integration QA & Three-Axis Review (Outer Loop):** Executed after all subtasks are complete. It verifies that individual subtasks compose cleanly, runs end-to-end smoke tests through real public interfaces, and validates all parent issue Acceptance Criteria (`AC-1` through `AC-n`).

## Review packet

Freeze one candidate identity. Provide the issue ID/title, full applicable requirements and acceptance criteria, complete issue changes, subtask verification evidence, active inter-lane contracts ([`docs/contracts/`](../../../../docs/contracts/README.md)), relevant surrounding code, baseline/user-owned initial changes, resolved decisions, documented standards, and checks already executed. Include added/deleted/uncommitted files; a committed three-dot diff alone misses work in progress. Parent specs provide applicable context, not extra work to implement.

With Git, resolve the baseline to a fixed SHA and capture the working candidate. Without Git, compare before-edit copies with current files and include the new-file manifest. If provenance is unavailable, disclose it and assess present behavior without attributing unrelated user changes to this issue.

## Three lenses

| Axis | Inspect | Evidence |
| --- | --- | --- |
| Standards and architecture | Repo conventions, readable names, duplication/coupling, interface clarity, compliance with inter-lane contracts (`docs/contracts/`), unnecessary abstractions | Actual rule/contract and changed code; concrete maintenance consequence |
| Issue output and correctness | Every issue criterion, expected content, affected transitions/boundaries, missing behavior, scope drift | Criterion ID, triggering scenario, expected versus actual behavior |
| Product polish and performance | Changed output/interactions, visual consistency, usable feedback, relevant empty/loading/error states, responsive behavior, keyboard/focus and localization where relevant, responsiveness and obvious bottlenecks | Rendered scenarios/screenshots, observed interactions, targeted timings when necessary |

Consult the Standards sources and smell baseline in [code-review](../../code-review/SKILL.md) for axis 1; use [codebase-design](../../codebase-design/SKILL.md) when design matters. Repo standards override heuristics. Treat smells/aesthetic preferences as suggestions unless they have a concrete consequence or violate an established expectation.

Axis 3 includes relevant recovery/reliability and obvious severe security issues in touched code. General hardening, broad threat modeling, comprehensive profiling, and whole-product review are outside the default scope. An unmeasured performance concern is a hypothesis, not a claimed regression.

## Review output and fix loop

Each axis returns a verdict (`pass`, `needs-fixes`, or `blocked`), covered files/issue criteria, unassessed relevant areas, and actionable findings. A finding names its axis, location, trigger, impact, evidence/confidence, and smallest useful fix/verification. An empty report without coverage is insufficient.

Classify findings by issue impact:

- **Blocker:** an issue criterion fails, affected behavior breaks, serious data/credential exposure is introduced, or changed-path performance is unusable. Resolve and verify before calling the issue complete.
- **Fix:** bounded in-scope quality defect without a promised behavior failure. Fix within the budget; otherwise disclose impact and reason for deferral. A violation of promised acceptance criteria is always a blocker.
- **Follow-up:** unrelated defect, optional improvement, future hardening, or unproven concern. Record when useful; implement or publish it only if separately authorized.

Keep three separate verdicts. Deduplicate shared defects while retaining originating axes. Verify disputed findings against raw evidence rather than voting. After changes, re-review affected axes against the new candidate; prior evidence is stale where relevant files/conditions changed. A skipped/unavailable axis cannot count as passed.

## Small issue QA plan

Select checks from the issue criteria and changed surface:

1. Run required repo checks. Prefer focused existing commands while iterating; run required final checks on the final candidate. New frameworks/extensive suites need a demonstrated benefit within the budget.
2. Smoke-test the changed behavior with representative input; verify output, relevant state transitions, and the immediately adjacent integration. Include likely empty/error/recovery cases when affected. A single scenario can be enough for a narrow issue; expand only to cover its criteria or demonstrated risk.
3. For UI work, inspect real rendering and affected controls at the intended viewport, plus one narrow viewport when relevant; exercise relevant navigation, keyboard/focus, and RTL/localization. Use screenshots where helpful; inspect runtime/console errors with available tools.
4. For CLI/API/non-UI work, exercise supported calls with realistic fixtures and verify output/state. Add a narrowly targeted regression check for fragile important behavior only when existing checks are insufficient.
5. For relevant performance, record a targeted before/after timing or trace under comparable representative conditions. Use an agreed budget when available. Unmeasured behavior does not receive a fabricated performance pass.

Keep evidence concise: issue/acceptance ID, candidate identity, scenario/command, expected and observed result, and status (`passed`, `failed`, `blocked`, or `not-applicable` with a reason). Link screenshots/logs where useful. Whole-demo verification is justified only by a cross-cutting issue change or required repo checks.

## QA failures and issue completion

Reproduce a new failure; use [diagnosing-bugs](../../diagnosing-bugs/SKILL.md) when hard to isolate. Compare with the baseline for pre-existing failures. Fix within issue scope, re-review affected axes, and rerun impacted scenarios and required checks whose evidence changed. Broaden checks only when a failure reveals another affected surface. A new regression caused by the issue is in scope to repair; a pre-existing unrelated defect is a follow-up candidate.

When access/tooling prevents QA, finish independent work and report the exact missing verification. Manual instructions remain pending until results arrive. Distinguish implementation complete from verified and from tracker status.

This issue is verified when its criteria have current passing evidence, affected behavior works, required checks pass, and no unresolved blocker remains. Do not weaken promised criteria to manufacture a pass. Report out-of-scope follow-ups without implementing them or closing other issues. End the run after the selected issue result.
