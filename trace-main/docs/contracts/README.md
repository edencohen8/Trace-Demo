# TRACE Central Contract Registry

Authoritative repository of inter-lane contracts, schemas, API specifications, and data formats for TRACE concurrent multi-agent development.

## Vertical Lane & Issue Matrix

| Lane | Issue | Domain / Responsibility | Produces Contracts | Consumes Contracts |
|---|---|---|---|---|
| **Lane 1** | [#2](https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo/-/work_items/2) | Sniffer CSV Batch Stream Ingestion to Typed Parquet & DuckDB Query Engine | `CTR-01` (Parquet/DuckDB) | `CTR-05` (Source Locators) |
| **Lane 2** | [#3](https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo/-/work_items/3) | Heterogeneous Component Logs & Hebrew Diary Ingestion to PostgreSQL & pgvector | `CTR-02` (Postgres/pgvector) | `CTR-05` (Source Locators) |
| **Lane 3** | [#5](https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo/-/work_items/5) | Pi Agent Core Investigator, Sub-Agent Delegation & Hypothesis Harness | `CTR-04` (Findings/State) | `CTR-02`, `CTR-03`, `CTR-05` |
| **Lane 4** | [#4](https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo/-/work_items/4) | Deterministic Investigation Tools, Evidence Reference Engine & Ground-Truth Sandboxing | `CTR-03` (Tools API), `CTR-05` (Locators) | `CTR-01`, `CTR-02` |
| **Lane 5** | [#6](https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo/-/work_items/6) | Unified Timeline, Field Inspector & Investigator Chat Console UI | UI Console Client | `CTR-01`, `CTR-03`, `CTR-04`, `CTR-05` |

---

## Central Contract Index

| Contract ID | Contract Name | Spec File | Producing Lane | Consuming Lanes | Status |
|---|---|---|---|---|---|
| **CTR-01** | Parquet Partitioning & DuckDB Analytical Views | [`01-parquet-duckdb.md`](01-parquet-duckdb.md) | Lane 1 (#2) | Lane 4 (#4), Lane 5 (#6) | `AGREED` |
| **CTR-02** | PostgreSQL Event Store & Hybrid Search Interface | [`02-postgres-text.md`](02-postgres-text.md) | Lane 2 (#3) | Lane 4 (#4), Lane 3 (#5) | `AGREED` |
| **CTR-03** | Deterministic Tools & Evidence Engine API | [`03-tools-evidence-api.md`](03-tools-evidence-api.md) | Lane 4 (#4) | Lane 3 (#5), Lane 5 (#6) | `AGREED` |
| **CTR-04** | Investigator Findings, Contradictions & Session State | [`04-agent-findings-state.md`](04-agent-findings-state.md) | Lane 3 (#5) | Lane 5 (#6) | `AGREED` |
| **CTR-05** | Evidence Reference & Source Locator Standard | [`05-evidence-locator.md`](05-evidence-locator.md) | Lane 4 (#4) / Universal | All Lanes (#2, #3, #4, #5, #6) | `AGREED` |

---

## Contract Lifecycle & Statuses

- **`PROPOSED`**: Contract is under active grilling or planning; open to feedback from consuming lanes.
- **`AGREED`**: Interface boundaries, schemas, and types are settled and ready for implementation.
- **`MODIFIED`**: Contract was updated due to implementation discovery or requirement refinement. Broadcast notice sent.
- **`DEPRECATED`**: Interface has been superseded by a newer contract ID.

---

## Cross-Lane Notification Protocol (GitLab Issue Notes)

Whenever an agent makes, modifies, or refines a contract decision in its lane that affects other lanes:
1. **Commit / Update the contract document** under `docs/contracts/<id>-<name>.md` and update this registry table.
2. **Immediately broadcast a notification note to every affected lane's GitLab issue**:
   ```bash
   glab issue note <affected_iid> -m "📢 [CONTRACT UPDATE from Lane <X> (#<source_iid>)] <Contract Title>

   • Contract Spec: docs/contracts/<file>.md
   • Status: [PROPOSED | AGREED | MODIFIED | BREAKING]
   • Affected Lanes: Lane Y (#<iid_y>), Lane Z (#<iid_z>)
   • Decision / Changes:
     <Concise summary of schemas, field names, parameter signatures, or units>
   • Action Required for Lane Y:
     <Specific guidance for the consuming agent>
   "
   ```
3. **Record the update** on the producing lane's own issue and in its local `.scratch/workflows/<slug>/work.md`.

---

## Pre-Build Contract Sync Gate ("Look Before You Build")

Before implementing core components for any subtask:
1. **Fetch Issue Comments**: Run `glab issue view <iid> --comments` to check for any fresh `📢 [CONTRACT UPDATE]` notifications from upstream lanes.
2. **Verify Against Contract Spec**: Review the relevant contract spec in `docs/contracts/` to ensure full alignment on field names, data types, units, and signatures.
3. **Never Build on Stale Assumptions**: If a contract changed upstream, reconcile with the new contract before writing core code.
