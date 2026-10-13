# TRACE Simulator Lab — v0.3

This is a **fictional radar and sensor data generator** for TRACE. It creates normal activity with a short incident. It uses a fixed seed, so you can recreate the same data. It is not a real radar interface or a physical radar model.

## Start the browser UI

Requirements: Python 3.10 or newer. The web server and generator use only the Python standard library. To create Excel diaries, install `artifact_tool` in the same Python environment. If it is not available, the generator still exports the diary as CSV.

On Windows, open **PowerShell** or **cmd** in this folder:

```powershell
py ui.py
```

Open `http://127.0.0.1:8765` in your browser. If `py` is not available, use `python ui.py`.

The interface lets you select a scenario, change its time and main numeric settings, set a seed, choose message types to exclude, and generate a new case. It shows record counts, a traffic chart, and examples of the raw data. Click **Download ZIP** to get the files for TRACE. The UI does **not** put the answer key in that ZIP.

The web server listens on `127.0.0.1` only. It does not need internet access. It is suitable for a local demo, not for public hosting.

## What the folders mean

```text
config/
  system.json                  # Normal system behavior (scan rate, moving targets, noise, clock)
  scenarios/*.json            # Individual incident settings (private generator inputs)
web/index.html                # Local browser interface
ui.py                         # Runs the interface and creates ZIP exports
generate.py                   # Creates the simulator history and raw evidence
export_diaries.py             # Adds an Excel diary (optional dependency)
build_reports.py              # Builds the PRIVATE answer key and benchmark report
validate.py                   # Tests consistency of the default generated cases
public_system_catalog.json   # Public definitions of simulated message types
fixtures/case_001/
  raw/                         # Sniffer CSV, component TXT, and operator diary
  capture_manifest.json        # Describes which data is in the capture
  README.md                    # Neutral file guide with no incident answer
private_ground_truth/case_001/
  SCENARIO.md                  # PRIVATE: failure, clues, evidence, conclusion, benchmark
  ground_truth.json            # PRIVATE: machine-readable answer and checks
internal_history/case_001.jsonl # PRIVATE: every bus message before export filtering
runs/latest/                  # New local cases created through the UI (not shared)
```

**Fixture** means a repeatable set of test files. In this project, the fixture contains **raw simulated evidence**, not clean TRACE output. TRACE should parse and normalize those files itself.

**Capture manifest** is a list of what was exported. It records clocks, time span, message types, fields, counts, missing types, and file hashes. It is not an event history and is not the answer key.

**Internal history** is the complete simulated bus data, before filtering. It lets the evaluation team check what was generated and what the sniffer export left out. Do not upload it to TRACE.

**Private ground truth** tells us what really happened in the simulation. Each case has a `SCENARIO.md` and `ground_truth.json`. Keep both outside the investigation data and the LLM agent's tools.

## The downloadable packages

- `TRACE_v03_investigator_data.zip` contains the **four ready-to-upload test cases** and a public message catalog. It has no answer keys. Each case contains one Excel diary, not both Excel and CSV.
- `TRACE_v03_simulator_lab.zip` contains **source code, the web UI, configurable cases, private evaluation reports, and internal bus histories**. It does not contain copies of the finished raw fixtures. Run the simulator to create them.

The simulator code must be kept separate from the investigator's runtime permissions. The scenario JSON contains the injected fault; do not upload it to TRACE as evidence.

## Generate from the command line

```powershell
py generate.py
py export_diaries.py
py build_reports.py
py validate.py
```

To generate just one scenario:

```powershell
py generate.py --scenario config/scenarios/missed_detection.json
py export_diaries.py
py build_reports.py
```

`generate.py` uses only the standard library. For a CSV-only run, skip `export_diaries.py`. Do not upload both diary formats for the same case.

The normal outputs use the local time `2026-10-08T13:15:00+03:00` to `2026-10-08T14:45:00+03:00`. The sniffer uses UTC, so its times appear three hours earlier. The capture manifest records both.

## The four default cases

| Case | Purpose | Private report |
|---|---|---|
| `case_001` | Missing confirmed track | `private_ground_truth/case_001/SCENARIO.md` |
| `case_002` | External position mismatch | `private_ground_truth/case_002/SCENARIO.md` |
| `case_003` | Delayed notification | `private_ground_truth/case_003/SCENARIO.md` |
| `case_004` | Limited sniffer coverage | `private_ground_truth/case_004/SCENARIO.md` |

The `SCENARIO.md` files describe the case, the log sources, the injected fault, example evidence, the expected conclusion, and a checklist for benchmarking. They are written for the evaluation team, **not** the investigator.

Case 004 has the same complete bus history as case 001, but its sniffer export removes selected message types. This tests whether TRACE avoids claiming that a message never happened when the export is incomplete.

## A fair benchmark

1. Give TRACE only a case's raw files, its manifest and the public catalog.
2. Ask the investigation question without naming the known failure.
3. Save TRACE's answer and cited source rows or lines.
4. Compare the answer with that case's private `SCENARIO.md` checklist.
5. Check each citation against the raw files. In the incomplete-export case, reward correct uncertainty.

The benchmark is **not yet an automatic judge of free-text answers**. The JSON gives test conditions and example evidence, but a human or a later scoring tool must evaluate the investigator's actual claims. The reports are specific to the fictional simulator and do not claim radar-system certification.
