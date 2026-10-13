# Lane 2: Heterogeneous Component Logs & Hebrew Diary Ingestion to PostgreSQL & pgvector Search

## Parent
Part of #1

## What to build
Parse heterogeneous component TXT logs (`external_position_adapter.txt`, `sensor.txt`, `tracking_service.txt`, `ui_gateway.txt`) and operator diary XLSX (`operator_diary.xlsx`), store into PostgreSQL with timestamps and stable source locators (line / byte offset), generate vector embeddings for diary/logs via the LiteLLM embedding endpoint, and implement hybrid SQL + exact keyword + pgvector cosine similarity search.

## Acceptance criteria
- [ ] AC-1: Parses all TXT component logs and the Hebrew XLSX diary for `case_002` into PostgreSQL preserving original text, timestamp, and line offsets.
- [ ] AC-2: Embeds diary notes and log entries using the LiteLLM embedding endpoint into pgvector columns with HNSW indexing.
- [ ] AC-3: Hybrid search finds the relevant warning entries in `external_position_adapter.txt` during the jump interval (using both keyword/code and semantic search).
- [ ] AC-4: Handles Hebrew text and approximate diary time windows gracefully without discarding uncertain timestamps.

## Sub-tasks / Implementation Plan

- [ ] **Sub-task 2.1: PostgreSQL Schema & Database Migration Setup**
  - Define relational tables: `investigations`, `source_files`, `log_records` (id, investigation_id, source_file_id, source_system, timestamp, line_number, byte_offset, severity, text, embedding vector), `diary_records` (reported_time_earliest, reported_time_latest, recorded_time, text_hebrew, operator).
  - Create B-tree indexes on `(investigation_id, timestamp, source_system)` and HNSW index on `embedding`.
  - *Verification*: Run schema migration against PostgreSQL instance; assert tables and indexes are ready.

- [ ] **Sub-task 2.2: Heterogeneous Component TXT Log Ingestion Adapters**
  - Implement parsing adapters per component format (e.g. `external_position_adapter.txt`, `sensor.txt`, `tracking_service.txt`).
  - Extract timestamps, severity levels, and log text; attach stable locator `{ sourceFileId, line, byteOffset }`.
  - Batch insert into `log_records` with error handling for malformed lines.
  - *Verification*: Ingest `fixtures/case_002/raw/external_position_adapter.txt`; assert all warning lines are stored with exact line numbers matching the file.

- [ ] **Sub-task 2.3: Hebrew XLSX Diary Ingestion Adapter**
  - Implement spreadsheet reader for `operator_diary.xlsx`.
  - Extract reported event time, actual recording time (uncertainty window), Hebrew free text, and operator identity.
  - Store records into `diary_records`, preserving Hebrew UTF-8 encoding and time bounds.
  - *Verification*: Query `diary_records` for `case_002`; assert Hebrew text is readable and timestamp ranges are correct.

- [ ] **Sub-task 2.4: LiteLLM Vector Embedding Pipeline**
  - Connect to LiteLLM / Vertex embedding proxy (`http://localhost:4000/v1` or configured proxy).
  - Batch embed text for diary entries and warning/error log entries.
  - Store embeddings in pgvector column; expose embedding job status (`pending`/`ready`/`failed`).
  - *Verification*: Generate embedding for a sample Hebrew text query and assert pgvector cosine distance calculation.

- [ ] **Sub-task 2.5: Hybrid Lexical + Exact Code + Vector Search Service**
  - Implement hybrid search API: accepts `investigationId`, `timeWindow`, `sourceFilter`, `queryText`.
  - Combines SQL metadata prefilter + exact keyword/code matching + vector cosine distance reranking.
  - Returns top-K excerpts with source locators.
  - *Verification*: Search for "position mismatch" during the `case_002` incident window; assert `external_position_adapter.txt` warnings are returned.

## Blocked by
None (can start immediately).
