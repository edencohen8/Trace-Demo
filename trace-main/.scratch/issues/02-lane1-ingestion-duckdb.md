# Lane 1: Sniffer CSV Batch Stream Ingestion to Typed Parquet & DuckDB Query Engine

## Parent
Part of #1

## What to build
Stream-parse sniffer CSV exports in bounded memory chunks, validate timestamps and fields against `public_system_catalog.json`, partition into typed Parquet datasets by message type (`PositionReport`, `SensorHealth`, etc.) preserving row locators (`sourceLocator.row`), configure DuckDB to query Parquet directly for temporal and numeric aggregations, and generate an Ingestion Manifest report.

## Acceptance criteria
- [ ] AC-1: Parses `sniffer.csv` (4.8MB) in streaming batches without memory spikes and normalizes timestamps to UTC ISO-8601.
- [ ] AC-2: Writes typed Parquet files partitioned by `investigationId` and `messageType` with timestamp sorting for row-group pruning.
- [ ] AC-3: DuckDB query layer can calculate time-series difference between `site_external_lat` and `site_gps_lat` for `case_002`, identifying the exact start/end of the position discrepancy.
- [ ] AC-4: Outputs a complete Ingestion Manifest summarizing row counts, time range, discovered schemas, and zero parse errors for valid rows.

## Sub-tasks / Implementation Plan

- [ ] **Sub-task 1.1: System Catalog & Schema Discovery Parser**
  - Load `public_system_catalog.json` and validate incoming CSV headers.
  - Implement schema detector for message types (`PositionReport`, `SensorHealth`, `DetectionCandidate`, etc.) and column data types (lat/lon floats, timestamps, strings).
  - *Verification*: Unit test validating schema detection on `fixtures/case_002/raw/sniffer.csv`.

- [ ] **Sub-task 1.2: Streaming CSV Batch Normalizer with Stable Source Locators**
  - Implement chunked streaming reader (5,000 rows/batch) to maintain low memory footprint.
  - Normalize ISO-8601 timestamps to UTC (`capture_time_utc`).
  - Attach immutable source locator `{ row: lineNumber, sourceFileId: 'sniffer.csv' }` to every record.
  - Track parse warnings, unparsed rows, and unknown fields.
  - *Verification*: Stream 4.8MB CSV with memory cap < 100MB; assert row numbers match 1:1 with source CSV line indices.

- [ ] **Sub-task 1.3: Message-Partitioned Typed Parquet Writer**
  - Partition parsed records by `(investigationId, messageType)` into typed Parquet files.
  - Sort records by timestamp within row groups to enable DuckDB row-group pruning.
  - Persist under `data/investigations/<id>/parquet/<messageType>.parquet`.
  - *Verification*: Inspect Parquet metadata using DuckDB/parquet-tools; assert row-group min/max timestamp statistics.

- [ ] **Sub-task 1.4: DuckDB Analytical Engine & Position Delta Queries**
  - Initialize DuckDB instance configured to query Parquet views directly.
  - Implement analytical queries: time window filter, numerical delta (`site_external_lat - site_gps_lat`), and gap detection.
  - *Verification*: Execute query against `case_002` Parquet; assert detection of the exact start time, duration, and magnitude of the external position jump.

- [ ] **Sub-task 1.5: Ingestion Manifest & Coverage Reporter**
  - Calculate summary metrics: total counts per message type, time span (start/end), missing catalog types (against capture manifest), and parse error count.
  - Export structured `ingestion_manifest.json`.
  - *Verification*: Assert generated manifest matches `fixtures/case_002/capture_manifest.json` expectations.

## Blocked by
None (can start immediately).
