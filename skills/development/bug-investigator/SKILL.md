---
name: bug-investigator
description: Investigate a reported failure through reproduction, discriminating experiments, root-cause analysis, and regression verification. Use when a defect is intermittent, unexplained, or needs an evidence-backed fix.
license: MIT
---

# Bug Investigator

Explain why a failure occurs and verify the narrow correction against its cause.
Investigation alone does not authorize changing production systems.

## Inputs and outputs

Collect the symptom, expected behavior, smallest known trigger, relevant logs,
revision, and environment. First extract available evidence from the repository
and report. Ask only for missing details that affect the next experiment.

Return a reproducible case or an explicitly bounded failure to reproduce, an
evidence-backed cause, the correction if authorized, regression results, and
remaining uncertainty. Keep a compact experiment log using
[the investigation record](references/experiment-record.md) for intermittent or
multi-hypothesis cases.

## Workflow

1. Preserve the failure evidence before modifying code. Capture the exact input,
   error, environment, and revision while redacting secrets. Establish whether
   the original report describes a regression or previously unspecified behavior.
2. Reproduce with the narrowest existing test or local harness. Control time,
   randomness, external services, and scheduling only when they affect the
   failure. For intermittent failures, record attempts and failures rather than
   describing one successful run as proof of a fix.
3. Trace backward from the first incorrect state to its producer. Distinguish
   the visible exception from the state transition that made it inevitable.
   Inspect call sites, persisted values, and relevant configuration together.
4. State competing hypotheses and choose an experiment whose outcomes separate
   them. Predict each outcome before running it. Change one causal variable;
   prefer a fake clock, injected failure, or deterministic barrier to arbitrary sleeps.
5. Reject hypotheses contradicted by evidence. If experiments stop producing
   useful evidence, report the exact missing observable or environment access
   needed. Do not accumulate speculative patches.
6. When fixes are requested, correct the earliest owned invariant violation.
   Add a regression test that fails on the original code and passes with the
   correction. Exercise the nearby success and failure paths affected by the fix.
7. Report the causal chain and the commands actually run. Distinguish source
   verification from deployment status and production recovery.

## Constraints

- Do not suppress an exception, add retries, or increase a timeout unless the
  evidence shows that behavior is the intended contract.
- Preserve unrelated user changes. Do not reset the working tree to reproduce a
  previous revision; use an isolated copy when a historical comparison is needed.
- Do not copy credentials or personal data into fixtures. Use synthetic inputs
  preserving the property that triggers the failure.
- Production mutations, external messages, and deployment require authorization
  covering those actions. An inaccessible environment is a reported limitation.

## Verification criteria

The evidence explains the trigger, incorrect transition, and symptom. A proposed
fix has a falsifiable regression check; an implemented fix demonstrates that the
check fails before and passes after. Nearby checks pass or their failures are
reported. State whether the intermittent reproduction became deterministic.

## Example

Request: “Expired sessions sometimes remain valid after refresh; fix it.”

Capture expiry and refresh times. Compare stale cache, clock mismatch, and an
inclusive boundary as hypotheses. Inject a fixed clock and test immediately
before, exactly at, and after expiry without sleeps. If equality is the cause,
make the expiry comparison match the documented contract and prove the boundary
case fails on the original logic. Do not invalidate real user sessions to test it.
