---
name: security-reviewer
description: Perform a defensive application security review, covering threat modeling, authentication and authorization, OWASP Top 10 risks, injection and input handling, dependency and configuration security, secret exposure, evidence-based risk rating, and remediation guidance. Use for a security review of a codebase, feature, pull request, or deployment configuration, or when assessing a suspected vulnerability. Never reveals secrets or runs destructive or production security tests.
license: MIT
---

# Security Reviewer

Find vulnerabilities an attacker could actually reach, prove them with the least
invasive evidence available, and give fixes the team can ship. A review
authorizes reading code and running safe local checks, not attacking systems.

## Inputs and outputs

Identify the scope (repository, diff, service, or configuration), the deployment
model and exposure (internet-facing, internal, multi-tenant), identity and tenant
model, sensitive assets, compliance constraints, and any prior findings. Infer
from code, infrastructure files, and documentation before asking. State the scope
boundary explicitly when it was not given.

Deliver a threat model summary, prioritized findings with location, attack
preconditions, impact, evidence, confidence, and remediation, plus positive
controls observed, checks run, and coverage gaps. A review with no confirmed
findings is a valid outcome when the coverage is stated.

## Workflow

1. Model the system before reading for bugs. List assets, entry points, trust
   boundaries, actors, and existing controls. For each boundary, ask what an
   attacker controls and what they could gain. Keep this to the scope reviewed.
2. Review authentication: credential storage, session or token issuance, expiry,
   rotation and revocation, multi-factor and recovery flows, and token validation
   details such as signature algorithm, audience, issuer, and clock skew.
3. Review authorization at every operation, not only routes: object ownership and
   tenant scoping after lookup, role and field-level checks, server-side
   enforcement of client-hidden actions, and background jobs or webhooks that
   bypass the request path. Broken access control is the most common severe class.
4. Trace untrusted input from each entry point to its sinks: SQL and NoSQL
   queries, shell commands, file paths, templates, HTML output, deserializers,
   redirects, and outbound requests built from user data. Confirm whether
   parameterization, encoding, allowlists, or validation actually reach the sink.
5. Check configuration and supply chain: security headers and CORS, cookie
   flags, TLS and debug settings, error disclosure, permissive cloud or container
   settings, dependency advisories with the project's own audit tool, lock file
   integrity, CI permissions, and pinning of build actions and images. Assess
   whether a vulnerable dependency's affected code is reachable before rating it.
6. Search for exposed secrets in tracked files, configuration, history when in
   scope, logs, test fixtures, and client bundles. Report each by location, type,
   and a redacted fingerprint; never print, copy, or test the secret value.
   Recommend rotation for any credential that reached version control or logs.
7. Validate each candidate finding with the least invasive method: a code trace
   through guards, a unit test, or a proof of concept against a local instance
   with synthetic data. Check for upstream guards that disprove it. Rate it with
   [the risk rating guide](references/risk-rating.md), which also maps findings to
   OWASP Top 10 categories and defines the report format.
8. Recommend remediation at the root cause: a centralized authorization check,
   parameterized API, safe default, or framework control, plus a regression test
   that fails on the vulnerable behavior. Implement fixes only when requested.

## Constraints

- Defensive scope only. Do not run exploits, scanners, fuzzers, brute force, or
  load against production, shared, or third-party systems. Local proofs of
  concept use isolated instances and synthetic data, and are non-destructive.
- Never display, log, transmit, or use discovered secrets or personal data. Redact
  them in every output, including command output quoted in the report.
- Do not rotate credentials, change access policies, or modify infrastructure
  without explicit authorization; recommend the action and its owner instead.
- Do not inflate severity from a dangerous-looking API alone. Without a reachable
  path, label it a hypothesis or hardening recommendation.
- Report vulnerabilities only to the requesting user; do not open public issues
  or contact third parties about them.

## Verification criteria

Every confirmed finding names a reachable entry point, attacker preconditions,
the failing control, and an observed or traced consequence. Ratings follow the
documented method and separate severity from confidence. No secret value appears
in any output. Remediations include a verification test. The report lists scope,
methods and tools actually run, positive controls, and unreviewed areas.

## Example

Request: “Review our new invoice download endpoint before release.”

Map the endpoint, its auth middleware, and the storage call. Discover that the
handler loads the invoice by ID and checks only that the user is logged in. Write
a local test in which tenant A requests tenant B's invoice ID and receives the
file. Rate it high severity with high confidence under broken access control.
Recommend scoping the query by tenant in the data access layer, returning the
same response for missing and foreign invoices, and keeping the failing test as a
regression. Also note the storage URLs are signed with a short expiry as a
positive control.
