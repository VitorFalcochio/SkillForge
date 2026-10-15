# UI review checklist

Apply the project's own standards first. These defaults apply when none exist.

## Accessibility thresholds

WCAG 2.2 level AA values; confirm against the target the user specified.

| Check             | Threshold                                                                           | Criterion     |
| ----------------- | ----------------------------------------------------------------------------------- | ------------- |
| Text contrast     | 4.5:1; 3:1 for large text (at least 24 CSS px, or 18.66 CSS px bold)                | 1.4.3         |
| Non-text contrast | 3:1 for control boundaries, icons, and focus indicators against adjacent colors     | 1.4.11        |
| Resize text       | Usable at 200% text size without loss of content or function                        | 1.4.4         |
| Reflow            | No two-dimensional scrolling at 320 CSS px width, except content such as tables     | 1.4.10        |
| Text spacing      | Survives line height 1.5, paragraph spacing 2, letter 0.12, word 0.16 (× font size) | 1.4.12        |
| Focus             | Visible focus indicator that is not fully hidden by sticky headers or overlays      | 2.4.7, 2.4.11 |
| Target size       | 24×24 CSS px, or enough spacing that a 24 px circle does not overlap other targets  | 2.5.8         |
| Use of color      | Color is not the only means of conveying information or state                       | 1.4.1         |
| Name, role, value | Custom controls expose an accessible name, role, and current state                  | 4.1.2         |

Touch-first products often follow platform guidance instead: 44×44 pt in Apple's
Human Interface Guidelines and 48×48 dp in Material Design. Respect
`prefers-reduced-motion` for nonessential animation and avoid content that flashes.

## Hierarchy and layout

- Each region has one dominant element; the primary action is identifiable
  within a few seconds and visually distinct from secondary actions.
- Proximity groups related items; spacing between groups exceeds spacing within them.
- Alignment follows a consistent grid; exceptions are deliberate.
- Body text uses a comfortable measure (roughly 45 to 90 characters) and line height.
- Type sizes, weights, and colors come from a small, named scale.

## Component consistency

- The same purpose uses the same component, label, icon, and position across screens.
- Count variants of buttons, inputs, cards, and dialogs. Unexplained duplicates are
  consolidation candidates; list the screens that use each.
- Destructive actions share one treatment and require confirmation proportional
  to their reversibility.

## Content and state stress cases

Check long names and translations, right-to-left text when supported, zero, one,
and many items, missing images, slow loading, partial failure, validation errors,
and user-generated content. Each needs a defined appearance, not only the happy path.

## Finding format

| Field          | Content                                                             |
| -------------- | ------------------------------------------------------------------- |
| Location       | Screen, component, state, and viewport                              |
| Observation    | What happens, with a screenshot reference or element when available |
| Evidence       | Measured value, criterion, or inconsistent examples                 |
| Impact         | Affected users and task                                             |
| Severity       | Blocker, major, minor, or polish                                    |
| Recommendation | Change expressed with existing tokens and components                |
| Verification   | How to confirm the fix                                              |

A blocker prevents a task or creates an accessibility barrier. Major issues slow
or mislead most users. Minor issues are noticeable friction. Polish is optional
refinement. Mark findings based on heuristics rather than observation or testing.
