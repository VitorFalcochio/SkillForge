# Evidence and severity

Use the project's severity convention if one exists. Otherwise use:

| Severity | Evidence of impact                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------- |
| Critical | Reachable loss of sensitive data, broad unauthorized access, or irreversible widespread corruption |
| High     | A supported operation can fail, lose data, or violate an important access boundary                 |
| Medium   | A bounded failure, material degradation, or a demonstrated maintenance obstacle                    |
| Low      | A limited issue with a concrete consequence; avoid speculative cleanup                             |

Severity describes consequence and exposure; confidence describes evidence.
A high-impact hypothesis with weak evidence belongs in an investigation section.

For each finding provide:

1. Title describing the failing behavior, severity, and confidence.
2. Smallest useful source location and affected entry point.
3. Preconditions, input or event ordering, expected behavior, and actual result.
4. Reproduction command or a trace through the relevant guards and state changes.
5. Focused correction and a check that distinguishes fixed from broken behavior.

Example: “High: a retry generates a new payment key after timeout.” Evidence:
the fake provider records two successful charges for the same order after the
first response is dropped. Correction: persist and reuse the operation key.
Verification: drop the response after success, retry, and assert one charge and
one order. If that experiment was not run, label it as a proposed reproduction.

Finish with coverage: paths inspected, tests actually run and their results,
and assumptions that could change the assessment. Do not use a finding count as
an audit quality target.
