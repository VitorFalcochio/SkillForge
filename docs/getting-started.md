# Getting started

## Build the local CLI

Install Node.js 24 LTS or 22.14+ LTS and pnpm 10.20.0. From this checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm agentskills list
```

There is no published npm distribution for this initial release. The pnpm script
launches the executable declared by `packages/cli`. An optional global source link
is described in the [README](../README.md).

## Inspect and validate

```sh
pnpm agentskills info api-architect
pnpm agentskills validate skills
pnpm agentskills validate skills/development/api-architect --strict --json
```

`info` prints the metadata, source directory, and full workflow. It does not run
the workflow or imply the skill passed full validation. `validate` accepts one
skill directory or a directory of categories. A file path is not accepted.

Check a skill's evaluation suite and grade any recorded runs:

```sh
pnpm agentskills eval skill-reviewer
pnpm agentskills eval skill-reviewer --json
```

`eval` runs only deterministic checks. It does not start an agent or call a
model; see [evaluating skills](evaluating-skills.md) for recording runs.

Default validation fails on errors and reports warnings separately. `--strict`
also returns exit code 1 for warnings. `--json` prints the result on stdout;
`valid` means there are no structural errors even when strict mode fails because
of warnings. Diagnostics contain source paths, codes, messages, and line numbers
for Markdown references when available. Validation performs no network requests.

## Install a reviewed skill

```sh
pnpm agentskills install code-auditor --agent claude
pnpm agentskills install bug-investigator --agent codex --scope user
pnpm agentskills install api-architect --agent codex --project "/path/to/project"
```

`--agent` is required and accepts `claude` or `codex`. `--scope` accepts `project`
(default) or `user`. Project scope uses the exact existing directory selected by
`--project`, which defaults to the current directory; it does not search for a Git
root. User scope uses `os.homedir()` and ignores the project path. The base directory
must exist. No real user skill folders are touched by the automated tests.

On Windows, quote paths with spaces:

```powershell
pnpm agentskills install code-auditor --agent claude --project "E:\Projects\my app"
```

Before replacement, the CLI prompts in an interactive terminal. The default
answer is no. In noninteractive use, explicitly authorize replacement:

```sh
pnpm agentskills install code-auditor --agent claude --force
```

This replaces the entire previous tree and removes personal additions. Installation
does not execute scripts and copies files with `0644` permissions where supported;
invoke a reviewed script with its interpreter if necessary.

## Install an agent

```sh
pnpm agentskills agents list
pnpm agentskills agents info code-reviewer --platform claude
pnpm agentskills agents install code-reviewer --platform claude --with-skills
pnpm agentskills agents install code-reviewer --platform codex --scope user
```

Review the printed warnings: they list restrictions the platform cannot fully
enforce and related skills that are missing. See [agents](agents.md).

## Use a different local catalog

```sh
pnpm agentskills --catalog "/path/to/local-skills" list
pnpm agentskills --catalog "/path/to/local-skills" info example-skill
pnpm agentskills --catalog "/path/to/local-skills" install example-skill --agent codex
```

The catalog must already exist on disk. URLs, remote repositories, and archives
are not supported sources. The default catalog is located relative to the built
CLI, so it works even when you run a linked executable from another directory.

## Use the installed workflow

In Codex CLI or its IDE extension, select the skill from `/skills` or invoke
`$bug-investigator` in a request. In Claude Code, invoke `/code-auditor` with a
scoped task. The hosts can also select skills implicitly using their descriptions.
These invocation mechanisms are described by [OpenAI](https://learn.chatgpt.com/docs/build-skills)
and [Claude Code](https://code.claude.com/docs/en/skills); they have not been exercised
in live agent sessions by this repository's tests. Follow the host documentation
for refresh or restart behavior if a new skill does not appear.

## Troubleshooting

- **`pnpm` is missing:** install the pinned version through Corepack or your package
  manager. With Corepack, `corepack pnpm` can be used without global shims, but
  ensure pnpm is also available to package scripts.
- **Missing `dist` modules:** run `pnpm build`. The executable runs compiled output.
- **Symlink or junction rejected:** use a physical source path. Installation
  canonicalizes the chosen project/home base, then rejects linked paths below it.
  The installer intentionally accepts fewer layouts than the target agents.
- **`EEXIST` on `.agentskills-<name>.lock`:** another installation may be active.
  See [security recovery instructions](../SECURITY.md) before removing a stale lock.
- **No disk space in system temporary storage:** tests redirect their temporary
  storage to ignored `.tmp/` under the checkout. Ensure the workspace volume has
  space. Builds and dependencies also require available disk space.
- **An agent cannot find the installed skill:** check its version, selected scope,
  and official discovery documentation. Filesystem success alone is not a live
  compatibility test; see [compatibility](compatibility.md).
