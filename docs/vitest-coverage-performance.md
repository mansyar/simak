# Vitest Coverage Performance

This document records the controlled benchmarks for `pnpm test:coverage`. The
coverage contract is unchanged throughout the track: V8 coverage, text/JSON/HTML
reports, the existing `src` include/exclude scope, and 80% lines/functions/
branches/statements thresholds.

## Benchmark Procedure

1. Use the same repository revision, machine, Node.js version, pnpm version, and
   ephemeral test environment for every comparison.
2. Set `CI=true` and provide the required environment variables with local
   placeholder values. Do not commit or persist those values in an `.env` file.
3. Start a PowerShell `Stopwatch`, run `pnpm test:coverage`, stop the timer after
   the command exits, and record the exit code.
4. Run the command three times sequentially and compare the median wall-clock
   time. Record test counts, coverage percentages, and report artifacts for each
   valid benchmark set.

## Baseline

Recorded before any Vitest configuration or package-script optimization:

| Detail | Value |
| --- | --- |
| Revision | `333865f7` |
| Node.js | `v24.16.0` |
| pnpm | `10.34.5` |
| Vitest | `4.1.6` |
| Command | `CI=true pnpm test:coverage` |
| Test result | 388 files passed; 3,953 tests passed |
| Coverage | 88.68% lines; 83.56% functions; 81.08% branches; 88.04% statements |
| Wall-clock runs | 126.65 s; 113.35 s; 96.14 s |
| Median wall-clock | **113.35 s** |

The baseline produced the text report in the command output, JSON at
`coverage/coverage-final.json`, and HTML at `coverage/index.html`. Integration
tests remained excluded from the default command, while the unit and XLSX
projects both executed.

The baseline guardrail checks also confirmed that the unit project excludes
`tests/integration/**`, the XLSX project contains the four existing XLSX test
files and uses threads, and the configuration still declares the V8 provider,
all three report formats, the existing source scope, and all four 80% thresholds.

The optimized measurements will be added below after the configuration change
and the same procedure has been repeated.

## Bottleneck Analysis

The pre-change comparison separated test execution from coverage processing and
tested one configuration variable at a time. The machine exposed 20 logical
processors; all successful coverage candidates passed 388 files and 3,953 tests
with unchanged coverage percentages.

| Candidate | Wall-clock | Result |
| --- | ---: | --- |
| `pnpm test` (no coverage) | 98.70 s | Passed; establishes the test-only reference |
| Coverage, `maxWorkers=8` | 119.66 s | Passed; slower than baseline median |
| Coverage, `maxWorkers=10` | 132.16 s | Passed; slower than baseline median |
| Coverage, `maxWorkers=16` | 127.42 s | Passed; slower than baseline median |
| Coverage, `maxWorkers=20` | 122.57 s | Passed; slower than baseline median |
| Coverage, `pool=threads` | 122.65 s | Passed; slower than baseline median |
| Coverage, `pool=vmThreads` | 123.82 s | Passed; slower than baseline median |
| Coverage, `--no-isolate` | 116.57 s | Passed; slower than baseline median |

The `--no-isolate --maxWorkers=20` combination was rejected because it caused
eight existing tests to fail or time out. The XLSX project completed in 7.75 s
when run alone, so it is not the dominant wall-clock bottleneck. Replacing the
configured reporters with JSON only also remained slower and would violate the
preserved report contract. These results rule out worker-pool and reporter
flags as the minimal optimization candidate; the next candidate targets
unnecessary `happy-dom` setup for non-DOM unit tests while retaining it for
component, hook, route, and XLSX tests.

## Pre-change Regression Reference

Before changing the configuration, the following checks were run with the same
process-local placeholder environment:

- `pnpm test` exited 0 with 388 files and 3,953 tests passing; Stopwatch elapsed
  98.70 s.
- `pnpm test:coverage` exited 0 with 388 files and 3,953 tests passing; V8
  coverage remained above every 80% threshold and text/JSON/HTML reports were
  generated.
- Vitest project discovery reported the normal unit project plus exactly the
  four existing XLSX files in the XLSX project; integration files were absent
  from the default unit project.
- A configuration assertion confirmed the V8 provider, all three reporters,
  the existing include/exclude scope, all four thresholds, and the project
  pool assignments.
