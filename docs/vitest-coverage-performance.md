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

The optimized measurements will be added below after the configuration change
and the same procedure has been repeated.
