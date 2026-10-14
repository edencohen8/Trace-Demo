# T015I measured live QA

Provider/model: anthropic/claude-haiku-5-5.
Completed 27/29 turns. Baseline openings: 14/15.

The runtime validates source existence and reviews claim support. These are automatic signals. Read the answers and sources for the final acceptance verdict.

| Run | Turn | Runtime result | First useful (s) | Total (s) | Model calls | Tools | Citations | Words |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline-1-1 | 1 | satisfied | 21.9 | 235.0 | 22 | 22 | 31 | 104 |
| baseline-1-2 | 1 | satisfied | 16.9 | 171.2 | 21 | 25 | 34 | 109 |
| baseline-1-3 | 1 | satisfied | 20.1 | 154.3 | 17 | 21 | 30 | 127 |
| baseline-2-1 | 1 | satisfied | 16.4 | 235.6 | 26 | 31 | 28 | 134 |
| baseline-2-2 | 1 | satisfied | 17.1 | 149.2 | 16 | 23 | 28 | 135 |
| baseline-2-3 | 1 | satisfied | 18.2 | 257.8 | 26 | 37 | 32 | 122 |
| baseline-3-1 | 1 | satisfied | 13.3 | 285.4 | 27 | 28 | 29 | 130 |
| baseline-3-2 | 1 | satisfied | 16.6 | 206.4 | 22 | 25 | 30 | 132 |
| baseline-3-3 | 1 | satisfied | 21.5 | 213.7 | 22 | 37 | 30 | 134 |
| baseline-4-1 | 1 | satisfied | 8.5 | 68.5 | 5 | 5 | 9 | 110 |
| baseline-4-1 | 2 | satisfied | 24.7 | 223.4 | 20 | 28 | 29 | 124 |
| baseline-4-2 | 1 | FAILED | 8.2 | 96.8 | 11 | 10 | 0 | — |
| baseline-4-3 | 1 | satisfied | 15.7 | 46.3 | 5 | 5 | 8 | 130 |
| baseline-4-3 | 2 | satisfied | 27.2 | 169.9 | 16 | 21 | 23 | 118 |
| baseline-5-1 | 1 | satisfied | 24.5 | 209.7 | 23 | 34 | 29 | 117 |
| baseline-5-2 | 1 | satisfied | 26.2 | 263.0 | 28 | 38 | 24 | 120 |
| baseline-5-3 | 1 | satisfied | 16.6 | 425.6 | 29 | 30 | 33 | 117 |
| followup-1 | 1 | satisfied | 20.6 | 240.9 | 25 | 27 | 31 | 129 |
| followup-1 | 2 | satisfied | 12.1 | 28.3 | 4 | 5 | 5 | 61 |
| followup-1 | 3 | satisfied | 8.3 | 29.3 | 4 | 3 | 3 | 92 |
| followup-1 | 4 | satisfied | 15.4 | 50.9 | 6 | 3 | 7 | 84 |
| followup-2 | 1 | satisfied | 17.5 | 177.3 | 17 | 18 | 24 | 129 |
| followup-2 | 2 | satisfied | — | 41.4 | 5 | 3 | 4 | 81 |
| followup-2 | 3 | satisfied | 13.1 | 56.5 | 7 | 5 | 7 | 91 |
| followup-2 | 4 | satisfied | — | 67.4 | 10 | 6 | 17 | 82 |
| followup-3 | 1 | satisfied | 16.5 | 226.6 | 20 | 23 | 33 | 114 |
| followup-3 | 2 | FAILED | 34.5 | 69.8 | 7 | 12 | 0 | — |
| variant-missing-state | 1 | satisfied | 13.1 | 224.3 | 24 | 38 | 30 | 138 |
| variant-partial-detections | 1 | satisfied | 15.6 | 148.9 | 19 | 25 | 24 | 130 |

## Failures

- baseline-4-2/1: Answer validation failed: Error: Claims need correction: finding_id: none (Candidate.answer). The answer says it did not check whether req-303 was received, applied, or rejected, and whether effective SEC-7 state changed after it. trace_request is available for this request_id and no trace was run. The cancel-to-display-to-effective-state chain therefore stays unexplained, even though the cited effective records show SEC-7 enabled through 12:04:25. finding_id: none (Candidate.answer). The 15:08 local repeat-pass report (operator_diary.csv:L7, 12:08:00–12:08:10Z) is described as unchecked again
- followup-3/2: Answer validation failed: Error: The answer has no source citations
