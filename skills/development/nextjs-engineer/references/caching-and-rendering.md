# Caching and rendering by version

Checked against the official Next.js 16 upgrade guide on October 15, 2026. The
installed version's documentation takes precedence over this summary, and
minor releases may change details.

## Version differences that change code

| Area                    | Next.js 14 (App Router) | Next.js 15                                      | Next.js 16                                                     |
| ----------------------- | ----------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `fetch` in Server Comps | Cached by default       | Not cached by default                           | Not cached by default; opt in through the caching model in use |
| GET route handlers      | Static by default       | Not cached by default                           | Not cached by default                                          |
| `params`, `cookies()`   | Synchronous             | Async, with temporary synchronous compatibility | Async only                                                     |
| Request interception    | `middleware`            | `middleware`                                    | `proxy` on the Node.js runtime; `middleware` deprecated        |
| Partial prerendering    | Not available           | Experimental flag                               | Through `cacheComponents`                                      |
| Linting                 | `next lint`             | `next lint`                                     | `next lint` removed; run ESLint or Biome directly              |
| Default bundler         | webpack                 | webpack, Turbopack opt-in for development       | Turbopack for `next dev` and `next build`                      |

Run the official codemods for upgrades instead of editing by hand where they
apply, and review their output.

## Two caching models in Next.js 16

Check `next.config` for `cacheComponents`.

**Cache Components enabled.** Data access is dynamic unless cached. Mark cached
functions or components with the `'use cache'` directive, set lifetime with
`cacheLife`, and label entries with `cacheTag`. Uncached request-time data must
render inside a `Suspense` boundary, or the build reports an error. Segment
options such as `dynamic` and `revalidate` give way to these APIs; follow the
official migration guide when converting.

**Cache Components disabled.** The previous model applies: `fetch` cache options
and `next.revalidate`, route segment configuration, and static rendering when a
route uses no request-time APIs.

In both models, do not cache data that varies by user in a shared entry. Reading
`cookies()`, `headers()`, or `searchParams` makes rendering request-time.

## Invalidation after writes

| API                           | Behavior                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `updateTag(tag)`              | Server Actions only; expires and refreshes in the same request for read-your-writes  |
| `revalidateTag(tag, profile)` | Marks stale with stale-while-revalidate; Next.js 16 requires the `cacheLife` profile |
| `revalidatePath(path)`        | Invalidates a route path                                                             |
| `refresh()`                   | Refreshes the client router from a Server Action                                     |

Use `updateTag` when the user must see their own change immediately, and
`revalidateTag` when brief staleness is acceptable. On Next.js 15 and earlier,
`revalidateTag` takes one argument and `updateTag` does not exist.

## Rendering choices

| Need                                        | Approach                                                       |
| ------------------------------------------- | -------------------------------------------------------------- |
| Same content for everyone, changes rarely   | Prerender, cache with time or tag invalidation                 |
| Mostly static shell with personalized parts | Static shell with personalized sections streamed in `Suspense` |
| Fully per-request content                   | Request-time rendering, with streaming for slow sections       |
| Highly interactive widget                   | Client Component leaf receiving server-fetched initial data    |

`next build` output lists how each route renders; use it to confirm the intended
outcome. Next.js 16 removed the size and First Load JS columns from that output,
so measure page weight with Lighthouse or browser tools.

## Server and client boundary checklist

- Props passed to Client Components are serializable; functions are passed only
  as Server Actions.
- Environment variables without the `NEXT_PUBLIC_` prefix are server-only; those
  with it are inlined into client bundles at build time.
- Browser APIs run only in Client Components, inside effects or event handlers.
- Third-party components that use hooks need a Client Component wrapper.
