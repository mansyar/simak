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

No optimized measurement is recorded because no configuration or script change
met the target while preserving the coverage contract.

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
flags as the minimal optimization candidate. Additional coverage
processing-concurrency runs also failed to reach the target: one run at `1`
took 102.59 s, while three runs at `4` took 101.07 s, 114.45 s, and 112.57 s
(112.57 s median). Combining `--no-isolate` with processing concurrency `4`
and four or eight workers took 115.97 s and 108.79 s respectively, and did not
provide a qualifying result.

## Rejected Environment Specialization

The next candidate changed the default environment to `node`, moved the
component, hook, i18n, and route tests into a dedicated `happy-dom` project, and
explicitly retained `happy-dom` for the XLSX project. The complete non-coverage
suite passed after the project split, but the controlled full-suite result was
135.47 s for 388 files and 3,953 tests. That is slower than the 113.35 s baseline
median, so the uncommitted configuration change was reverted. The existing
global `happy-dom` configuration remains the verified behavior.

No tested worker, pool, reporter, isolation, or environment configuration has
achieved the required 20% reduction. The 98.70 s test-only reference is also
above the 90.68 s maximum implied by the target, even before preserving coverage
processing and reports.

## Rejected Combined DOM/XLSX Project

An additional configuration experiment changed the root environment to `node`
and combined the DOM and XLSX files into one `threads` project. Representative
DOM/XLSX discovery passed, and the complete non-coverage suite took 93.56 s.
The full coverage run took 101.996 s; processing-concurrency and all-threads
variants remained between 99.94 s and 103.34 s. The candidate improved on the
baseline median but did not reach the 90.68 s target and changed the existing
unit/XLSX project contract, so it was reverted.

Disabling isolation for the unit project was also rejected: the suite produced
20 failed files and 94 failed tests from shared mock/state contamination. Native
module-runner mode was rejected after a representative unit test could not
resolve the existing `@/server` alias. The final working tree therefore retains
the original configuration and package scripts; no dependency or test-suite
changes were made.

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

## Final Green Verification

After reverting every non-qualifying experiment, the unchanged configuration
passed `pnpm test` and `pnpm test:coverage` with the controlled process-local
environment. The coverage command exited 0 after 111.943 s, with 388 files and
3,953 tests passing and coverage at 88.04% statements, 81.08% branches, 83.56%
functions, and 88.68% lines. Text, JSON, and HTML reports were generated again.
