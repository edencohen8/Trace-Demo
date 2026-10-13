# Work Log: Lane 3 - Intent-Aware Chat Harness, On-Demand Skills & Sub-Agent Delegation Controller

- **Issue:** [#5](https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo/-/work_items/5) / `.scratch/issues/05-lane3-agent-harness.md`
- **Parent:** [#1](https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo/-/work_items/1)
- **Branch:** `lane-3-agent-harness`
- **Baseline Commit:** `21ffbf5`
- **Started:** 2026-10-13T10:39:00+03:00

---

## 1. Scope & Objective

Build the Lane 3 intent-aware investigation harness using `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai` in strict compliance with `TRACE_ARCHITECTURE.md §7.0–§7.4`:
1. **On-Demand Skills & Registry**: Maintain 4 versioned skills (`health-status`, `timeline-summary`, `signal-analysis`, `root-cause-investigation`) with dynamic instruction loading, controller-enforced tool profiles, and shared evidence resolution.
2. **Intent Routing & Context Lifecycle**: Route user inquiries across the 4 skills with entity scope (`single`, `specified`, `all_available`) and bounded context management.
3. **Action Validation & Bounded Repair**: Validate draft answers and evidence against original user requirements with a maximum of 2 automatic repair/re-route attempts per turn.
4. **Root-Cause Investigation Loop & Sub-Agent Delegation**: Main investigator reasoning loop with strictly bounded tools (`delegate_investigation`, `submit_findings`, `get_case_overview`), spawning isolated Pi sub-agent instances with bounded tool budgets (`maxToolCalls: 8`, `maxRows: 50`, `maxTokens: 4000`).
5. **Compression Gate & State Persistence**: Validate structured findings, retain contradictions/negative findings, persist raw traces and session state in PostgreSQL, and enforce coverage-aware abstention (e.g. `case_004`).

---

## 2. Acceptance Criteria Mapping

| Acceptance Criteria | Description | Addressed by Sub-tasks | Status |
|---|---|---|---|
| **AC-1** | Initialize Pi Agent Core with LiteLLM provider for both Main Investigator and isolated Sub-Agent instances. | Sub-task 3.1 | `MET` |
| **AC-2** | Intent Router accurately routes user inquiries to on-demand skills with validated `RequestedAnswer` schema and bounded context lifecycle. | Sub-task 3.2, Sub-task 3.3 | `PENDING` |
| **AC-3** | Action Validator verifies draft outputs against original request coverage with a maximum of 2 automatic repair/re-route attempts. | Sub-task 3.4 | `PENDING` |
| **AC-4** | Delegation Controller spawns isolated Sub-Agent instances with task-scoped prompts, allowed Lane 4 tools, and strict budget cutoffs, returning compressed `SubAgentResult`. | Sub-task 3.5 | `PENDING` |
| **AC-5** | Complete harness successfully verifies point/health queries, identifies external position jump on `case_002` with evidence citations, and correctly abstains on missing capture coverage (`case_004`). | Sub-task 3.6 | `PENDING` |

---

## 3. Active Inter-Lane Contracts

- **CTR-01**: Parquet Partitioning & DuckDB Analytical Views (`AGREED`)
- **CTR-02**: PostgreSQL Event Store & Hybrid Search Interface (`AGREED` - consumed for transcripts/state and search)
- **CTR-03**: Deterministic Tools & Evidence Engine API (`AGREED` - consumed tools: `analyze_fields`, `search_text`, `query_events`, `resolve_evidence`)
- **CTR-04**: Investigator Findings, Contradictions & Session State (`AGREED` - produced by Lane 3)
- **CTR-05**: Evidence Reference & Source Locator Standard (`AGREED` - consumed/produced)

---

## 4. Subtask Ledger

| Sub-task | Description | Stage | Verification Target | Evidence / Notes | Status |
|---|---|---|---|---|---|
| **Sub-task 3.1** | Pi Agent Core & LiteLLM Model Provider Bootstrap | Verified | Standalone script executing Pi Agent instance with mock tool | Verified via `tsx scripts/verify-subtask-3-1.ts` | `COMPLETE` |
| **Sub-task 3.2** | Skill Registry, Tool Profiles & Shared Evidence Resolver | Verified | Registry on-demand loading, tool profile restrictions, token bounds | Verified via `tsx scripts/verify-subtask-3-2.ts` | `COMPLETE` |
| **Sub-task 3.3** | Intent Router & Chat Scope Lifecycle Manager | Verified | Routing accuracy across 4 skills, entityScope distinction, clarification | Verified via `tsx scripts/verify-subtask-3-3.ts` | `COMPLETE` |
| **Sub-task 3.4** | Action Validator & Bounded Repair Controller | Verified | Validator catches under-scoped drafts, repair bounded to <= 4 attempts | Verified via `tsx scripts/verify-subtask-3-4.ts` | `COMPLETE` |
| **Sub-task 3.5** | Dynamic Blackboard Orchestrator & Delegation Controller | Verified | Dynamic fact-finding, living hypothesis lifecycle, sub-agent delegation on `case_002` | Verified via `npm run test:investigator` | `COMPLETE` |
| **Sub-task 3.6** | Result Compression Gate, Trace Auditor & End-to-End Persistence | Pending | Full run on `case_002` (citations verified) and `case_004` (abstention verified) | Pending | `NOT STARTED` |

---

## 5. Execution History & Verification Log

### Sub-task 3.1: Pi Agent Core & LiteLLM Model Provider Bootstrap (2026-10-13)
- **Files Created**:
  - `src/agent/types.ts`: TypeBox schemas for findings (`FindingSchema`), evidence citations (`EvidenceCitationSchema`), source locators (`SourceLocatorSchema`), delegated tasks (`DelegatedInvestigationTaskSchema`), and sub-agent results (`SubAgentResultSchema`) complying with CTR-04 and CTR-05 in strict TypeScript.
  - `src/agent/provider.ts`: Model provider setup with `createLiteLLMProvider` (OpenAI completions API proxy pointing to LiteLLM / Vertex), `createFauxModelProvider` (scripted responses for offline testing), and `initModelRegistry`.
  - `src/agent/harness.ts`: Core investigation agent controller factory `createInvestigationAgent` wrapping `@earendil-works/pi-agent-core` with lifecycle tracking, state accessors, and event pub/sub.
  - `scripts/verify-subtask-3-1.ts`: Standalone verification test executing a tool-calling loop, verifying event sequence (`agent_start` -> `tool_execution_start` -> `tool_execution_end` -> `turn_end` -> `agent_end`), argument validation, and assistant response synthesis.
- **Verification Result**:
  - `npm run test:agent` passed with exit code 0.
  - AC-1 satisfied.

### Sub-task 3.2: Skill Registry, Tool Profiles & Shared Evidence Resolver (2026-10-13)
- **Files Created**:
  - `src/skills/health-status/SKILL.md`: Standard markdown playbook for component health lookup without causal overreach.
  - `src/skills/timeline-summary/SKILL.md`: Standard markdown playbook for chronological event summaries.
  - `src/skills/signal-analysis/SKILL.md`: Standard markdown playbook for deterministic DuckDB numerical comparisons.
  - `src/skills/root-cause-investigation/SKILL.md`: Standard markdown playbook for multi-agent diagnostic loop.
  - `src/agent/skills/types.ts`: TypeScript contracts for `SkillId`, `SkillDefinition`, `SkillBudget`, and `LoadedSkillContext`.
  - `src/agent/skills/registry.ts`: `SkillRegistry` loading the 4 approved skills, enforcing versioning (`v1.0.0`) and token bounding.
  - `src/agent/tool-profiles.ts`: Controller-enforced tool permission manager (`ToolProfileManager`) restricting tool execution per skill mode.
  - `src/agent/evidence-resolver.ts`: `EvidenceResolver` handling CTR-05 locators, calculation handles, and strict Ground Truth Isolation enforcement.
  - `scripts/verify-subtask-3-2.ts`: Standalone verification test.
- **Verification Result**:
  - `npm run test:skills` passed with exit code 0.
  - `npx tsc --noEmit` passed cleanly with 0 errors.

### Sub-task 3.3: Intent Router & Chat Scope Lifecycle Manager (2026-10-13)
- **Files Created**:
  - `src/agent/router-schema.ts`: TypeBox schema for `RequestedAnswer` contract matching TRACE_ARCHITECTURE.md §7.0.3.
  - `src/agent/intent-router.ts`: LLM-driven intent classification mapping user questions to validated `RequestedAnswer` JSON with normalized `entityScope` and ambiguity clarification.
  - `src/agent/chat-scope.ts`: `ChatScopeManager` providing dynamic skill instruction swapping (preventing prompt accumulation) and threshold-based smart context compaction via Pi Agent Core's `transformContext` hook.
  - `scripts/verify-subtask-3-3.ts`: Verification script asserting intent routing accuracy across all 4 skills, entityScope distinction, clarification detection, and citation-preserving context compaction.
- **Verification Result**:
  - `npm run test:router` passed with exit code 0.
  - `npx tsc --noEmit` passed cleanly with 0 errors.

### Sub-task 3.4: Action Validator & Bounded Repair Controller (2026-10-13)
- **Files Created**:
  - `src/agent/action-validator.ts`: `ActionValidator` evaluating draft answers against `RequestedAnswer` contracts, catching under-scoped entities, invalid CTR-05 badges, and Ground Truth Isolation violations.
  - `src/agent/action-repair-controller.ts`: `ActionRepairController` coordinating the feedback loop between the Main Agent and Validator Agent, bounding repairs to $\le 4$ attempts and generating degraded confidence partial answers when unresolvable.
  - `scripts/verify-subtask-3-4.ts`: Verification script asserting under-scoped draft detection, multi-attempt recovery, hard bounds at 4 attempts without infinite looping, and citation format validation.
- **Verification Result**:
  - `npm run test:validator` passed with exit code 0.
  - `npx tsc --noEmit` passed cleanly with 0 errors.

### Sub-task 3.5: Dynamic Blackboard Orchestrator & Delegation Controller (2026-10-13)
- **Files Created**:
  - `src/agent/blackboard.ts`: `InvestigationBlackboard` managing `establishedFacts`, `workingHypotheses`, `openLeads`, and `exhaustedSources`, enforcing fact gating (`hasSufficientFacts()`), living hypothesis transitions (`PROPOSED`, `SUPPORTED`, `REFUTED`, `DISCARDED`), and prompt state injection (`getSummaryForPrompt()`).
  - `src/agent/delegation-controller.ts`: `DelegationController` spawning isolated Worker Sub-Agents, stripping coordinator tools, bounding execution budgets (`max_tool_calls: 8`, `max_rows: 50`, `max_tokens: 4000`, `maxDelegations: 5`), and compressing findings.
  - `src/agent/root-cause-orchestrator.ts`: `RootCauseOrchestrator` running the Main Investigator ReAct loop with strictly 4 coordinator tools (`get_case_overview`, `delegate_investigation`, `update_blackboard`, `submit_findings`).
  - `scripts/verify-subtask-3-5.ts`: Verification script verifying dynamic fact-finding, competing hypotheses, refutation of $H_2$, backtracking to $H_1$, and CTR-04 findings with dual CTR-05 citations.
  - `scripts/interactive-agent.ts`: Interactive manual testing environment.
- **Verification Result**:
  - `npm run test:investigator` passed with exit code 0.
  - `npx tsc --noEmit` passed cleanly with 0 errors.




