# State and rendering decisions

Prefer the project's established pattern when it already answers the question.

## Where state belongs

| Kind of data                                  | Default home                                                    |
| --------------------------------------------- | --------------------------------------------------------------- |
| Computable from props or other state          | Compute during render; memoize only if measured as expensive    |
| Local interaction state                       | `useState` or `useReducer` in the component that uses it        |
| Shared by siblings                            | Lowest common parent, passed down or composed through children  |
| Server data                                   | Existing query cache, framework loader, or Server Component     |
| Shareable or restorable view state            | URL path or search parameters                                   |
| Rarely changing app-wide values               | Context, such as theme, locale, or current user                 |
| Frequently changing state used across the app | Existing store with selectors, or contexts split by update rate |

Copying server data into local state creates a second source of truth that goes
stale. Copying a prop into state ignores later prop changes; to reset state when
an identity changes, render the component with a different `key`.

## Context

Every consumer re-renders when the provider value changes identity. Memoize object
values, separate rarely and frequently changing values into different contexts,
and pass dispatch functions separately from state. Context is a dependency
injection mechanism, not a store with fine-grained subscriptions.

## Effects

Before writing an effect, check whether the logic belongs elsewhere:

- Derived data: compute during render.
- A response to a click or submit: the event handler.
- Data fetching: the project's data layer or framework, which handles caching,
  deduplication, and races.
- Notifying a parent of a change: call its callback in the same event handler.

When an effect is required, ignore stale async results with a cancellation flag
or `AbortController`. Development Strict Mode runs setup and cleanup an extra
time to expose missing cleanup; fix the cleanup rather than suppressing the rerun.

## Memoization and identity

`memo` helps only when props are referentially stable and rendering is costly.
`useCallback` and `useMemo` matter when values are passed to memoized children or
used as effect dependencies. Use stable domain identifiers as list keys; array
indexes break state association when items are inserted, removed, or reordered.
For long lists, virtualization usually matters more than memoization.

## Forms

Follow the project's form library and validation schema. Validate on the server
regardless of client checks. Associate each error with its field through
`aria-describedby`, set `aria-invalid`, and move focus to the first invalid field
or an error summary after a failed submit. Disable submission while pending
without discarding user input.

## Testing

- Query by role, then label, then text; use test IDs only when no accessible
  query exists, which may itself indicate an accessibility gap.
- Prefer user-event style interactions over synthetic single events when available.
- Await asynchronous UI with `findBy` queries or `waitFor` rather than fixed delays.
- Mock the network or service boundary; avoid asserting on implementation details
  such as hook calls or internal state.
- Snapshots supplement, but do not replace, assertions about behavior.
