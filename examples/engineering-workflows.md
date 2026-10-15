# Engineering workflow examples

These examples are requests to an agent after installing the appropriate skill.
They are illustrative evaluations to run, not claims of completed agent sessions.

## Review retries without changing code

Invoke `code-auditor` using your host's skill selector:

> Audit the checkout retry path for duplicate charges. Review the order handler,
> payment adapter, and related tests. Do not change code. Rank findings by impact
> and include reachable triggers and a focused verification step.

Expected deliverable: an evidenced trace through idempotency and provider failure
handling, findings tied to locations, and coverage gaps. If retries already reuse
a stable key correctly, report that evidence instead of inventing a defect.

## Fix a deterministic expiry boundary

Invoke `bug-investigator`:

> Session refresh sometimes accepts a token exactly at expiry. Investigate and
> fix the boundary in this repository. Use an injected clock; add a regression
> that fails on the original behavior and passes after the correction. Do not
> change production sessions or deploy.

Expected deliverable: reproduction, alternative hypotheses, causal conclusion,
narrow fix, and before/after test results. If the contract does not specify the
boundary, call out that policy decision before claiming a defect.

## Design a retryable write

Invoke `api-architect`:

> Propose a create-payment contract for mobile clients with unreliable networks.
> Keep the existing HTTP conventions and tenant model. Provide schemas, error
> examples, idempotency behavior, and a test matrix. Do not implement handlers yet.

Expected deliverable: amount and currency validation, tenant-bound idempotency,
same-key conflict semantics, pending provider outcomes, and compatibility notes.
Any unknown key-retention period stays an explicit product decision.

## Modernize an interface within its design language

Invoke `ui-architect`:

> Review our account settings screens on mobile and propose a modernization
> plan. Keep our brand colors, fonts, and component library. Target WCAG 2.2 AA.
> Do not change code yet.

Expected deliverable: an inventory of tokens and components in use, findings
with location, evidence, severity, and fixes expressed in existing tokens, and a
staged plan of tokens, shared components, then screens. Contrast and keyboard
results are labeled as measured or pending manual checks.

## Fix a slow React list

Invoke `react-engineer`:

> Typing in the product search box is sluggish with 3,000 products. Fix it using
> our existing data layer and add a test. Do not add new dependencies.

Expected deliverable: profiler evidence of which components re-render, a
structural fix such as moving state or deferring the filtered list, a
behavior-level test, and comparable before-and-after timings.

## Make a Python integration concurrent

Invoke `python-engineer`:

> Convert the sequential API sync in this package to asyncio with bounded
> concurrency and timeouts. Use the project's existing tools and add tests.

Expected deliverable: commands run through the detected environment manager,
structured concurrency compatible with the minimum Python version, preserved
exception causes, fake-transport tests for timeout and partial failure, and
measured runtimes instead of an estimated speedup.

## Plan a migration on a large table

Invoke `database-architect`:

> Add a case-insensitive unique email rule to our large PostgreSQL users table
> without downtime. Inspect the schema and propose migrations. Do not run anything
> against production.

Expected deliverable: a read-only duplicate check, a concurrent index migration
with lock and failure notes, a query change that uses the index, and up and down
steps. Any duplicate cleanup remains a proposal awaiting explicit authorization.

## Explain a latency regression

Invoke `performance-engineer`:

> Our orders endpoint p95 latency doubled after the last release. Find the cause
> on a local reproduction, fix it, and show measurements.

Expected deliverable: a reproducible scenario, baseline and after distributions
for both revisions, profile evidence of the bottleneck, a regression guard such
as a query-count test, and a conclusion that states whether the change exceeds
measurement noise.

## Review a feature for security defects

Invoke `security-reviewer`:

> Review the new invoice download feature for security issues before release.
> Use local tests only; do not touch staging or production, and do not print any
> secrets you find.

