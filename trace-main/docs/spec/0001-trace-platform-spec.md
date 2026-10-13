# Spec: TRACE Incident Investigation Platform

## Problem Statement

When multi-sensor radar networks or distributed radar software systems experience unexpected behavior (such as external position jumps, missing tracks, delayed notifications, or coverage dropouts), investigators are confronted with gigabytes of heterogeneous, noisy artifacts:
1. High-volume sniffer bus message exports (CSVs with millions of rows across diverse schemas and units).
2. Heterogeneous, timestamp-drifted component text logs from sensors and backend microservices.
3. Hebrew-language operator diary entries written with delayed and approximate time references.

Currently, investigators must manually correlate timestamps, manually execute time-series delta queries across millions of rows, and manually hunt through logs. Existing chat-over-logs / naive RAG systems hallucinate, choke on multi-million-row contexts, fail to distinguish incomplete exports from true negative events, and cannot produce cryptographically stable, click-verifiable evidence citations.

## Solution

TRACE provides a retrospective, evidence-backed incident investigation platform built on a dual-engine architecture:
- **Sniffer Store**: High-volume filtered sniffer CSVs are parsed and stored in typed, message-partitioned Parquet datasets queried via DuckDB for bounded numerical and temporal aggregations.
- **Text Store**: Component TXT logs and operator diary entries are parsed and stored in PostgreSQL with pgvector embeddings for hybrid exact-identifier and multilingual semantic search.
- **Pi Multi-Agent Investigation Harness**: A top-level Pi Agent Core main investigator reasons about competing hypotheses and delegates bounded questions to isolated Pi sub-agents operating with strict row, call, and token budgets. Raw query traces are compressed, preserving critical findings, contradictions, and explicit negative findings.
- **Unified Timeline & Investigator Console**: A rich frontend displaying multi-resolution event density, zoomable timeline layers, numerical field inspectors, and interactive chat where every claim is backed by clickable source locators pointing to original raw bytes/lines.
- **Coverage-Aware Abstention**: When sniffer exports lack coverage for a message type or time window, the system explicitly abstains rather than falsely concluding that an event never occurred.

## User Stories

1. As an investigator, I want to upload a batch of incident source files (sniffer CSV, component TXT logs, and operator diary XLSX) along with a capture manifest, so that all evidence is indexed and made queryable without altering the immutable raw originals.
2. As an investigator, I want the system to parse and store millions of sniffer CSV rows into typed Parquet datasets, so that analytical queries scan only relevant columns and time ranges without running out of memory.
3. As an investigator, I want the system to parse heterogeneous component logs and Hebrew operator diary entries into PostgreSQL, so that I can query them by exact service, error code, or approximate time range.
4. As an investigator, I want multilingual semantic search across diary and service logs using pgvector, so that I can discover relevant operator notes even when technical wording differs.
5. As an investigator, I want to investigate a position mismatch incident (Priority 1: `case_002`) where external sensor coordinates diverge from GPS and manual references, so that the agent quantifies the jump and identifies corroborating service log warnings.
6. As an investigator, I want to investigate a missed-detection incident (Priority 2: `case_001`) where a sensor plot fails to generate a display track, so that the agent identifies the misapplied filtering threshold.
7. As an investigator, I want to investigate an operator report with delayed recording time (Priority 3: `case_003`), so that the agent handles human time uncertainty gracefully without missing relevant system anomalies.
8. As an investigator, I want the agent to recognize when a sniffer export deliberately excluded a message type (Priority 4: `case_004`), so that it abstains with an explicit missing-coverage statement rather than inventing a false negative conclusion.
9. As an investigator, I want the main investigator agent to formulate competing hypotheses and delegate bounded questions to sub-agents, so that large raw query outputs do not exhaust the main conversation context.
10. As an investigator, I want sub-agents to operate under strict budgets (max tool calls, max rows per call, max tokens), so that rogue loops are terminated safely with typed incomplete results.
11. As an investigator, I want every claim, observation, and calculation to include a verifiable evidence reference pointing to original source file rows or persisted computation IDs, so that findings are mathematically reproducible.
12. As an investigator, I want the investigation harness to preserve contradictions and negative findings alongside positive matches, so that confirmation bias is eliminated.
13. As an investigator, I want a unified timeline visualizer that displays event density across sources and highlights notable analysis windows, so that I can spot anomaly clusters visually.
14. As an investigator, I want to inspect field-level time-series comparisons (e.g. `site_gps_lat` vs `site_external_lat`) on an aligned chart, so that I can visually verify coordinate jumps.
15. As an investigator, I want to click any citation tag in the chat findings to immediately view the exact raw file line, surrounding context, and parser metadata in the UI inspector.
16. As an investigator, I want to view an ingestion health report showing total event counts, parse warnings, and capture coverage limits before beginning an investigation, so that I know what data is trustworthy.
17. As an investigator, I want the system to query DuckDB for numerical aggregations (min, max, delta/sec, gaps) rather than streaming raw rows to the LLM, so that response times remain fast.
18. As a developer, I want all investigation tools to expose typed, validated parameters without raw SQL or shell execution, so that agent execution is strictly sandboxed.
19. As a developer, I want the system knowledge catalog to supply field units and coordinate frames, so that unit mismatches are caught before numerical comparisons.
20. As an evaluation engineer, I want private ground truth to remain physically isolated from all runtime query tools, so that benchmark scores accurately reflect agent investigation capability.

