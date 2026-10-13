# TRACE Domain Model

TRACE (Timeline Reconstruction, Analysis, Correlation & Explanation) is a retrospective, evidence-driven incident investigation system for multi-sensor radar networks.

## Evidence & Sources

**Source Family**:
One of exactly three recognized input formats: sniffer CSV, component TXT logs, or human operator diary XLSX.
_Avoid_: log type, data stream, input format

**Sniffer Export**:
A CSV export of typed radar and bus messages, deliberately filtered by the investigator (not a full capture).
_Avoid_: full bus dump, raw pcap, telemetry stream

**Capture Manifest**:
Metadata declaring which message types, fields, targets, and time spans were included in an export, and whether recorder drops occurred.
_Avoid_: header info, schema summary

**Event Envelope**:
The unified logical metadata envelope common to all events across storage backends (including investigation ID, event ID, source locator, timestamp, and severity).
_Avoid_: normalized record, database row

**Source Locator**:
A stable pointer to the exact immutable byte offset, row number, or line number in the original uploaded source file.
_Avoid_: row index, file pointer

**Evidence Reference**:
A verifiable handle pointing either to a source locator or to a persisted, reproducible deterministic calculation.
_Avoid_: citation link, footnote

**Private Ground Truth**:
Hidden simulation data containing injected faults and causal answers, strictly partitioned away from TRACE ingestion and investigator agents.
_Avoid_: secret config, evaluation metadata

## Investigation & Agent Harness

**Main Investigator**:
The top-level Pi Agent Core instance that reasons over hypotheses, delegates bounded tasks, and synthesizes findings without direct database access.
_Avoid_: supervisor agent, root bot, orchestrator

**Bounded Sub-Agent**:
An isolated Pi Agent Core instance spawned to answer a single specific investigative question within a strict time, source, and tool budget.
_Avoid_: worker bot, query runner, slave agent

**Finding**:
A structured, evidence-backed observation or computation returned by a sub-agent to the main investigator.
_Avoid_: conclusion, log observation

**Contradiction**:
A verified piece of evidence that directly conflicts with a candidate hypothesis.
_Avoid_: error, bug, conflict

**Negative Finding**:
A verified observation that an expected event did not occur, valid only when capture coverage for that message type and window is confirmed complete.
_Avoid_: missing log, null result

**Abstention**:
The deliberate decision by the investigator to declare the root cause inconclusive due to missing coverage or ambiguous evidence.
_Avoid_: failure, timeout, unhandled case

## Storage & Analysis

**Sniffer Store**:
The analytical storage layer pairing typed Parquet datasets partitioned by message type with DuckDB for high-throughput temporal and numeric aggregations.
_Avoid_: data warehouse, time-series DB

**Text Store**:
The relational and semantic storage layer using PostgreSQL and pgvector for component logs, diary entries, case metadata, and vector similarity search.
_Avoid_: vector database, document store

**Deterministic Tools**:
Server-side TypeScript/SQL query services exposing bounded summaries and statistical aggregations to agents, preventing direct SQL or file access.
_Avoid_: LLM tools, agent code executor
