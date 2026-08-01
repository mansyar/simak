<protect>
# Track Specification: Improve Vitest Coverage Performance

## Overview

**Track ID:** `vitest-coverage-performance_20260801`
**Type:** Chore (test performance / tooling)
**Dependencies:** None

### Problem Statement

The default coverage workflow, `pnpm test:coverage`, is a pre-push quality gate. It currently runs the unit test project in forked workers, a separate XLSX project in threads, and V8 coverage with text, JSON, and HTML reports. The workflow needs a measurable wall-clock performance improvement without weakening the project's test or coverage guarantees.

### Goal

Reduce the wall-clock time of `pnpm test:coverage` by at least 20% against a recorded baseline through Vitest configuration, package-script, and related documentation changes only.

## Functional Requirements

### FR-1: Baseline Measurement

- Establish and document a repeatable baseline for `pnpm test:coverage`.
- Use the same machine, repository state, Node.js version, pnpm version, and environment for before/after comparisons.
- Record enough repeated measurements to avoid relying on a single outlier.

### FR-2: Coverage Workflow Optimization

- Reduce coverage-run wall-clock time through Vitest configuration or package-script changes.
- Preserve execution of the existing unit and XLSX test projects.
- Continue excluding integration tests from the default unit/coverage workflow.

### FR-3: Coverage Contract Preservation

- Continue using the V8 coverage provider.
- Continue producing text, JSON, and HTML coverage reports.
- Preserve the current coverage include/exclude scope.
- Preserve the existing 80% lines, functions, branches, and statements thresholds.
- Do not skip, weaken, or silently exclude tests to achieve the performance target.

### FR-4: Regression Verification

- Verify that the optimized workflow passes all discovered tests.
- Verify that coverage thresholds remain satisfied.
- Verify that worker isolation and the XLSX project continue to run without crashes, unhandled errors, or flaky behavior.

### FR-5: Documentation

- Document the benchmark method, baseline, optimized result, and any relevant Vitest configuration rationale.
- Keep implementation changes limited to Vitest configuration, package scripts, and related documentation.

## Non-Functional Requirements

### NFR-1: Performance

- Achieve at least a 20% reduction in `pnpm test:coverage` wall-clock time against the recorded baseline.
- Results must be repeatable on the same environment.

### NFR-2: Compatibility and Safety

- Preserve compatibility with the repository's supported Node.js and pnpm versions.
- Preserve application runtime behavior and test assertions.
- Maintain the project's existing coverage and quality-gate expectations.

## Acceptance Criteria

- [ ] A baseline measurement for `pnpm test:coverage` is recorded using a repeatable procedure.
- [ ] The optimized workflow is at least 20% faster than the baseline.
- [ ] `pnpm test:coverage` passes with all existing tests and the current 80% thresholds.
- [ ] Text, JSON, and HTML coverage reports are still generated.
- [ ] Unit and XLSX test projects still execute; integration tests remain excluded from the default coverage command.
- [ ] No test assertions, application source behavior, or coverage thresholds are changed.
- [ ] The benchmark procedure and final measurements are documented.
- [ ] Relevant typecheck and lint checks pass for changed configuration or scripts.

## Out of Scope

- Changes to application source code or runtime behavior.
- Changes to test assertions or test semantics.
- Lowering coverage thresholds or narrowing coverage scope.
- Removing coverage reporters.
- Reworking integration-test behavior.
- Upgrading Vitest or coverage dependencies.
- Broad test-suite restructuring or splitting test files.
</protect>
