# CTR-05: Evidence Reference & Source Locator Standard

- **Contract ID:** `CTR-05`
- **Producing Lane:** Lane 4 (Tools & Evidence, Issue #4) / Universal Standard
- **Consuming Lanes:** All Lanes (Lane 1 #2, Lane 2 #3, Lane 3 #5, Lane 4 #4, Lane 5 #6)
- **Status:** `AGREED`
- **Last Updated:** 2026-10-13

## 1. Source Locator Definition

A `SourceLocator` is an immutable, unambiguous pointer to raw evidence in an original source file uploaded by the investigator.

### Types of Source Locators

1. **Sniffer CSV Row Locator:**
   ```json
   {
     "source_family": "sniffer",
     "source_file": "sniffer.csv",
     "row": 1420
   }
   ```
   - `row`: 1-indexed line number in the original CSV file.

2. **Component TXT Log Line Locator:**
   ```json
   {
     "source_family": "component_log",
     "source_file": "external_position_adapter.txt",
     "line": 88
   }
   ```
   - `line`: 1-indexed line number in the raw `.txt` file.

3. **Operator Diary XLSX Locator:**
   ```json
   {
     "source_family": "operator_diary",
     "source_file": "operator_diary.xlsx",
     "sheet": "Sheet1",
     "row": 14
   }
   ```

## 2. Evidence Reference Format

An `EvidenceReference` is a string or object handle used by investigator agents, tools, and UI:

- **String Badge Representation:**
  - `[sniffer.csv:L1420]`
  - `[external_position_adapter.txt:L88]`
  - `[calc:pos_delta:case_002:81422]` (for reproducible deterministic calculations)

- **JSON Object Representation:**
  ```json
  {
    "id": "EV-001",
    "badge": "sniffer.csv:L1420",
    "locator": {
      "source_file": "sniffer.csv",
      "row": 1420
    },
    "calculation_id": null
  }
  ```

## 3. Invariant: Ground Truth Partitioning
`SourceLocator` and `EvidenceReference` may **NEVER** point to files or data inside `private_ground_truth/`. Any reference resolving to private ground truth is an immediate fatal violation of repository rules.
