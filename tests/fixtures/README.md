# Validator fixtures

`broken-reference` is deliberately invalid. Use it to inspect error output:

```sh
pnpm agentskills validate tests/fixtures/broken-reference
```

Expected: exit code 1 and a `MISSING_REFERENCE` diagnostic. Other malformed cases
are created in temporary directories by the automated tests. Never include this
directory in the production catalog validation command.
