# Compatibility and verification

Official documentation was checked on **October 15, 2026**. This file distinguishes
documented conventions, local test results, and work still requiring verification.

## Skill format

The catalog uses the [Agent Skills specification](https://agentskills.io/specification):
`SKILL.md` with YAML `name` and `description`, optional portable metadata, Markdown
instructions, and optional supporting resources. The validator enforces an ASCII
identifier subset and additional filesystem safety limits. It is not an official
conformance certification and does not implement every host extension.

Bundled skills use only `name`, `description`, and `license`, with no `allowed-tools`,
`agents/` configuration, or scripts. Their instructions describe actions such as
reading files, running the project's own commands, and inspecting a rendered UI
in host-neutral terms. Steps that depend on an optional capability, such as a
browser for rendered UI checks or database access, are conditional on that
capability and authorization being available.

Some guidance is version-sensitive. `nextjs-engineer` directs the agent to the
installed Next.js version's documentation, including docs bundled in
`node_modules/next/dist/docs/` where present; its reference summary was checked
against the official Next.js 16 upgrade guide on October 15, 2026.
`security-reviewer` maps findings to the OWASP Top 10:2025 categories.
`ai-agent-architect` names no specific models, prices, or SDK features and asks
the agent to confirm them in current provider documentation.

## Platform adapters

| Target       | Project root               | User root               | Evidence                                                                      |
| ------------ | -------------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| Claude Code  | `<project>/.claude/skills` | `<home>/.claude/skills` | [Official skill locations](https://code.claude.com/docs/en/skills)            |
| OpenAI Codex | `<project>/.agents/skills` | `<home>/.agents/skills` | [Official local skill discovery](https://learn.chatgpt.com/docs/build-skills) |

The adapters install `<name>/SKILL.md` beneath these roots. User scope uses Node's
`os.homedir()`. Codex's current documented portable user location is `.agents/skills`;
the adapter does not install into the older `.codex/skills` convention or select a
different location based on `CODEX_HOME`. Claude's managed, plugin, nested, cloud,
and account-synced skill mechanisms are outside this installer's scope.

Project scope chooses the exact current directory or `--project` directory; it
does not find a repository root. The hosts' own ancestor discovery rules still
apply after installation. OpenAI documents explicit `$skill-name` invocation and
implicit description matching; Claude Code documents `/skill-name` and implicit
matching. Live refresh behavior follows the installed host's version.

Both hosts document support for some symlinked skill layouts. AgentSkills rejects
symlinks and junctions in source trees and below destination bases as a deliberate
filesystem safety policy. Files are copied as content, with `0644` mode where
supported, rather than preserving executable or special permission bits.

## Agent adapters

| Target       | Project file                        | User file                        | Evidence                                                                                            |
| ------------ | ----------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Claude Code  | `<project>/.claude/agents/<id>.md`  | `<home>/.claude/agents/<id>.md`  | [Official subagent documentation](https://code.claude.com/docs/en/sub-agents)                       |
| OpenAI Codex | `<project>/.codex/agents/<id>.toml` | `<home>/.codex/agents/<id>.toml` | [Official custom agent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) |

Both were checked on October 15, 2026. The formats differ: Claude Code supports a
tool allowlist and skill preloading; Codex agent files inherit sandbox, approval,
and MCP settings from the parent session, can disable the shell tool, and have no
skill attachment field. See [agents](agents.md) for the full matrix. Generated
files were checked by parsing them (YAML frontmatter and TOML) in local tests and
manual checks; live delegation in either host has not been exercised.

## What has been verified locally

- Workspace dependency installation and strict TypeScript compilation on Windows
  using Node.js 24.12.0 and pnpm 10.20.0.
- Automated tests for path adapters, validation, both installation scopes, conflict
  refusal and confirmation, staged replacement, rollback, lock contention, traversal,
  and junction rejection in temporary directories.
- The compiled CLI's help, version, catalog, info, validation, project installation,
  custom local catalog, and failure exit behavior from an unrelated working directory.
- All eighteen bundled skills pass strict catalog validation without warnings.
  Catalog tests check their metadata, required sections, and reference links,
  and install every skill for both agents into an isolated project.

See [the implementation report](implementation-report.md) for final check results.

## What is configured or pending

| Check                                                          | Status                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Windows with Node.js 24                                        | Executed locally                                                       |
| Linux/macOS with Node.js 22/24; Windows with Node.js 22        | GitHub Actions matrix configured; not executed from this local session |
| Real Claude Code discovery and workflow execution              | Not executed                                                           |
| Real Codex discovery and workflow execution                    | Not executed                                                           |
| Live subagent delegation in Claude Code or Codex               | Not executed; generated files and installation are tested              |
| npm package distribution and independent packed installation   | Not implemented; source workspace packages remain private              |
| Other agents, remote catalogs, plugins, or hosted distribution | Not implemented                                                        |

Do not infer verified host behavior from a successful file copy. To expand the
compatibility claim, install into an isolated project, record the exact agent
version and OS, confirm discovery, invoke a representative task, and inspect its
actions and verification. Review changes in official discovery rules before
updating an adapter.