## Implementation Decisions

### 1. Ingestion & Sniffer Store (Lane 1)
- Stream raw sniffer CSVs in bounded chunks to avoid memory spikes on multi-GB files.
- Normalize timestamps to ISO-8601 UTC and retain original file row indices (`sourceLocator.row`).
- Write typed Parquet files partitioned by `investigationId` and `messageType`, sorted by timestamp for row-group pruning.
- Provide DuckDB query engine bindings configured to scan Parquet files directly.
- Generate an Ingestion Manifest detailing counts, time spans, schema discovery, and parse rejections.

### 2. Text, Log & Embedding Store (Lane 2)
- Parse component TXT logs with per-producer adapters, extracting timestamps, component ID, severity, and text lines.
- Parse XLSX diary sheets, extracting reported event time, recording time, Hebrew notes, and operator identity.
- Persist entries in PostgreSQL with B-tree indices on `(investigation_id, event_time, source_system)`.
- Generate vector embeddings for diary and log entries using the local LiteLLM/Vertex embedding endpoint; store in pgvector columns with HNSW indices.
- Support hybrid search: SQL metadata filter + exact keyword match + cosine distance ranking.

### 3. Agent Investigation Harness (Lane 3)
- Instantiate the Main Investigator using `@earendil-works/pi-agent-core` with access only to `delegate_investigation` and `submit_findings`.
- Build the Delegation Controller: accepts bounded tasks (`question`, `timeWindow`, `sourceIds`, `allowedToolNames`, `budget`), spawns an isolated sub-agent Pi instance, and runs the investigative loop.
- Result Compression Gate: validates returned findings, validates evidence handles, captures contradictions and negative findings, and returns a compact `SubAgentResult` to the main context.
- Audit Trail: full sub-agent transcripts and raw tool calls are persisted to PostgreSQL for replay and UI inspection, never dumped into the main agent's prompt.

### 4. Deterministic Investigation Tools (Lane 4)
- Implement validated tool handlers exposed to sub-agents:
  - `get_case_overview`: returns source coverage, message inventory, and known limitations.
  - `describe_message_type`: returns field schemas, coordinate frames, and expected intervals from `public_system_catalog.json`.
  - `query_events`: bounded time/source/target window query returning paged summaries.
  - `search_text`: hybrid lexical and vector search across PostgreSQL logs and diary.
  - `analyze_fields`: DuckDB analytical operations (e.g. deltas, pairwise column comparisons, gap detection).
  - `get_evidence`: resolves a source locator `(sourceFileId, row/byteOffset)` or `analysisId` to display raw immutable source lines.
