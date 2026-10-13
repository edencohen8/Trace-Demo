# Lane 3: Intent-Aware Chat Harness, On-Demand Skills & Sub-Agent Delegation Controller

## Parent
Part of #1

## What to build
Build the complete Lane 3 investigation harness using `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai` in strict compliance with `TRACE_ARCHITECTURE.md §7.0–§7.4`:
1. **Chat Coordinator & Intent Router**: Route user inquiries across the 4 agreed skills (`health-status`, `timeline-summary`, `signal-analysis`, `root-cause-investigation`) with entity scope (`single`, `specified`, `all_available`) and query disambiguation.
2. **On-Demand Skill Registry & Tool Profiles**: Maintain versioned `SKILL.md` definitions and dynamically inject task-scoped instructions and controller-enforced tool permissions. Shared evidence lookup/explanation capability.
3. **Action Validator & Repair Controller**: Compare draft answers and evidence against original user requirements; enforce bounded repair/re-route loop (max 2 automatic retries).
4. **Root-Cause Investigation Loop & Sub-Agent Delegation**: Main investigator reasoning loop (competing hypotheses, backward/forward temporal reasoning, coverage awareness, stopping rules) with access only to `delegate_investigation`, `get_case_overview`, and `submit_findings`. Delegation Controller that spawns isolated Pi sub-agent instances with bounded tool budgets (`maxToolCalls: 8`, `maxRows: 50`, `maxTokens: 4000`).
5. **Result Compression Gate & Persistence**: Validate `SubAgentResult`, retain contradictions/negative findings, persist raw traces and session state in PostgreSQL, and enforce coverage-aware abstention (e.g. `case_004`).

## Acceptance criteria
- [ ] AC-1: Initialize Pi Agent Core with LiteLLM provider for both Main Investigator and isolated Sub-Agent instances.
- [ ] AC-2: Intent Router accurately routes user inquiries to on-demand skills (`health-status`, `timeline-summary`, `signal-analysis`, `root-cause-investigation`) with validated `RequestedAnswer` schema and bounded context lifecycle.
- [ ] AC-3: Action Validator verifies draft outputs against original request coverage (e.g. single sensor vs all systems) with a maximum of 2 automatic repair/re-route attempts.
- [ ] AC-4: Delegation Controller spawns isolated Sub-Agent instances with task-scoped prompts, allowed Lane 4 tools, and strict budget cutoffs, returning compressed `SubAgentResult`.
- [ ] AC-5: Complete harness successfully verifies point/health queries, identifies external position jump on `case_002` with evidence citations, and correctly abstains on missing capture coverage (`case_004`).

## Sub-tasks / Implementation Plan

- [x] **Sub-task 3.1: Pi Agent Core & LiteLLM Model Provider Bootstrap**
  - Set up `@earendil-works/pi-agent-core` with `@earendil-works/pi-ai` pointing to the LiteLLM/Vertex proxy.
  - Validate tool execution loop with mock tools and test conversational state handling.
  - *Verification*: Run a standalone script executing a Pi Agent instance with a mock tool; assert tool call and response.

- [x] **Sub-task 3.2: Skill Registry, Tool Profiles & Shared Evidence Resolver**
  - Implement `skill-registry.ts` and `skill-loader.ts` for the 4 approved skills (`health-status`, `timeline-summary`, `signal-analysis`, `root-cause-investigation`).
  - Implement `tool-profiles.ts` configuring controller-enforced tool allowlists and budgets per skill mode.
  - Implement shared `evidence-resolver.ts` for direct locator and calculation explanation across all skills.
  - *Verification*: Standalone test asserting registry loads versioned skill instructions on demand, enforces tool profiles, and verifies token bounds.

- [x] **Sub-task 3.3: Intent Router & Chat Scope Lifecycle Manager**
  - Implement `intent-router.ts` using deterministic rules and model-based classifier for ambiguous queries.
  - Validate router output against `RequestedAnswer` schema (`mode`, `skillIds`, `timeWindow`, `entities`, `entityScope`, `requiresClarification`).
  - Implement context lifecycle manager ensuring mode transitions do not accumulate unbounded prompt context.
  - *Verification*: Prompt & routing test verifying correct classification across all 4 skills, `entityScope` distinction (`single` vs `all_available`), and clarification requests.

- [x] **Sub-task 3.4: Action Validator & Bounded Repair Controller**
  - Implement `action-validator.ts` evaluating draft answer coverage, time window, filter scope, and evidence references against the original `RequestedAnswer`.
  - Implement `action-repair-controller.ts` with bounded loop (max 4 automatic repair/re-route attempts per turn).
  - *Verification*: Test validating that under-scoped drafts (e.g. single sensor when all systems requested) trigger repair, missing capture yields qualified unknown, and repair iterations do not exceed 4.

- [x] **Sub-task 3.5: Dynamic Blackboard Orchestrator & Delegation Controller**
  - Implement Main Investigator as an iterative orchestrator maintaining an active `InvestigationBlackboardState` (`established_facts`, `working_hypotheses`, `open_leads`, `exhausted_sources`).
  - Dynamic loop: iterative exploratory fact-finding before hypothesis formation, living hypothesis lifecycle (propose, support, refute, evolve), backtracking from cold leads, and stopping rules (cross-corroboration vs archive exhaustion abstention).
  - Main Investigator tools strictly restricted to: `get_case_overview`, `delegate_investigation`, `update_blackboard`, `submit_findings` (no direct SQL or raw dumps).
  - Implement `DelegationController`: spawns fresh, isolated Pi Sub-Agent instances with task-scoped prompts, allowed Lane 4 tools, and strict budget (`maxToolCalls: 8`, `maxRows: 50`, `maxTokens: 4000`, max 5 delegations per inquiry).
  - *Verification*: Multi-agent diagnostic test on `case_002` verifying iterative fact gathering, hypothesis formulation, backward/forward sub-agent delegation, and structured `submit_findings` output.

- [ ] **Sub-task 3.6: Result Compression Gate, Trace Auditor & End-to-End Persistence**
  - Persist full sub-agent transcripts and raw tool calls to PostgreSQL for replay and UI audit.
  - Implement compression gate: validate `SubAgentResult` schema, verify presence of evidence references, and retain contradictions and negative findings.
  - Persist investigation session state in PostgreSQL: active hypotheses, verified findings, remaining budgets.
  - Enforce stopping rule and coverage-aware abstention on missing data (e.g. `case_004`).
  - *Verification*: End-to-end integration test on `case_002` (detecting position jump with log citations) and `case_004` (abstaining on missing TargetTrack coverage).

## Blocked by
- Blocked by #4 (Lane 4 Tools API)
*(Can start bootstrap, skills, routing, validation, and prompt scaffolding immediately with mock tool interfaces)*

