# CTR-01: Parquet Partitioning & DuckDB Analytical Views

- **Contract ID:** `CTR-01`
- **Producing Lane:** Lane 1 (Ingestion & DuckDB, Issue #2)
- **Consuming Lanes:** Lane 4 (Tools & Evidence, Issue #4), Lane 5 (UI Console, Issue #6)
- **Status:** `AGREED`
- **Last Updated:** 2026-10-13

## 1. Parquet Storage Layout

Parquet files generated from sniffer CSVs must be stored at deterministic paths:
```
data/investigations/{investigation_id}/parquet/{message_type}.parquet
```
Example for `case_002`:
- `data/investigations/case_002/parquet/PositionReport.parquet`
- `data/investigations/case_002/parquet/SensorHealth.parquet`
- `data/investigations/case_002/parquet/DetectionCandidate.parquet`

### Partitioning & Sorting
- Partitions: by `(investigation_id, message_type)`.
- Sort Order: Within each Parquet file, records **MUST** be sorted by `timestamp_utc ASC` to enable DuckDB row-group statistics and timestamp-range pruning.

## 2. Common Envelope Columns in Parquet

Every row written to Parquet includes these standardized envelope columns:

| Column Name | DuckDB Type | Description |
|---|---|---|
| `investigation_id` | `VARCHAR` | Unique ID of incident (e.g. `'case_002'`) |
| `message_type` | `VARCHAR` | Catalog message type (e.g. `'PositionReport'`) |
| `timestamp_utc` | `TIMESTAMP` | Normalized ISO-8601 UTC timestamp |
| `source_file` | `VARCHAR` | Original file basename (e.g. `'sniffer.csv'`) |
| `source_row` | `BIGINT` | 1-indexed original CSV line number for source locator |

Message-specific columns (e.g. `site_gps_lat`, `site_external_lat`, `speed_knots`, `bearing_deg`) follow the types defined in `public_system_catalog.json` (all coordinates are `DOUBLE` in WGS84 decimal degrees).

## 3. DuckDB View Naming Convention

DuckDB connections initialized by Lane 1 / Lane 4 register views over the Parquet files:
```sql
CREATE OR REPLACE VIEW events_position_report AS 
SELECT * FROM read_parquet('data/investigations/{id}/parquet/PositionReport.parquet');
```
A unified view `events_sniffer` unions all message types with common envelope columns.

## 4. Ingestion Manifest Format (`ingestion_manifest.json`)

Written to `data/investigations/{investigation_id}/ingestion_manifest.json`:
```json
{
  "investigation_id": "case_002",
  "source_files": ["sniffer.csv"],
  "total_records": 125000,
  "time_range": {
    "start_utc": "2026-10-12T08:00:00Z",
    "end_utc": "2026-10-12T08:30:00Z"
  },
  "message_counts": {
    "PositionReport": 100000,
    "SensorHealth": 25000
  },
  "parse_errors": 0,
  "coverage_complete": true
}
```
Lane 5 UI reads this manifest for the header dashboard (Sub-task 5.1).
