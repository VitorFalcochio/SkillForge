# Document type guide

Use the project's existing structure when it has one. These outlines help when
creating a document or checking one for gaps.

## README

1. What the project is and who it is for, in two or three sentences.
2. Current status and support boundaries, including what is not implemented.
3. Requirements with exact supported versions.
4. Installation from the supported source.
5. A quick start that runs as written.
6. Links to detailed guides, contribution, security, and license.

## CLI reference

For each command: synopsis, arguments, options with types and defaults, exit
codes, output format, examples with real output, and side effects such as files
written or network access. Derive option lists from the command's help output or
parser definition, not from memory.

## API reference

For each operation or public function: purpose, parameters and types, return
value, errors, authentication or permissions, limits, and an example request and
response. Generate from schemas or docstrings when the project does.

## Installation guide

Supported platforms, prerequisites, step-by-step commands per platform, how to
verify the installation, upgrade and uninstall steps, and the most common
installation failures with fixes.

## Architecture document

Components and their responsibilities, dependency direction, data flow for a
representative operation, external systems, trust boundaries, and the reasons for
key decisions. Keep diagrams consistent with the code layout they describe.

## Contributor onboarding

Environment setup, the command that runs all checks, repository layout, coding
and documentation conventions, how to propose changes, review expectations, and
where to ask questions.

## Troubleshooting entry

```text
Symptom: the exact message or behavior the reader sees
Cause: why it happens
Fix: the commands or steps that resolve it
Verify: how the reader confirms it is fixed
```

## Consistency checks

- Commands and options exist in the current help output.
- Version requirements match manifests and CI configuration.
- Defaults match code.
- The same fact is not maintained in several places with different values.
- Relative links and anchors resolve, and file paths exist.
- Status words such as “supported,” “experimental,” and “planned” match reality.

## Writing quality

Use short sentences, active voice, and the reader's vocabulary. Put the action
first in procedures, one action per step. Prefer specific statements with
numbers or names over adjectives. Remove text that does not help the reader
complete the task.