- Evidence Verifier: cryptographically verifies that all citations in findings reference existing source rows or persisted calculations.

### 5. UI Timeline & Investigator Console (Lane 5)
- Multi-resolution timeline component displaying stacked time-series bands for sniffer, logs, and diary.
- Density histogram showing event counts per bucket and highlighting notable anomaly windows.
- Field inspector plotting numerical fields (e.g. position coordinates) with unit-aware tooltips.
- Conversational chat interface rendering structured findings, confidence rationale, contradictions, and clickable citation badges that highlight the corresponding raw file viewer.

### Key Data Types & Schemas

```ts
interface EventEnvelope {
  investigationId: string;
  eventId: string;
  sourceFileId: string;
  sourceFamily: 'diary' | 'system_log' | 'sniffer';
  sourceSystem?: string;
  eventType?: string;
  eventTime?: string;
  eventTimeEarliest?: string;
  eventTimeLatest?: string;
  recordedTime?: string;
  originalTimestamp?: string;
  correlationIds?: Record<string, string>;
  sourceLocator: { row?: number; byteOffset?: number; recordId?: string };
  schemaVersion?: string;
  severity?: string;
  text?: string;
}

interface DelegatedInvestigationTask {
  taskId: string;
  investigationId: string;
  question: string;
  timeWindow?: { start: string; end: string };
  sourceIds?: string[];
  targetIds?: string[];
  allowedToolNames: string[];
  budget: { maxToolCalls: number; maxRowsPerCall: number; maxTokens: number };
}

interface InvestigativeFinding {
  observation: string;
  evidenceRefs: string[];
  significance: 'high' | 'medium' | 'low';
  kind: 'observation' | 'calculation' | 'absence_check' | 'hypothesis';
}

interface SubAgentResult {
  taskId: string;
  status: 'completed' | 'inconclusive' | 'budget_exhausted' | 'error';
  findings: InvestigativeFinding[];
  contradictions: InvestigativeFinding[];
  negativeFindings: InvestigativeFinding[];
  coverageLimitations: string[];
  unresolvedQuestions: string[];
  proposedNextSteps: string[];
  evidenceRefs: string[];
}
```

## Testing Decisions

- **Good Test Criteria**: Test external contracts and observable behavior (e.g. feeding raw fixture files and asserting query results, tool responses, and evidence citations). Avoid testing internal private functions.
- **Test Seam**: High-level integration seam:
  - Ingestion Seam: Upload fixture directory → assert Parquet/PostgreSQL output records and manifest counts match fixture expectations.
  - Tool Seam: Call deterministic tools with explicit parameters → assert bounded summary structure and correct statistical calculation.
  - Agent Seam: Invoke Main Investigator with an incident question against `case_002` → assert agent reaches correct external position mismatch finding, cites the exact rows in `sniffer.csv` and `external_position_adapter.txt`, and reports zero hallucinated evidence IDs.
- **Prior Art**: The radar simulator test cases in `src/radar-simulator/TRACE_v03_investigator_data/fixtures/case_002` serve as the golden benchmark fixtures.

## Out of Scope

- Live real-time streaming ingestion (batch upload only).
- Direct arbitrary SQL queries or code execution by agents.
- Classified/real radar data or external cloud SaaS APIs.
- Automatic ML causal graph discovery (causal reasoning is handled by the LLM investigator with deterministic tools).
- Modifying or writing back to uploaded immutable raw source files.

## Further Notes

- Execution priority follows the user's roadmap:
  1. `case_002` (Position Jumps)
  2. `case_001` (Missed Detection)
  3. `case_003` (Operator Mistake / Delayed Diary)
  4. `case_004` (Limited Sniffer Coverage / Abstention)
