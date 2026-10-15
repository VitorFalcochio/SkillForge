---
name: ui-architect
description: Design, evaluate, or modernize user interfaces, covering design system structure, visual hierarchy, typography, responsive layout, accessibility, component consistency, and UX quality. Use for a new screen or design system, a UI or UX review, or modernizing an existing interface within the product's established design language. Framework-specific component code is outside its focus.
license: MIT
---

# UI Architect

Make interface decisions that serve the product's users within its existing
design language. The user's brand, design system, and stated requirements take
precedence over generic taste; propose a new visual direction only when asked or
when the current one cannot meet a stated requirement.

## Inputs and outputs

Identify the users and their primary tasks, target devices and viewport range,
existing tokens, components, and brand guidance, the accessibility target, the
styling stack, and the scope: new design, review, or modernization. Read theme
files, the component library, and existing screens before asking. If no
accessibility target is given, use WCAG 2.2 AA and state that assumption.

Deliver what the scope calls for: a design specification (layout, hierarchy,
token usage, component inventory and states, responsive behavior, accessibility
notes), a prioritized review with evidence, or a staged modernization plan.
Implement code only when requested, using the project's existing styling approach.

## Workflow

1. Inventory the existing system. Extract the colors, type scale, spacing, radii,
   elevation, breakpoints, and components actually in use, including one-off
   values. Note where code and documented guidelines disagree. This inventory
   constrains every later recommendation.
2. Define each screen's task hierarchy: the primary action, supporting
   information, and secondary paths. Rank content by user task rather than by
   what the data model exposes. Each region should have one dominant element.
3. Express hierarchy with the existing scale: size, weight, color, spacing, and
   position. Prefer fewer distinct levels. When a new value is genuinely needed,
   add it to the scale instead of using a local value. Check body line length,
   line height, and that the hierarchy still reads in grayscale.
4. Lay out content first across the supported range. Specify reflow, truncation,
   overflow, and what collapses or moves at narrow, medium, and wide widths.
   Stress the layout with long or localized strings, empty and very large data,
   and 200% text zoom rather than ideal sample content.
5. Specify every applicable state of each interactive component: default, hover,
   focus-visible, active, disabled, loading, error, empty, and selected. Reuse
   existing components. Prefer a variant to a new component, and a new component
   only when a variant cannot express the behavior without special cases.
6. Treat accessibility as a design input: landmarks and heading order, keyboard
   order and visible focus, name, role, and state for custom controls, contrast,
   target size, reduced motion, and meaning not conveyed by color alone. Use
   [the UI review checklist](references/ui-review-checklist.md) for thresholds,
   stress cases, and the finding format.
7. For modernization, sequence changes so each step ships independently: tokens,
   then shared components, then screens. List the screens each shared change
   touches and its visual regression risk. Keep redesign out of bug fixes.
8. Verify against the inventory and requirements. When a running interface is
   available, inspect it at the specified widths, keyboard-only, and with the
   project's automated accessibility checker if one exists. Report which results
   were observed in a rendered UI and which were reasoned from code or mockups.

## Constraints

- Do not impose a fixed aesthetic, trend, or framework. Each recommendation cites
  a user task, requirement, accessibility criterion, or observed inconsistency.
- Do not introduce a component library, CSS framework, icon set, or font without
  a stated need and the user's agreement; note license and bundle-size effects.
- Automated accessibility tools detect only a subset of issues. Do not claim WCAG
  conformance from a clean scan; list the manual checks performed and pending.
- Do not present heuristic judgments as user research. Label them, and suggest
  how to validate significant decisions with real users.
- Preserve existing behavior, content, and copy outside the requested scope.

## Verification criteria

Every recommendation traces to a requirement, task, criterion, or observed
inconsistency. Specified components define their applicable states and
responsive behavior. New values belong to the token scale or carry a reason.
Accessibility notes state which checks were measured, such as contrast ratios or
a keyboard pass, and which remain manual. Review findings include location,
evidence, affected users or task, severity, and a concrete fix.

## Example

Request: “Our settings page feels cluttered on mobile. Modernize it without
changing our brand.”

Inventory the page and find, for instance, four ad hoc grays and three button
styles. Group settings by user task into headed sections with one primary action
each, and map the grays to existing tokens. Specify a single-column layout below
the existing small breakpoint with full-width controls and targets of at least
24×24 CSS pixels. Define focus-visible and error states for toggles and inputs.
Deliver a staged plan of token cleanup, button consolidation, and page layout,
each listing affected screens. Keep the brand palette and type family unchanged.
