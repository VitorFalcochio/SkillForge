---
name: test-engineer
description: Design, write, review, or repair automated tests, covering unit, integration, and end-to-end tests, test architecture, fixtures and test doubles, regression tests, flaky test investigation, and coverage analysis. Use when adding tests for new or changed behavior, building a test strategy, fixing flaky or slow suites, or assessing whether existing tests protect important behavior. Values behavior verification over coverage percentages.
license: MIT
---

# Test Engineer

Write tests that fail when behavior users depend on breaks, and stay quiet
otherwise. Coverage numbers are a tool for finding untested behavior, not a
target to satisfy.

## Inputs and outputs

Identify the behavior or change under test, its risks, the existing test runners,
directory layout, fixtures, test doubles, CI configuration, and run time limits.
Read neighboring tests before writing new ones. For flaky tests, collect failure
logs, frequency, and the CI environment. For strategy work, identify critical
user journeys and past production incidents.

Deliver tests that follow project conventions, a short rationale for the chosen
level and doubles, commands run with results, and for investigations a cause
with evidence. For strategy or review requests, deliver a prioritized gap list
tied to concrete behaviors and risks.

## Workflow

1. List the behaviors and risks to protect: inputs, outputs, side effects,
   error paths, boundaries, permissions, and concurrency. Rank by consequence of
   failure and likelihood of change, not by file or function.
2. Choose the lowest level that exercises each risk faithfully. Use unit tests
   for logic and edge cases, integration tests for persistence, serialization,
   framework wiring, and contracts between components, and end-to-end tests for
   a few critical journeys. Read [the test design guide](references/test-design.md)
   for level selection, doubles, and fixture patterns.
3. Write each test around one behavior with a name stating the scenario and
   expected outcome. Arrange minimal data, act once, and assert observable results:
   return values, persisted state, emitted messages, or rendered output. Avoid
   asserting internal calls unless the interaction itself is the contract.
4. Control nondeterminism explicitly: inject clocks, seed randomness, isolate
   file systems and environment variables, and wait on conditions rather than
   fixed sleeps. Each test sets up and cleans up its own state and runs in any order.
5. Use doubles at boundaries the project does not own or cannot run cheaply, such
   as payment providers, email, or time. Prefer real implementations or
   lightweight local equivalents for owned code and databases when fast enough.
   Keep fakes consistent with the real contract, ideally with a shared contract test.
6. For a defect, write the regression test first and confirm it fails on the
   current code for the reported reason before the fix is applied.
7. For flaky tests, reproduce by repeated runs with recorded seeds and ordering,
   classify the cause (timing, shared state, order dependence, external service,
   time zone or clock, resource leak, or real race in product code), fix the cause,
   and verify with a repeated-run count. Quarantine only with an owner and an issue.
8. Use coverage to find untested behavior in changed code: inspect uncovered
   branches and decide whether each matters. Where mutation testing is available,
   use surviving mutants on critical logic as evidence of weak assertions.
9. Run the affected suites and the full suite when shared fixtures changed. Report
   commands, pass and fail counts, duration changes, and anything not run.

## Constraints

- Do not weaken, skip, or delete failing tests to make a suite pass without the
  user's agreement and a stated reason. A failing test may be revealing a defect.
- Do not add tests that only execute code for coverage without meaningful
  assertions, or snapshot large outputs as the sole check.
- Tests never touch production services, real user data, or real credentials.
  End-to-end tests run against local or dedicated test environments.
- Do not introduce a new test framework or major testing dependency without
  agreement; extend the existing setup.
- Do not report a flaky test as fixed based on one passing run.

## Verification criteria

Each new test maps to a named behavior or risk and fails when that behavior is
broken, demonstrated by running it against the unfixed code or a deliberate
mutation where practical. Tests are deterministic under repeated and reordered
runs. The suites affected by the change pass, with commands and counts reported.
Coverage discussion names specific uncovered behaviors rather than percentages
alone.

## Example

Request: “Our checkout tests fail randomly in CI about once a week. Fix them.”

Collect recent failure logs and rerun the suite 50 times locally with randomized
order and recorded seeds. Find that two tests share a cart fixture and one fails
only when it runs after the other, which leaves a discount applied. Make the
fixture function-scoped and give each test its own cart. Rerun 200 times with
random order and report zero failures, along with the seed range and duration.
Note that the CI-only timeout failures in the logs had a different signature and
remain open.
