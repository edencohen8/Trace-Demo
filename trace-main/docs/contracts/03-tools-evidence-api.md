# CTR-03: Deterministic Tools & Evidence Engine API

- **Contract ID:** `CTR-03`
- **Producing Lane:** Lane 4 (Tools & Evidence, Issue #4)
- **Consuming Lanes:** Lane 3 (Agent Harness, Issue #5), Lane 5 (UI Console, Issue #6)
- **Status:** `AGREED`
- **Last Updated:** 2026-10-13

## 1. Tool Signatures for Pi Agent Core

Lane 4 exposes four deterministic tools consumed by the Pi Agent Core harness (Lane 3).

### 1. `analyze_fields`
Computes numerical time-series statistics, deltas, and anomalies over DuckDB Parquet data without sending millions of rows to the LLM.
- **Parameters:**
  - `investigation_id` (str, required)
  - `message_type` (str, required, e.g. `'PositionReport'`)
  - `field_a` (str, required, e.g. `'site_external_lat'`)
  - `field_b` (str, optional, e.g. `'site_gps_lat'`)
  - `time_start_utc` (str, optional ISO-8601)
  - `time_end_utc` (str, optional ISO-8601)
  - `operation` (str, default `'delta'`, enum: `['delta', 'stats', 'gaps', 'quantiles']`)
- **Returns:**
  ```json
  {
    "investigation_id": "case_002",
    "operation": "delta",
    "field_a": "site_external_lat",
    "field_b": "site_gps_lat",
    "max_delta": 0.0542,
    "anomaly_window": {
      "start_utc": "2026-10-12T08:14:22Z",
      "end_utc": "2026-10-12T08:19:40Z",
      "duration_seconds": 318
    },
    "evidence_references": [
      {
        "type": "source_locator",
        "file": "sniffer.csv",
        "row": 1420
      }
    ]
  }
  ```

### 2. `search_text`
Hybrid keyword + vector search over PostgreSQL TXT logs and operator diary.
- **Parameters:**
  - `investigation_id` (str, required)
  - `query` (str, required)
  - `source_system` (str, optional)
  - `time_start_utc` (str, optional)
  - `time_end_utc` (str, optional)
  - `limit` (int, default 10)
- **Returns:**
  ```json
  {
    "matches": [
      {
        "source_file": "external_position_adapter.txt",
        "line": 88,
        "source_system": "external_position_adapter",
        "timestamp_utc": "2026-10-12T08:14:23Z",
        "severity": "WARN",
        "text": "Fallback to backup dead-reckoning sensor due to sync timeout",
        "evidence_ref": "ext_pos_adapter:L88"
      }
    ]
  }
  ```

### 3. `query_events`
Bounded structured event retrieval for timeline construction.
- **Parameters:**
  - `investigation_id` (str, required)
  - `time_start_utc` (str, required)
  - `time_end_utc` (str, required)
  - `limit` (int, default 100, max 500)
- **Returns:** List of normalized event envelopes.

### 4. `resolve_evidence`
Resolves an evidence reference to the exact raw immutable file lines with surrounding context. Consumed by Lane 5's Evidence Viewer Drawer.
- **Parameters:**
  - `investigation_id` (str, required)
  - `source_file` (str, required)
  - `line_or_row` (int, required)
  - `context_lines` (int, default 5)
- **Returns:**
  ```json
  {
    "source_file": "sniffer.csv",
    "target_row": 1420,
    "lines": [
      { "number": 1419, "content": "..." },
      { "number": 1420, "content": "...", "highlight": true },
      { "number": 1421, "content": "..." }
    ]
  }
  ```
