# Test design guide

Follow the project's existing structure where it already answers the question.

## Choosing a level

| Risk                                                   | Usual level                                       |
| ------------------------------------------------------ | ------------------------------------------------- |
| Calculation, parsing, branching, and validation rules  | Unit                                              |
| Queries, migrations, transactions, and serialization   | Integration with a real or local database         |
| Framework wiring: routes, middleware, dependency setup | Integration through the framework test client     |
| Agreement between services or with a third-party API   | Contract tests on both sides, or recorded schemas |
| A critical user journey spanning UI, API, and storage  | End-to-end, kept few and stable                   |
| Visual layout                                          | Visual comparison, only where it pays off         |

A test should fail for one reason that a reader can identify from its name. When
lower-level tests cannot reproduce a failure that happened in production, add a
test at the level where it occurred.

## Test doubles

| Double | Use                                                                   |
| ------ | --------------------------------------------------------------------- |
| Stub   | Supplies fixed answers to calls the test does not assert on           |
| Fake   | A working lightweight implementation, such as an in-memory repository |
| Spy    | Records calls when the interaction itself is the observable contract  |
| Mock   | Preprogrammed expectations; use sparingly, since it couples to calls  |

Mock types the project does not own through a thin adapter that the project
does own, then test the adapter separately against the real dependency or a
recorded contract. Mocking a module's internals makes refactoring break tests
without any behavior change.

## Fixtures and data

- Build data with factories or builders that set only fields relevant to the test.
- Prefer function-scoped fixtures. Share expensive resources such as a database
  only with transaction rollback or per-test schemas or records.
- Use synthetic data that preserves the property under test; never copy
  production records into fixtures.
- Keep golden files small, reviewed, and regenerated deliberately.

## Flaky test causes

| Signal                                        | Likely cause                        | Fix direction                                     |
| --------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| Fails only after a specific other test        | Shared or leaked state              | Isolate the fixture or reset state                |
| Fails near midnight, month end, or in CI zone | Clock or time zone dependence       | Inject the clock and set the zone explicitly      |
| Fails under load or on slow runners           | Fixed sleeps or timeouts            | Wait for a condition with a bounded deadline      |
| Fails with different seeds                    | Unseeded randomness                 | Seed, log the seed, and assert on invariants      |
| Fails when the network is unavailable         | Real external call                  | Fake the boundary                                 |
| Fails increasingly over a long run            | Leaked handles, ports, or processes | Close resources in teardown                       |
| Fails rarely with interleaved operations      | A race in product code              | Treat it as a defect; reproduce deterministically |

Measure flakiness as failures per number of runs with the seed and order
recorded. A fix is credible when the repeated-run count is large relative to the
original failure rate.

## Coverage

Line coverage shows what ran, not what was checked. Read uncovered branches in
changed code and decide whether each represents behavior worth protecting.
Mutation testing reveals assertions that do not distinguish correct from broken
code; apply it to critical modules rather than whole repositories when it is slow.
Report coverage changes together with the behaviors they correspond to.

## End-to-end tests

Select elements by accessible role and name or stable test identifiers, not CSS
structure. Seed data through APIs or fixtures rather than through the UI. Make
each journey independent and idempotent. Capture traces, screenshots, or logs on
failure so CI failures can be diagnosed without rerunning.
