# Creating skills

## Portable structure

A skill is a directory named after its identifier with a canonical `SKILL.md`:

```text
skills/development/example-skill/
  SKILL.md
  references/decision-guide.md   (only when this detail is useful)
```

Place a skill in the category that matches its audience: `development` for
engineering workflows and `meta` for creating and maintaining skills. Categories
are one level deep; add a new one only for a group of related skills.

Use the [open Agent Skills specification](https://agentskills.io/specification).
The initial validator implements its ASCII naming rules and portable metadata:

| Field           | Rules                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `name`          | Required, 1–64 lowercase ASCII letters/digits/hyphens; no leading, trailing, or consecutive hyphens; matches the directory |
| `description`   | Required, nonblank string, at most 1,024 characters; says what the skill does and when to use it                           |
| `license`       | Optional nonempty string                                                                                                   |
| `compatibility` | Optional nonempty string, at most 500 characters                                                                           |
| `metadata`      | Optional mapping of string keys to string values                                                                           |
| `allowed-tools` | Optional nonempty string; experimental and warned about                                                                    |

Identifiers must be globally unique across catalog categories. Portable path
handling also rejects Windows reserved filenames such as `con`; the Claude adapter
rejects its reserved `synced` and `anthropic-skills` identifiers. YAML must have
unique keys; aliases are intentionally unsupported. Quote values such as version
numbers when a string is required.

## Write a useful entry point

```markdown
---
name: example-skill
description: Inspect migration plans for data-loss risks when a user requests a migration review.
license: MIT
---

# Migration Review

Identify the schema change, data invariants, rollout sequence, and rollback needs.
Trace old and new clients through the proposed transition. Report the concrete
failure cases, their evidence, and the checks needed before rollout.
```

A production contribution also needs:

- Required inputs and expected deliverables.
- A repeatable workflow that changes an agent's decisions in useful ways.
- Explicit limits on scope and side effects.
- Verification criteria tied to observable results.
- At least one realistic request and an explanation of how the workflow handles it.

These are contribution quality requirements, not mandatory frontmatter fields or
fixed Markdown headings. The validator checks structure and references; reviewers
evaluate usefulness, activation boundaries, and behavioral quality. Keep the
entry point concise; more than 500 body lines produces a warning.

## Add resources deliberately

`references/`, `scripts/`, `assets/`, and `agents/` are optional. Do not add empty
directories. Keep portable metadata independent of platform-specific extensions.
For example, optional Codex UI configuration belongs in `agents/openai.yaml` and
requires its own host-specific review; the portable validator does not interpret
it or enforce tool permissions.

Link references where their detail is relevant:

```markdown
For multi-step migrations, read [the decision guide](references/decision-guide.md).
```

Markdown links are resolved relative to the containing document. A nested
reference may use `../assets/example.json` if the resulting path stays inside the
same skill. Standalone inline-code paths beginning with `references/`, `scripts/`,
`assets/`, or `agents/` are also checked, relative to the containing document.
Prefer Markdown links for nested references. Use exact filename casing.

Local Markdown fragments use GitHub-style heading slugs, including duplicate
heading suffixes. Links and images in ordinary Markdown and link definitions are
checked; examples in fenced code blocks are not. Raw HTML URLs, paths in prose or
shell snippets, undefined reference labels parsed as text, interpolated paths,
and resources named inside platform YAML are outside the checker's coverage.
Non-Markdown fragments produce warnings, and external URLs are not fetched.

All skill files are subject to bounded traversal and portable filename rules.
Symlinks, junctions, special files, and case-colliding names are rejected. Review
scripts manually before use; their presence produces a warning, and installation
never runs them. Do not rely on executable permission bits surviving a copy.

## Validate and evaluate

```sh
pnpm build
pnpm agentskills validate skills/development/example-skill
pnpm agentskills validate skills --strict
pnpm check
```

Catalog validation catches duplicate names that single-skill validation cannot.
The deliberately invalid fixture under `tests/fixtures/` is not part of the catalog.
If a deliberate warning is introduced, document why it is appropriate and choose
the CI validation policy consciously; do not silently suppress it.

Add an evaluation suite under `evals/` with the skill's name: scenarios with
synthetic fixtures, expected outcomes, deterministic assertions or rubrics, and
static checks that protect the skill's critical constraints. Run it with
`pnpm agentskills eval` and the skill name; the format is in
[evaluating skills](evaluating-skills.md). Record agent runs only from real,
isolated sessions, with the agent version, model, and skill revision.

Do not claim live agent compatibility or improved task success from structural
validation alone. No agent runs are recorded in the repository yet.

## Use the meta skills

Four catalog skills support this process. `skill-creator` drafts a new skill
and checks overlap, `skill-reviewer` reviews a contribution as untrusted content,
`skill-optimizer` tightens an existing skill while preserving its behavior
contract, and `skill-evaluator` designs and compares evaluation runs. Install
them like any other skill. They guide an agent; they do not replace maintainer
review.
