<protect>
# Implementation Plan: Improve Vitest Coverage Performance

> **Spec:** `./spec.md`
> **Workflow:** `../../workflow.md` — Standard Task Workflow + Phase Completion Verification & Checkpointing Protocol

> **TDD/verification note:** This track changes test tooling configuration and scripts, not application logic. The red/green safety boundary will be established through baseline behavioral checks, coverage-contract checks, and benchmark comparisons rather than artificial unit tests for configuration object literals.

## Phase 1: Baseline and Performance Guardrails

- [ ] Task: Re-read `./spec.md` and `../../workflow.md` to re-establish track context
  - [ ] Confirm the 20% wall-clock target and preserved coverage contract
  - [ ] Confirm the allowed file scope: Vitest configuration, package scripts, and related documentation

- [ ] Task: Capture the current coverage baseline before implementation
  - [ ] Record Node.js, pnpm, Vitest, repository revision, and relevant environment details
  - [ ] Run `pnpm test:coverage` repeatedly using the same environment
  - [ ] Record wall-clock measurements, pass/fail status, coverage percentages, and generated report types

- [ ] Task: Establish behavioral guardrails for the existing workflow
  - [ ] Confirm the default command executes unit tests and the XLSX project
  - [ ] Confirm integration tests remain excluded from the default coverage run
  - [ ] Confirm V8 coverage, text/JSON/HTML reports, include/exclude scope, and all four 80% thresholds

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

## Phase 2: Diagnose and Implement the Minimal Optimization

- [ ] Task: Analyze the current coverage-run bottleneck
  - [ ] Compare test-only and coverage-run timings to separate test execution from instrumentation/reporting overhead
  - [ ] Measure relevant worker/project configuration candidates one variable at a time
  - [ ] Select the simplest candidate that can plausibly meet the target without weakening coverage guarantees

- [ ] Task: Write and execute pre-change regression checks
  - [ ] Define the exact commands and observable outcomes that must remain valid
  - [ ] Confirm the baseline checks pass before modifying configuration or scripts
  - [ ] Preserve a before-change reference for project discovery, report generation, and threshold enforcement

- [ ] Task: Implement the selected Vitest configuration or package-script optimization
  - [ ] Limit changes to the approved configuration/script scope
  - [ ] Preserve all existing tests, projects, coverage reporters, scope, and thresholds
  - [ ] Remove temporary diagnostic settings and keep comments aligned with the final behavior

- [ ] Task: Run the green-phase verification
  - [ ] Run `pnpm test` and confirm all default tests pass
  - [ ] Run `pnpm test:coverage` and confirm all coverage thresholds and reports remain valid
  - [ ] Confirm no worker crashes, unhandled errors, or missing XLSX tests occur

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)

## Phase 3: Benchmark Confirmation, Documentation, and Final Quality Gates

- [ ] Task: Repeat the controlled performance benchmark
  - [ ] Run the same repeated measurement procedure used for the baseline
  - [ ] Compare median or otherwise consistently selected wall-clock measurements
  - [ ] Confirm at least a 20% reduction; if not met, return to Phase 2 for another evidence-based candidate

- [ ] Task: Verify coverage and test-scope invariants
  - [ ] Confirm text, JSON, and HTML reports are generated
  - [ ] Confirm the existing include/exclude scope and 80% thresholds are unchanged
  - [ ] Confirm integration tests remain opt-in through `pnpm test:integration`

- [ ] Task: Run repository quality gates
  - [ ] Run `pnpm typecheck`
  - [ ] Run `pnpm lint`
  - [ ] Run `pnpm test:integration` when the required integration environment is available
  - [ ] Confirm changed files comply with the repository's modularity and formatting rules

- [ ] Task: Document the final result
  - [ ] Record the benchmark procedure, baseline, optimized measurements, and percentage improvement
  - [ ] Document the final configuration rationale and any operational trade-offs
  - [ ] Update repository testing documentation only if command or configuration behavior changed

- [ ] Task: Phase Verification & Checkpoint (Refer to `workflow.md`)
</protect>
