# TRACE Demo

TRACE stands for **Timeline Reconstruction, Analysis, Correlation & Explanation**.
This repository imports the supplied lane-3 agent-harness snapshot for continued
development in cloud workspaces and with Codex locally.

## What is included

- `trace-main/`: Vue/Vite UI prototype, TypeScript agent harness, verification scripts, and project documentation.
- `trace-main/src/agent/`: provider integration, routing, validation, investigation state, and orchestration.
- `trace-main/src/skills/`: the four investigation skills.
- `trace-main/src/radar-simulator/`: fictional simulator, generated evidence fixtures, and offline evaluation material.
- `TRACE_ARCHITECTURE.md`: architecture bundled with the code snapshot.
- `docs/reference/TRACE_ARCHITECTURE-supplied.md`: the separately supplied architecture document, retained without replacing the code snapshot's version.

**Snapshot status:** the browser UI uses simulated records and prepared responses.
The interactive agent CLI is a manual test environment with scripted scenarios.
The harness includes a LiteLLM provider, but the supplied archive does not include
the newer standalone demo server or an integrated live UI/backend. Publishing this
snapshot does not add those components.

## Start the UI

Use a recent Node.js LTS release and npm, then run from the repository root:

```bash
cd trace-main
npm ci
npm run dev
```

Open the URL printed by Vite. See `trace-main/README.md` for the existing UI variants
and their interaction notes. A cloud workspace must forward the Vite port to make
the UI accessible in your browser.

## Agent checks and manual CLI

Run these commands from `trace-main/` after installing dependencies:

```bash
npm run build
npx tsc --noEmit
npm run test:agent
npm run test:skills
npm run test:router
npm run test:validator
npm run test:investigator
npm run agent:cli
```

These are the commands supplied by the snapshot; their presence is not a claim
that they have been rerun or passed during this import.

The live provider in `src/agent/provider.ts` reads these environment variables:

| Variable | Default |
| --- | --- |
| `LITELLM_URL` | `http://localhost:4000/v1` |
| `LITELLM_MASTER_KEY` | Local development placeholder from the source |
| `TRACE_MODEL_ID` | `gemini-2.5-flash` |

Set real credentials in your local shell or the cloud workspace's secret settings.
An `.env` file is ignored by Git; this snapshot does not automatically load one for
the agent scripts. A gateway running on your laptop is not reachable as `localhost`
from a separate cloud workspace.

## Simulator

The four full generated history files are included losslessly in
`trace-main/src/radar-simulator/TRACE_v03_simulator_lab.zip`. Their unpacked copies
exceed the upload interface's 16 MiB request limit, so they are kept in that archive
instead of duplicated as individual Git files. The rest of the code and evidence
fixtures are available directly in the checkout.

Before running offline simulator validation or rebuilding its reports, restore
the histories from the repository root (Python 3.10 or newer):

```bash
python -m zipfile -e trace-main/src/radar-simulator/TRACE_v03_simulator_lab.zip trace-main/src/radar-simulator/TRACE_v03_simulator_lab
```

The archive's 27 files were verified byte-for-byte against the supplied snapshot.
The extracted histories stay ignored by Git and outside investigator runtime access.

With Python 3.10 or newer, run from the repository root:

```bash
cd trace-main/src/radar-simulator/TRACE_v03_simulator_lab
python ui.py
```

The simulator opens at `http://127.0.0.1:8765`. Its README explains fixture generation
and offline evaluation. The data is fictional. Keep `private_ground_truth/`,
`internal_history/`, and simulator fault configurations outside investigator runtime
access; upload only the investigator evidence package to TRACE.

## Work between cloud and local checkouts

Use the same GitHub repository as the remote in both environments. Pull before
starting work, create a task branch, and commit/push when handing work between them.
Keep API keys, Google credentials, local state, and dependency/build folders out of Git.

The imported agent instructions and planning documents still describe the original
GitLab lane workflow. They are historical project context; no GitLab ticket is being
created or updated as part of this import.