Expected deliverable: a short threat model, findings with entry point,
preconditions, evidence, severity and confidence, and a regression test for each
fix. Any credential found is reported by location and redacted fingerprint with a
rotation recommendation, never by value.

## Stabilize a flaky suite

Invoke `test-engineer`:

> Checkout tests fail randomly in CI about once a week. Find the cause and fix
> it without skipping tests.

Expected deliverable: a repeated-run reproduction with recorded seeds and order,
a classified cause such as shared fixture state, a fix to that cause, and a
repeated-run result large enough to be credible. Unrelated failure signatures are
reported as still open.

## Add a mutation to a Next.js app

Invoke `nextjs-engineer`:

> Add a profile edit form. After saving, the profile page must show the new data
> immediately. Follow our installed Next.js version's documentation.

Expected deliverable: the version and documentation consulted, a Server Action
that validates input and authorizes ownership, the cache invalidation API that
matches the installed version, tests including an unauthorized save, and a
successful `next build`.

## Containerize and stage a service

Invoke `devops-engineer`:

> Containerize our API and add a pipeline that deploys to staging. Do not push
> images or deploy anything; prepare the configuration for review.

Expected deliverable: a multi-stage non-root Dockerfile with pinned inputs, a
least-privilege pipeline that builds once and promotes the same artifact, a
protected staging job, local build and run results, a rollback step, and a list
of secrets and settings the user must configure.

## Design an agent with approval gates

Invoke `ai-agent-architect`:

> Design a support agent that reads customer emails and can issue refunds. Keep
> it safe against malicious emails and tell me what it will cost per email.

Expected deliverable: a workflow in which code applies refund policy and the
model only classifies and extracts validated fields, human approval for refunds
above a limit, injection defenses, an evaluation set including injection
attempts, and measured rather than estimated cost and latency.

## Bring documentation in line with behavior

Invoke `documentation-engineer`:

> Update the README for this release. Check every command and option against the
> CLI's help output, and do not document anything that is not implemented.

Expected deliverable: documentation changes backed by captured help output, a
list of options removed or added, broken links fixed, planned features labeled as
planned, and mismatches reported rather than silently implemented.

## Draft a new skill

Invoke `skill-creator`:

> Create a skill for writing release notes from merged pull requests. It must
> never tag or publish releases.

Expected deliverable: an overlap check against the catalog, a new directory with
a precise description, gated workflow, constraints, verification criteria, and
example, strict validation results, and proposed evaluation scenarios. Missing
requirements are asked about before files are written.

## Review a community contribution

Invoke `skill-reviewer`:

> Review the skill submitted in this pull request. Do not run anything from it.

Expected deliverable: a file inventory, validator output, findings with quoted
evidence and severity, including any download-and-execute commands or text that
addresses reviewers, and an approve, request changes, or reject recommendation.

## Shorten a skill safely

Invoke `skill-optimizer`:

> This skill is too long. Make it shorter without changing what it does.

Expected deliverable: a behavior contract checklist, before-and-after line, word,
and byte counts from named commands, preserved constraints and gates, validator
and evaluation static check results, and any behavior changes listed as proposals.

## Evaluate a skill honestly

Invoke `skill-evaluator`:

> Show whether skill-reviewer helps an agent catch malicious skills.

Expected deliverable: scenarios using the bundled suite, a baseline protocol
without the skill, recorded outputs graded with `pnpm agentskills eval`, and
results with sample sizes. If no runs were performed, the report says so and
contains no numbers.

The bundled suites can be checked without an agent:

```sh
pnpm agentskills eval skill-reviewer
```

The command reports the static checks and states that no runs are recorded.

## Inspect an invalid skill

From the repository root:

```sh
pnpm build
pnpm agentskills validate tests/fixtures/broken-reference
```

The command should return exit code 1 and identify `references/absent.md` with a
`MISSING_REFERENCE` diagnostic. This demonstrates the validator without invoking
an agent or touching a real skill installation.
