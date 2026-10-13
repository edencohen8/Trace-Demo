# Lane 4: Deterministic Investigation Tools API Layer & Evidence Verifier

## Parent
Part of #1

## What to build
Bounded deterministic tool services exposed to the investigator agent harness: `get_case_overview`, `describe_message_type`, `query_events`, `search_text`, `analyze_fields`, and `get_evidence`. Connect `query_events`/`analyze_fields` to Lane 1 (DuckDB/Parquet) and `search_text` to Lane 2 (PostgreSQL/pgvector). Implement the cryptographic Evidence Verifier that validates all findings against actual raw source locators or persisted analysis IDs.

## Acceptance criteria
- [ ] AC-1: Implement typed interfaces for `get_case_overview` and `describe_message_type` reading `public_system_catalog.json` and the ingestion manifest.
- [ ] AC-2: Implement `analyze_fields` calling DuckDB to detect jumps, rate-of-change, and column comparisons on `case_002` PositionReports.
- [ ] AC-3: Implement `search_text` calling PostgreSQL/pgvector with time window, source filter, and limit parameters.
- [ ] AC-4: Implement `get_evidence` resolving `(sourceFileId, row)` to fetch exact raw lines from immutable files.
- [ ] AC-5: Evidence Verifier rejects any finding citation that lacks a valid, verified source locator or calculation handle.

## Sub-tasks / Implementation Plan

- [ ] **Sub-task 4.1: Public System Catalog & Case Overview Services**
  - Implement `describe_message_type(messageType)`: returns units, coordinate frames, and schemas from `public_system_catalog.json`.
  - Implement `get_case_overview(investigationId)`: returns time span, sources, event counts, and coverage limitations from Lane 1's Ingestion Manifest.
  - *Verification*: Call tool for `PositionReport` and `case_002`; assert structured JSON output with units and schema.

- [ ] **Sub-task 4.2: DuckDB Analytical Tool (`analyze_fields`)**
  - Implement `analyze_fields({ investigationId, messageType, fieldA, fieldB, operation, timeWindow })`.
  - Supported operations: `difference`, `delta_per_sec`, `min_max`, `gap_detection`.
  - Bounded output: returns statistical summary, max deviation timestamp, and `analysisId` handle (never raw row dumps).
  - *Verification*: Run `analyze_fields` comparing `site_external_lat` and `site_gps_lat` on `case_002`; assert jump is returned as a summary.

- [ ] **Sub-task 4.3: Text & Log Retrieval Tool (`search_text`)**
  - Implement `search_text({ investigationId, query, timeWindow, sourceSystem, limit })`.
  - Calls Lane 2 hybrid search service; formats results as bounded excerpts with `sourceLocator: { sourceFileId, line }`.
  - *Verification*: Search for "mismatch" during `case_002` jump window; assert max 5 entries returned with source locators.

- [ ] **Sub-task 4.4: Bounded Event Window Query Tool (`query_events`)**
  - Implement `query_events({ investigationId, timeWindow, messageTypes, limit, page })`.
  - Queries federated event envelope metadata across Parquet/PostgreSQL. Returns paged summary rows with `eventId` and `sourceLocator`.
  - *Verification*: Query events during 1-minute window of `case_002`; assert pagination and event envelope format.

- [ ] **Sub-task 4.5: Immutable Evidence Resolver & Verification Gate**
  - Implement `get_evidence(evidenceRef)`: opens immutable raw file and returns exact line/row plus 3 lines of surrounding context.
  - Implement `verify_finding(finding)`: checks that every `evidenceRef` corresponds to a real, existing source line or valid `analysisId`.
  - *Verification*: Test with valid locator → returns original text; test with hallucinated locator → returns rejection error.

## Blocked by
- Blocked by #2 (Lane 1 DuckDB/Parquet contract)
- Blocked by #3 (Lane 2 PostgreSQL/pgvector contract)
*(Can start scaffold and mock interfaces immediately)*
