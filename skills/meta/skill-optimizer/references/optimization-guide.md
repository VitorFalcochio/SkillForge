# Optimization guide

## Measurement

Use the same commands before and after, and report them with the numbers.

| Measure | POSIX shell      | PowerShell                                                |
| ------- | ---------------- | --------------------------------------------------------- |
| Lines   | `wc -l SKILL.md` | `(Get-Content SKILL.md).Count`                            |
| Words   | `wc -w SKILL.md` | `((Get-Content SKILL.md -Raw) -split '\s+' -ne '').Count` |
| Bytes   | `wc -c SKILL.md` | `(Get-Item SKILL.md).Length`                              |

Bytes and words approximate context cost but are not tokens. Report token counts
only when a specific tokenizer was run, and name it. Always-loaded cost is the
frontmatter description for every session plus `SKILL.md` when activated;
references cost context only when read.

## Common problems and fixes

| Problem                          | Example                                     | Fix                                                           |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Vague instruction                | “Handle errors appropriately.”              | State the decision: which errors to retry, report, or stop on |
| Generic advice                   | “Write clean, maintainable code.”           | Remove, or replace with a project-specific criterion          |
| Duplicate statements             | The same rule in a step and in constraints  | Keep it where it governs a decision; reference it once        |
| Always-loaded conditional detail | A long tutorial used only for one task type | Move to a reference linked from that step                     |
| Unlinked reference               | A reference file no step mentions           | Link it where needed, or delete it with authorization         |
| Broad activation                 | “Use for any coding task.”                  | Name the task, artifacts, and conditions                      |
| Narrow activation                | Misses words users actually say             | Add the user vocabulary seen in real requests                 |
| Overlap                          | Two skills match the same request           | Add an explicit boundary to both descriptions                 |
| Missing stop condition           | “Iterate until done.”                       | Define done and when to ask the user                          |

## What must not move

Constraints, authorization gates, and data-handling rules stay in `SKILL.md`. A
reference may elaborate on a gate but never be its only location, because an
agent may never read the reference.

## Report template

```text
Skill and revision:
Behavior contract: item | preserved, or changed with authorization
Measurements (method): before | after for each file
Validator: before | after
Evaluation: static checks, recorded runs, or not run
Changes: wording and structure | activation | behavior (approved or proposed)
Unverified:
```
