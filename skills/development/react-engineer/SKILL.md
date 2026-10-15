---
name: react-engineer
description: Build, refactor, review, or test React components written in TypeScript, covering component boundaries, props and type design, hooks, state placement, data fetching, rendering performance, accessibility, and tests. Use when the work changes or reviews .tsx or .jsx code in a React-based project, including Next.js, Remix, Vite, or React Native. Defers to the project's existing framework, state library, styling, and test tooling.
license: MIT
---

# React Engineer

Write React code that fits the project's framework, conventions, and existing
dependencies. The right state or data-fetching approach is the one the project
already uses unless it demonstrably cannot meet the requirement.

## Inputs and outputs

Determine the React version, framework and rendering model (client-only, server
rendering, or Server Components), TypeScript strictness, state and data libraries,
styling approach, test runner, and lint rules from manifests, configuration, and
neighboring components. Identify the requested behavior, affected components, and
any accessibility or performance requirements.

Deliver changes consistent with neighboring files, tests at the level the project
already uses, and a short note on decisions and trade-offs. For a review, deliver
findings with file and line, the triggering scenario, and a concrete fix.

## Workflow

1. Map existing patterns: component structure, where state lives, how data is
   fetched and cached, form and error handling, and test location. Follow local
   naming, file layout, export style, and styling conventions.
2. Define the component contract first: props, events, controlled versus
   uncontrolled behavior, composition slots, and loading, empty, and error states.
   Prefer discriminated unions to combinations of optional booleans for mutually
   exclusive states. Use `unknown` with narrowing at untrusted boundaries, not `any`.
3. Place state deliberately. Derive values during render instead of storing
   them, keep state at the lowest common owner, leave server data in the
   project's data layer instead of copying it into local state, and keep shareable
   view state in the URL when the router supports it. Read
   [state and rendering guidance](references/state-and-rendering.md) before adding
   context, a global store, or an effect.
4. Use effects only to synchronize with systems outside React: subscriptions,
   timers, browser APIs, or non-React widgets. Each effect has complete
   dependencies, cleanup, and protection against out-of-order async results.
   Handle user events in handlers and transform data during render, not in effects.
5. Build accessible markup. Prefer native elements to ARIA: a `button` for
   actions and a link for navigation. Label form controls, associate errors,
   manage focus for dialogs and route changes, and give custom widgets the
   keyboard behavior of the matching WAI-ARIA Authoring Practices pattern.
6. Address performance from evidence. Fix structural causes first, such as state
   placed too high, unstable context values, unvirtualized long lists, or expensive
   work during render, before adding `memo`, `useMemo`, or `useCallback`. Confirm
   with the React Profiler or a timing when the claim matters. If the project uses
   the React Compiler, do not add memoization it already provides.
7. Test behavior through the rendered interface: query by role and label, interact
   as a user would, and assert visible outcomes. Mock the network boundary rather
   than the component's own hooks. Cover the motivating interaction and the
   error and empty states.
8. Run the project's type checker, linter, and relevant tests. Report commands
   and results, and name any check that could not run.

## Constraints

- Do not add a state, data-fetching, or UI library, or migrate frameworks, unless
  the user asks or a requirement cannot be met with existing tools. Explain the
  trade-off when proposing one.
- Respect the rendering model: no browser-only APIs during server rendering, no
  hooks or event handlers in Server Components, and no secrets in client bundles.
- Keep refactors behavior-preserving and separately verifiable. Do not combine a
  refactor with a feature change unless requested.
- Do not silence type errors with `any`, non-null assertions, or `@ts-ignore` to
  finish a change. Scope any unavoidable suppression narrowly and explain it.
- Never pass unsanitized input to `dangerouslySetInnerHTML`.

## Verification criteria

Type checking, linting, and relevant tests pass, or failures are reported with
output. Prop types rule out invalid state combinations where practical. Effects
satisfy the project's hook lint rules and clean up. Interactive elements have
accessible names and work by keyboard. Performance claims include before-and-after
measurements. New tests fail without the change where that is meaningful.

## Example

Request: “The product list re-renders on every keystroke in the search box and
feels slow. Fix it.”

Profile typing and record which components render and for how long. If the
search text lives in a context consumed by the whole page, move it to the common
parent of the search box and list. If thousands of rows render at once, apply the
project's virtualization approach or `useDeferredValue` for the filtered results.
Repeat the same typing sequence and compare profiler timings. Add a test that
typing filters visible results. Avoid blanket memoization the measurements do not justify.
