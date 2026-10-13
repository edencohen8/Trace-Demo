# AGENTS.md — TRACE Repository Guidelines for AI Agents

Welcome to TRACE (Timeline Reconstruction, Analysis, Correlation & Explanation).

## Agent skills

### Issue tracker

GitLab issues tracked via `glab` CLI on `https://gitlab.gcp.elta.co.il/gcp_projects/hackathon/hack-team-1/hack-team-1-repo`. See `docs/agents/issue-tracker.md`.

### Triage labels

Standard Matt Pocock triage labels (`ready-for-agent`, `needs-info`, etc.) plus vertical lane labels (`lane::1` to `lane::5`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo using root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.

### Issue workflow

Work issues through `.agents/skills/issue-workflow/SKILL.md`. It directly integrates with the repository's task structure (`## Sub-tasks / Implementation Plan`), executing a full cycle of grilling, planning, implementation, and testing for each subtask before full-issue integration review and QA.

## Core Project Guidelines

1. **Architecture Truth**: Always adhere to `TRACE_ARCHITECTURE.md`.
2. **Ground Truth Isolation**: Never read, copy, or expose `private_ground_truth/` to TRACE runtime code, ingestion, or investigator agents.
3. **Deterministic Tools First**: Large data analytics run in DuckDB/Parquet; text/vector search runs in PostgreSQL/pgvector. LLMs never receive raw dumps of millions of rows.
4. **GitLab Collaboration**: Always check `glab issue view <iid> --comments` before starting a ticket, and post comments when assumptions or interfaces change.
5. **Centralized Contracts & Cross-Lane Notifications**:
   - All inter-lane schemas, tool signatures, event models, and locator formats live in [`docs/contracts/`](docs/contracts/README.md).
   - Any contract decision made during grilling, planning, or building that affects another lane **MUST** be published to `docs/contracts/` and broadcast immediately to affected lanes via `glab issue note <affected_iid> -m "📢 [CONTRACT UPDATE from Lane X] ..."`.
   - **Pre-Build Contract Sync Gate**: Before implementing core components for any subtask, agents **MUST** inspect `docs/contracts/` and their issue comments (`glab issue view <iid> --comments`) to ensure they never build against stale interface assumptions.
6. **Strict TypeScript Only (Never Plain JS)**:
   - All code, modules, tools, agent implementations, scripts, and tests across this project must be written exclusively in TypeScript (`.ts` or `.tsx`).
   - Plain JavaScript (`.js`, `.mjs`, `.jsx`) is strictly forbidden across the codebase.
   - All TypeScript files must type-check cleanly with `npx tsc --noEmit`.
   - Execute TypeScript scripts and tests using `tsx` or standard Vite/TypeScript tooling.
