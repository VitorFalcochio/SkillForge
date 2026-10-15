# Investigation record

Keep this record compact enough to show what changed your conclusion.

## Reproduction

- Revision, runtime, relevant configuration, and synthetic input.
- Command or steps, expected output, observed output, and failure frequency.
- Dependencies replaced by fakes and behaviors those fakes do not cover.

## Hypotheses

| Hypothesis                        | Predicted observable                         | Discriminating experiment           | Actual result            | Status                       |
| --------------------------------- | -------------------------------------------- | ----------------------------------- | ------------------------ | ---------------------------- |
| Cache retains the previous expiry | Direct storage read differs from cached read | Read both at the same injected time | Record the actual values | Open, rejected, or supported |

Avoid changing cache behavior and time handling in the same experiment: either
could explain a passing result. A passing run supports a hypothesis only when
the alternative predicts a different outcome.

## Causal conclusion

Write a chain such as: refresh keeps a stale expiry in the cache; the authorization
path trusts the cache; requests pass after the new expiry. Name the evidence at
each step. State what would falsify the conclusion.

## Regression evidence

Record the original failing result, corrected passing result, related checks,
and any untested dependency. For repeated stochastic checks, preserve the seed
and run count. Do not describe a lower observed failure rate as a guarantee.
