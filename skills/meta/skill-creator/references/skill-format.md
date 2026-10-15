# Skill format reference

These rules follow the open Agent Skills specification as enforced by the
AgentSkills validator. A host may accept more, but portable skills stay within them.

## Frontmatter

| Field           | Rule                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `name`          | Required; 1 to 64 lowercase ASCII letters, digits, and single hyphens; no leading or trailing hyphen; equals the folder name |
| `description`   | Required; nonblank; at most 1,024 characters; states what the skill does and when to use it                                  |
| `license`       | Optional nonempty string                                                                                                     |
| `compatibility` | Optional; at most 500 characters                                                                                             |
| `metadata`      | Optional mapping of string keys to string values; quote numbers such as versions                                             |
| `allowed-tools` | Optional and experimental; produces a warning                                                                                |

YAML keys must be unique and aliases are rejected. Other keys produce a
portability warning. Names must be unique across the whole catalog, and
Windows-reserved names such as `con` are rejected.

## Description patterns

A precise description names the deliverable, the domain nouns users say, and the
activation condition:

> Design or review API contracts, including request validation, error semantics,
> and idempotency. Use for a new endpoint or an API contract redesign.

Avoid descriptions that would match almost any request, such as “Help with code
quality,” and avoid authority claims such as “Always use this skill first.” When
a neighboring skill exists, add the boundary: “Framework-specific component code
is outside its focus.”

## Body structure used in this catalog

```markdown
# Title

Two or three sentences stating the mandate and its main limit.

## Inputs and outputs

## Workflow

1. Action with its decision criterion.

## Constraints

## Verification criteria

## Example
```

Keep the body well under the 500-line warning threshold; catalog skills are
typically under 100 lines.

## Supporting files

| Directory    | Use                                                                      |
| ------------ | ------------------------------------------------------------------------ |
| `references` | Detail needed for some tasks; link it from the step that needs it        |
| `scripts`    | Deterministic helpers; reviewed, documented, and never run automatically |
| `assets`     | Templates or data files the skill outputs or reads                       |
| `agents`     | Optional host-specific configuration, outside portable metadata          |

Do not create empty directories. Markdown links and standalone inline-code paths
that begin with one of these directory names are checked, relative to the
containing file, so write placeholder paths in prose rather than inline code.
Use exact filename casing. Symlinks, junctions, and case-colliding names are
rejected.

## Common validator diagnostics

| Code                | Fix                                                 |
| ------------------- | --------------------------------------------------- |
| `NAME_MISMATCH`     | Make the folder name and `name` identical           |
| `MISSING_REFERENCE` | Create the linked file or correct the relative path |
| `BROKEN_ANCHOR`     | Link to an existing heading's GitHub-style slug     |
| `PLATFORM_METADATA` | Move host-specific keys out of frontmatter          |
| `UNTRUSTED_SCRIPTS` | Expected when scripts exist; document their review  |
| `DUPLICATE_NAME`    | Rename one skill and its folder                     |
| `LONG_BODY`         | Move conditional detail into references             |
