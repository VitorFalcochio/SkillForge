---
name: nextjs-engineer
description: Build, refactor, review, or test Next.js applications, covering App Router architecture, Server and Client Components, data fetching and caching, rendering strategies, Server Actions and route handlers, authentication integration, performance, accessibility, and testing. Use when the work changes or reviews a project that depends on the next package. Verifies version-specific behavior against the installed version's documentation before relying on it.
license: MIT
---

# Next.js Engineer

Ship Next.js code that is correct for the installed framework version. Caching,
request APIs, and file conventions have changed across major versions, so
confirm behavior in version-matched documentation instead of relying on memory.

## Inputs and outputs

Determine the installed `next` and `react` versions from the lock file or
`node_modules/next/package.json`, the router in use (`app/`, `pages/`, or both),
`next.config` options such as `cacheComponents`, `reactCompiler`, and `output`,
the deployment target, the authentication library, and the test and lint setup.
Identify the requested behavior and affected routes.

Deliver changes that follow the project's conventions, the rendering and caching
behavior of each affected route stated explicitly, tests at appropriate levels,
and commands run with results, including a production build. For reviews,
deliver located findings with fixes.

## Workflow

1. Ground the version. If `node_modules/next/dist/docs/` exists, read the
   relevant pages there; otherwise use the official documentation for the
   installed major version. Check `AGENTS.md` or similar instructions in the
   repository. Note behavior that differs from other versions before coding.
2. Shape routes with the file conventions: layouts for shared UI and state, route
   groups for organization, and `loading`, `error`, and `not-found` files for
   each meaningful boundary. Keep pages thin and move data access into server-only
   modules. Parallel route slots need a `default` file in Next.js 16.
3. Keep components on the server by default. Add `'use client'` at the smallest
   interactive leaf, pass only serializable props across the boundary, and pass
   server-rendered content into client components as children. Mark modules that
   read secrets or databases with the `server-only` package when the project uses it.
4. Decide rendering and caching per route and data source: what may be prerendered,
   what depends on the request, what is cached, for how long, and how it is
   invalidated after writes. Read
   [the caching and rendering guide](references/caching-and-rendering.md) for the
   model that matches the installed version and configuration.
5. Treat each Server Action and route handler as a public endpoint. Validate input
   with the project's schema library, authenticate, and authorize the specific
   resource inside the action or handler. Use route handlers for webhooks and
   external clients, and verify webhook signatures. Return safe error shapes.
6. Enforce authentication close to the data, in a data access layer or the
   action itself, using the project's auth library. Use `proxy` (formerly
   `middleware`) only for optimistic redirects and request shaping, never as the
   only authorization check. Do not leak secrets into Client Components or
   `NEXT_PUBLIC_` variables.
7. Optimize from measurements: stream slow sections behind `Suspense`, fetch in
   parallel instead of in sequential awaits, keep client bundles small, use
   `next/image` with correct `sizes` and `next/font`, and measure with Lighthouse
   or Web Vitals on a production build rather than development mode.
8. Preserve accessibility: set `lang` on the root `html`, provide metadata titles
   per route, use `Link` for navigation and buttons for actions, and manage focus
   after client-side mutations and in dialogs.
9. Test at the right level: unit-test Client Components and pure server logic
   with the project's runner, test Server Actions and data functions directly,
   and cover async Server Components and full routes with end-to-end tests. Run
   type checking, the separately configured linter, tests, and `next build`.

## Constraints

- Do not apply recommendations from another major version without checking the
  installed version's documentation. Cite the documentation used for any
  version-specific decision.
- Do not enable `cacheComponents`, the React Compiler, or experimental flags, or
  migrate between routers, as a side effect of another task; propose it separately.
- Do not add an auth, data, or UI library when the project already has one, and
  do not change the deployment target or adapter without agreement.
- Never expose server secrets to client code or caches shared between users; data
  that varies by user must not be stored in a shared cache entry.
- Do not deploy, change hosting configuration, or modify production environment
  variables without explicit authorization.

## Verification criteria

The production build succeeds, and type checks, lint, and relevant tests pass,
or failures are reported. Each changed route has stated rendering and caching
behavior that matches the documentation of the installed version. Every Server
Action and route handler validates input and authorizes access server-side. No
secret reaches a client bundle. Performance claims cite measurements from a
production build.

## Example

Request: “Add an edit form for a user's profile. After saving, the profile page
must show the new data immediately.”

Confirm the project runs Next.js 16 and read the bundled `updateTag` and Server
Actions documentation. Render the profile in a Server Component reading through
the data access layer, tagged per user. Implement a Server Action that validates
input, checks that the session user owns the profile, writes it, and calls
`updateTag` for that user's tag to get read-your-writes behavior. Keep only the
form inputs in a Client Component. Add a test for an unauthorized save and an
end-to-end test that edits and sees the change, then run `next build`.
