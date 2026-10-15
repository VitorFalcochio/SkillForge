# Risk rating and reporting

Use the organization's rating scheme when one exists, such as CVSS or an internal
matrix. Otherwise apply the method below and say so in the report.

## Severity

Rate severity from impact and exploitability, using evidence rather than worst
cases.

| Severity | Typical evidence                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Critical | Unauthenticated remote code execution, broad data access across tenants, or authentication bypass        |
| High     | An authenticated user reaches other users' data or privileged actions, or injection with material impact |
| Medium   | Exploitation needs unusual preconditions or user interaction, or the impact is bounded                   |
| Low      | Defense-in-depth gaps and information disclosure with limited consequence                                |

Raise exploitability for internet exposure, no authentication, and low attack
complexity. Lower it for strong compensating controls that were verified, not
assumed. Confidence is separate: confirmed by test, confirmed by trace, or
hypothesis.

## OWASP Top 10:2025 mapping

Use categories to organize findings, not as a checklist that implies coverage.

| ID  | Category                               | Review prompts                                                         |
| --- | -------------------------------------- | ---------------------------------------------------------------------- |
| A01 | Broken Access Control                  | Object ownership, tenant scoping, privilege escalation, SSRF           |
| A02 | Security Misconfiguration              | Defaults, debug modes, headers, CORS, verbose errors, cloud policies   |
| A03 | Software Supply Chain Failures         | Advisories, unpinned actions and images, build integrity, typosquats   |
| A04 | Cryptographic Failures                 | Weak hashing for passwords, unencrypted sensitive data, key management |
| A05 | Injection                              | SQL, NoSQL, OS command, template, LDAP, and cross-site scripting       |
| A06 | Insecure Design                        | Missing rate limits, abuse cases, trust in client-side state           |
| A07 | Authentication Failures                | Session handling, credential stuffing defenses, recovery flows         |
| A08 | Software or Data Integrity Failures    | Unsafe deserialization, unsigned updates, unverified webhooks          |
| A09 | Security Logging and Alerting Failures | Missing audit events, secrets in logs, alerts nobody receives          |
| A10 | Mishandling of Exceptional Conditions  | Fail-open error paths, unhandled exceptions leaking state              |

## Secret handling

When a secret is found, record only file and line, secret type, a fingerprint
such as the first four characters and length, whether it appears in history, and
the likely owner. Never validate a credential by using it. Treat any committed
credential as compromised: recommend rotation first, then history cleanup if the
owner wants it, since rewriting history does not revoke copies.

## Finding format

1. Title stating the vulnerable behavior, severity, confidence, and category.
2. Location: file and line, entry point, and affected component.
3. Preconditions: attacker role, required knowledge, and configuration.
4. Evidence: trace through the code or a reproducible local test with synthetic data.
5. Impact: what the attacker obtains or changes, and at what scale.
6. Remediation: the root-cause fix and any short-term mitigation.
7. Verification: a test that fails before and passes after the fix.

End with scope, tools and commands run, positive controls observed, areas not
reviewed, and assumptions that could change a rating.
