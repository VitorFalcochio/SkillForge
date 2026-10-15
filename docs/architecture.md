# Architecture

## Package boundaries

```text
packages/cli ───────► packages/validator ───────► packages/core
      └───────────────────────────────────────► packages/core
skills/  (portable skill data, read by the packages)
evals/   (evaluation suites and recorded results, read by core)
```

`@agentskills/core` owns the portable Zod metadata schema, YAML parsing, bounded
filesystem traversal, local catalog discovery, path containment, and installation
destination adapters. It also owns the evaluation suite and result schemas, their
bounded loading, and deterministic text assertions. It performs no skill
installation or process execution.

`@agentskills/validator` turns discovered skill trees into structured diagnostics.
It uses core models and filesystem constraints, parses Markdown with remark, and
checks local resources and GitHub-style heading anchors. Its public `validate`
function returns `{ valid, skills, diagnostics }`; each diagnostic has severity,
code, source path, message, and an optional source line.

`@agentskills/cli` uses Commander to expose the local catalog, validator, and
evaluation grading. The
installation service lives here because it coordinates validation, user
confirmation, and filesystem writes. It accepts an explicit home and project
directory internally so integration tests never touch actual agent folders.

The CLI package declares the `agentskills` binary. During source development,
`pnpm agentskills` launches the built executable. The bundled catalog location is
relative to that executable, so it remains available when the current working
directory changes; the bundled `evals/` directory is located the same way.
`--catalog` selects another local tree, and `eval --suite` another suite. No package is published
or promised to be independently distributable in this release.

## Repository layout

```text
skills/development/
  ai-agent-architect/{SKILL.md,references/agent-reliability.md}
  api-architect/{SKILL.md,references/contract-decisions.md}
  bug-investigator/{SKILL.md,references/experiment-record.md}
  code-auditor/{SKILL.md,references/reporting.md}
  database-architect/{SKILL.md,references/migration-safety.md}
  devops-engineer/{SKILL.md,references/delivery-checklist.md}
  nextjs-engineer/{SKILL.md,references/caching-and-rendering.md}
  performance-engineer/{SKILL.md,references/measurement-protocol.md}
  python-engineer/{SKILL.md,references/python-practices.md}
  react-engineer/{SKILL.md,references/state-and-rendering.md}
  security-reviewer/{SKILL.md,references/risk-rating.md}
  test-engineer/{SKILL.md,references/test-design.md}
  ui-architect/{SKILL.md,references/ui-review-checklist.md}
  documentation-engineer/{SKILL.md,references/document-types.md}
skills/meta/
  skill-creator/{SKILL.md,references/skill-format.md}
  skill-evaluator/{SKILL.md,references/evaluation-format.md}
  skill-optimizer/{SKILL.md,references/optimization-guide.md}
  skill-reviewer/{SKILL.md,references/review-checklist.md}
evals/
  <skill>/{suite.json,fixtures/,results/}   (five suites; no recorded results)
packages/
  core/src/{metadata,filesystem,catalog,adapters,evaluation,index}.ts
  validator/src/index.ts
  cli/src/{index,install,evaluation}.ts
tests/
  catalog.test.ts
  core.test.ts
  evaluation.test.ts
  validator.test.ts
  install.test.ts
  cli.test.ts
  helpers.ts
  fixtures/broken-reference/SKILL.md
docs/
  architecture.md
  getting-started.md
  creating-skills.md
  evaluating-skills.md
  compatibility.md
examples/engineering-workflows.md
.github/
  workflows/ci.yml
  ISSUE_TEMPLATE/{bug_report,skill_proposal}.md
  pull_request_template.md
  dependabot.yml
```

Root configuration supplies pnpm workspaces, strict TypeScript compilation,
ESLint, Prettier, and Vitest. NodeNext ESM packages import other packages through
workspace exports; pnpm builds them in dependency order. `typecheck` first builds
the workspace, then checks test types, so it works from a clean checkout without
preexisting declarations. Build output is ignored.

## Discovery and validation

A category tree contains skill directories named after globally unique skill
identifiers. Discovery stops at `SKILL.md`. Leaves without that file, or directories
containing resource folders without it, are validated as malformed skills rather
than silently discarded. Hidden category directories, `node_modules`, `dist`, and
`coverage` are skipped. Within a discovered skill all content is checked, including
hidden files. Validate the `skills/` catalog rather than the whole repository.

The catalog loader parses metadata and refuses duplicate identifiers or mismatched
folder names. Listing and info are read-only discovery operations, not full
validation. Installation performs full validation before creating its destination
and again on the staged tree.

Errors make `valid` false. Warnings leave `valid` true and require human review.
The CLI's `--strict` makes warnings fail the process without changing the meaning
of the JSON `valid` field. Unsupported portable fields, scripts, long or empty
bodies, experimental tool metadata, and unchecked fragments can produce warnings.

## Installation lifecycle

1. Validate exactly one local skill and canonicalize the chosen project/home base.
2. Calculate the adapter destination, reject overlap and linked components, and
   acquire an exclusive per-name lock under the destination skill root.
3. Refuse an existing non-directory or unsafe tree. Require explicit confirmation
   or `--force` before replacement.
4. Copy regular files into a private staging directory on the destination
   filesystem. Preserve content without executable or special permissions.
5. Validate the staged skill and recheck the destination.
6. On replacement, rename the old tree to a backup; rename the staged tree into
   place. Restore the old tree on handled publish failure.
7. Remove staging and release the lock. Preserve and identify the backup if
   rollback itself fails.

See [SECURITY.md](../SECURITY.md) for race, crash, cleanup, and recovery limitations.

## Evaluation

`evaluateSkill` loads `evals/<skill>/suite.json` with a strict schema, confirms
that every fixture stays inside the suite directory and passes the same link,
size, and portable-name limits as skills, and applies static assertions to files
of the skill. It then reads `results/*.json`, validates each run, resolves output
files inside the suite, and grades scenario assertions as plain substring checks.
No model, shell, or fixture content is executed. See
[evaluating skills](evaluating-skills.md) for the formats.

Suites live outside `skills/` so that installation never copies fixtures, which
may intentionally contain unsafe example content, into an agent's skill folder.

## Extension points

Add categories as populated directories. Add an agent by extending the adapter
and agent schema, documenting an official source, updating CLI choices, and
testing both scopes and failure behavior. Keep platform extensions out of portable
frontmatter; optional `agents/` files belong to the skill only when actually used.
Remote distribution would introduce new trust and provenance requirements and is
deliberately outside the current design.
