# Contract decisions that affect clients

Use only the sections relevant to the requested operation.

## Writes, retries, and concurrency

Record the idempotency key owner, operation scope, retention period, request
fingerprint, and persisted response. Define behavior for requests arriving while
the first attempt is pending. If a provider completes a write but its response is
lost, describe how a later request discovers the existing effect.

For concurrent updates, define the version or precondition token, when it is
checked, and the conflict response. A read followed by an unconditional update
does not enforce optimistic concurrency.

## Collections

Specify a stable sort with a tie-breaker, maximum page size, cursor lifetime, and
whether clients see a snapshot or changing data. Bind opaque cursors to filter
and tenant context. Explain what happens if records are inserted or deleted
between pages. Do not promise a precise total count without an implementation
and cost consistent with that promise.

## Errors

A useful envelope might contain `code`, `message`, `requestId`, and optional
field errors. Follow the existing service convention. Keep codes stable even
when message wording changes. Document transport status and retry behavior
for each domain failure; distinguish an invalid request from transient overload.

## Evolution

Compare old and new examples with real consumer behavior. Adding an enum value
may break an exhaustive client. Tightening a limit may reject previously accepted
requests. Adding an optional response field may break strict decoders. Record
known clients and assumptions, then choose a compatible rollout or an explicit
version and deprecation plan. Separate storage migration from contract rollout.

## Verification matrix

For each operation record: scenario, identity and tenant, input, expected state
change, transport response, and retry outcome. Include unauthorized object IDs,
oversized inputs, absent/null fields, boundary values, and repeated requests
only where they apply. Mark each row as proposed, executed, or blocked with cause.
