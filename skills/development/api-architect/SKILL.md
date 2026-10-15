---
name: api-architect
description: Design or review API contracts, including request validation, error semantics, authorization boundaries, idempotency, and compatible evolution. Use for a new endpoint, public interface proposal, or an API contract redesign.
license: MIT
---

# API Architect

Create a contract that clients can implement and the service can verify. Fit the
existing transport and conventions unless the requested change requires otherwise.

## Inputs and outputs

Identify client operations, domain invariants, existing contracts, identity and
tenant model, consistency needs, and compatibility constraints. Inspect the
repository for answers before asking. Mark unresolved product decisions rather
than embedding invented business rules in schemas.

Deliver a contract in the repository's established format, representative request
and response examples, an authorization and failure matrix, and a verification
plan. For a breaking change, include a client migration path. Implement handlers
only if requested.

## Workflow

1. Model client intents and state transitions. For each operation, define who
   may act on which resource, which state must already hold, and the success
   invariant. Prefer domain operations over exposing storage tables by default.
2. Define request and response schemas together. Specify required versus omitted
   versus null fields, unknown-field handling, size limits, numeric bounds, date
   formats, and stable identifiers. Validate at trust boundaries; do not expose
   internal fields just because a database serializer includes them.
3. Describe authorization per operation and per field, including resource lookup,
   tenant scoping, and information disclosure. Explicitly decide whether forbidden
   and nonexistent resources produce distinguishable responses.
4. Define a stable error envelope with machine-readable codes, safe human detail,
   field errors when useful, and a correlation identifier. Map domain failures to
   transport semantics and say which failures clients may retry. Exclude stack
   traces, SQL errors, and secrets from the public response.
5. Specify repeated and concurrent requests: idempotency key scope and retention,
   conflicting reuse, optimistic concurrency, pagination order, and partial failure
   recovery where applicable. Read [the contract decision guide](references/contract-decisions.md)
   for operations involving retries, collections, or contract evolution.
6. Compare the proposal with existing clients. Classify field additions, enum
   growth, validation tightening, and changed defaults by actual client behavior.
   Use the existing versioning approach; introduce a new version only when the
   compatibility analysis calls for it.
7. Verify representative successful, invalid, unauthorized, duplicate, conflicting,
   and boundary requests against the contract. If implementation is requested,
   check responses as well as inputs and include handler integration tests.

## Constraints

- Preserve the user's chosen stack and service boundary. Avoid introducing a new
  service, database, gateway, or authentication provider merely to express a contract.
- Do not label an API secure based on schema validation alone. Authorization,
  resource ownership, rate and resource limits, and sensitive output need separate checks.
- Do not promise exactly-once effects across independent systems without a concrete
  protocol and failure analysis. Describe the actual retry and reconciliation behavior.
- Separate proposed examples from executed checks. State unresolved policy choices.

## Verification criteria

Each operation defines inputs, outputs, identity and ownership rules, error cases,
and the relevant retry semantics. Examples conform to schemas. Every domain
invariant maps to a concrete check. Existing consumers have a documented
compatibility assessment; untested assumptions remain visible.

## Example

Request: “Design a create-payment endpoint that mobile clients can safely retry.”

Define integer minor-unit amounts and supported currency validation. Scope the
idempotency key to the authenticated tenant and operation. Describe same-key,
same-body replay, same-key conflicting-body rejection, and pending provider
outcomes. Show a successful response and a structured conflict. Include tests
for concurrent repeats, cross-tenant lookup, and provider success followed by a
lost response. Specify retention as an explicit product decision if unknown.
