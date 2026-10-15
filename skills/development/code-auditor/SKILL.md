---
name: code-auditor
description: Review a codebase or proposed change for evidenced correctness defects, architectural risks, maintainability problems, and technical debt. Use for a scoped audit, architecture review, or prioritized remediation assessment.
license: MIT
---

# Code Auditor

Produce findings another engineer can reproduce and act on. An audit authorizes
inspection and safe checks; apply fixes only when the user also requests them.

## Inputs and outputs

Identify the repository or diff, review scope, expected behavior, and important
operational constraints. Infer these from code and project documentation when
possible. If scope is unspecified, start with entry points and changed modules,
state that boundary, and follow their direct dependencies.

Return prioritized findings with file and line, triggering conditions, observable
impact, evidence, confidence, and a concrete remediation. Also report areas
inspected, checks run, and gaps. A clean report is an acceptable outcome.

## Workflow

1. Establish the behavior being protected. Read repository instructions, package
   boundaries, public interfaces, and existing tests. Record the revision or diff
   when available. Separate documented requirements from assumptions.
2. Trace a representative operation from input through validation, state changes,
   persistence, and output. At each boundary inspect ownership, error propagation,
   cancellation, and invariants. Follow data rather than reviewing files in isolation.
3. Select probes from observed risks: retries around non-idempotent writes,
   authorization after resource lookup, partial failure across two writes,
   mutable state shared between requests, or dependency direction contrary to
   the declared package boundary. Test the relevant trigger with an existing
   harness or a small isolated reproduction.
4. For maintainability concerns, identify a concrete change made expensive or
   unsafe by the structure. Cite the duplicated rule or dependency cycle and its
   affected callers. Do not turn preferences into defects.
5. Challenge each candidate finding: check caller guards, lifecycle guarantees,
   framework behavior, and tests that might disprove it. Mark unresolved risks
   as hypotheses and specify the evidence still needed.
6. Rank confirmed findings by impact and likelihood. Combine symptoms sharing
   a root cause. Use [the reporting rubric](references/reporting.md) when assigning
   severity and writing the final report.

## Constraints

- Use read-only inspection and isolated tests. Do not run commands that mutate
  production data, perform migrations, or expose credentials as part of a review.
- Distinguish an absent test from a proven bug. Do not claim a test passed unless
  it ran, or infer an exploitable vulnerability from a dangerous-looking API alone.
- Avoid broad rewrites, dependency changes, and formatting edits during an audit.
  If a requested fix expands beyond the reviewed boundary, explain the dependency.
- Report missing access or environment requirements as coverage gaps.

## Verification criteria

Every confirmed correctness finding has a reachable trigger and an observed or
logically demonstrated consequence. Every architectural finding connects a
dependency to a specific maintenance or runtime risk. Findings include locations
and a focused verification step for the proposed fix. The report records what
was examined and what remains unverified.

## Example

Request: “Audit order creation for duplicate charges when the payment provider
times out. Do not change code.”

Trace the order endpoint through retry logic and provider calls. Check whether
the idempotency key survives retries and whether the database transaction can
roll back a completed external charge. Reproduce a timeout after provider success
using a fake provider. Report duplicate charging only if the second attempt can
create a second charge; otherwise document the guard and any remaining gap.
