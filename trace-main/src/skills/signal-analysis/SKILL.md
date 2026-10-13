---
name: signal-analysis
description: "Discover typed fields and coordinate units, align time series, and compute deterministic numerical comparisons, statistics, and anomaly checks using DuckDB."
---

# Signal Analysis Skill

## Purpose
Perform deterministic numerical calculations and statistical comparisons across telemetry series:
- Time-series alignment and delta calculations (e.g. `site_external_lat` vs `site_gps_lat`).
- Jump detection, sampling rate validation, and gap identification.
- Quantile, mean, and standard deviation calculations over Parquet fixtures in DuckDB.
- Generates reproducible calculation handles (e.g. `[calc:pos_delta:case_002:81422]`).

## Prohibited Behaviors
- DO NOT compare incompatible coordinate frames without noting the difference (e.g. local synthetic $x/y$ in km vs WGS84 lat/lon degrees).
- DO NOT stream millions of rows to the LLM; calculations run in the analytics engine.
- DO NOT jump directly to a root-cause assertion without user request; focus on quantitative facts and mathematical anomalies.

## Allowed Tools
- `analyze_fields`: Run deterministic DuckDB statistical calculations, jumps, and delta sweeps.
- `get_evidence`: Resolve exact source rows corresponding to max delta / anomaly peaks.
- `get_case_overview`: Discover field names, coordinate references, and sampling rates.

## Output Contract
- Analyzed fields and units
- Measured metrics (max delta, anomaly window, jump magnitude)
- Anomaly window $[T_{start}, T_{end}]$
- Evidence locator badge of peak delta (`[sniffer.csv:L1420]`) and calculation handle (`[calc:...]`)
