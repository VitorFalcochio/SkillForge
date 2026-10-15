# Agents

AgentSkills includes eight specialized software engineering agents. Each agent is
defined once in a portable manifest and generated into the configuration format
of Claude Code or OpenAI Codex at installation time.

## Agents and skills

| Aspect        | Skill                                    | Agent                                                            |
| ------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| Purpose       | A reusable workflow for one kind of task | A delegated role with responsibilities, tool limits, and outputs |
| Runs in       | The current conversation when selected   | A separate subagent context that the main session delegates to   |
| Source format | `SKILL.md` (Agent Skills specification)  | `agents/<id>/agent.yaml` (AgentSkills manifest)                  |
| Installed as  | The same directory, copied               | A generated platform file                                        |
| Tool limits   | None in portable metadata                | Allowed tool categories and critical restrictions                |

Agents build on skills. For example, `security-auditor` relies on the
`security-reviewer` skill for its workflow and adds a role, tool boundaries, and
output expectations.

## Catalog

| Agent                 | Responsibilities                                                         | Related skills                                          | Tools                          | Critical restrictions |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------ | --------------------- |
| `software-architect`  | Architecture analysis, boundaries, trade-offs, plans, scalability risks  | api-architect, database-architect, performance-engineer | read, search, web              | edit, shell           |
| `frontend-specialist` | Frontend architecture, accessible components, responsive UI, performance | ui-architect, react-engineer, nextjs-engineer           | read, search, edit, shell, web | none                  |
| `backend-specialist`  | Services, APIs, validation and errors, database integration, tests       | api-architect, python-engineer, database-architect      | read, search, edit, shell      | none                  |
| `security-auditor`    | Defensive security review, authn/authz, dependencies, remediation        | security-reviewer                                       | read, search, shell            | edit, web             |
| `qa-engineer`         | Test strategy, automated tests, failure investigation, flaky tests       | test-engineer, bug-investigator                         | read, search, edit, shell      | none                  |
| `devops-specialist`   | Pipelines, containers, deployment reliability, observability, rollback   | devops-engineer                                         | read, search, edit, shell      | none                  |
| `ai-engineer`         | AI features, tool calling, structured outputs, cost, evaluation          | ai-agent-architect                                      | read, search, edit, shell, web | none                  |
| `code-reviewer`       | Change review for correctness, maintainability, and regressions          | code-auditor, performance-engineer                      | read, search, shell            | edit                  |

Constraints that no platform can enforce, such as “never deploy without
authorization” or “no destructive security tests,” are part of every generated
instruction set. They depend on the model following them and on your own
permission settings.

## Commands

```sh
pnpm agentskills agents list
pnpm agentskills agents info security-auditor
pnpm agentskills agents info security-auditor --platform codex
pnpm agentskills agents validate agents --strict
pnpm agentskills agents install security-auditor --platform claude
pnpm agentskills agents install security-auditor --platform codex --with-skills
pnpm agentskills agents install code-reviewer --platform claude --scope user
```

`info --platform` prints the exact file that installation would write, so you can
review it first. `install` accepts `--scope project` (default) or `user`,
`--project` for another existing project directory, `--with-skills` to install
missing related skills, and `--force` to replace an existing agent file.

| Platform    | Project destination                 | User destination                 |
| ----------- | ----------------------------------- | -------------------------------- |
| Claude Code | `<project>/.claude/agents/<id>.md`  | `<home>/.claude/agents/<id>.md`  |
| Codex       | `<project>/.codex/agents/<id>.toml` | `<home>/.codex/agents/<id>.toml` |

With `--with-skills`, missing related skills are installed into the platform's
skill directory at the same scope (`.claude/skills` or `.agents/skills`). Skills
already present at project or user scope are reported and never replaced.
Without the flag, missing skills are reported as a warning.

An existing agent file is replaced only after interactive confirmation or with
`--force`. Installation also refuses when another file in the destination
directory already declares the same agent name, because both platforms would
load only one of them.

## Platform compatibility

Checked against the official documentation on October 15, 2026:
[Claude Code subagents](https://code.claude.com/docs/en/sub-agents) and
[Codex custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

| Feature                | Claude Code                                                   | Codex                                                                            |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Generated format       | Markdown with `name`, `description`, `tools`, `skills`        | TOML with `name`, `description`, `developer_instructions`, optional `[features]` |
| Instructions           | File body                                                     | `developer_instructions`                                                         |
| Tool allowlist         | `tools`; unlisted tools, including MCP tools, are unavailable | Not available                                                                    |
| Shell restriction      | Enforced by omitting `Bash`                                   | Enforced with `features.shell_tool = false`                                      |
| Edit restriction       | Enforced without shell; partial with shell                    | Instruction only                                                                 |
| Web restriction        | Enforced without shell; partial with shell                    | Instruction only                                                                 |
| Sandbox and approvals  | Inherited from the session permission mode                    | Inherited from the parent session; cannot be set in the agent file               |
| Related skills         | Preloaded through `skills`                                    | Named in instructions; must be installed; not preloaded                          |
| Project and user scope | Supported                                                     | Supported                                                                        |

“Partial” means the dedicated tools are removed, but an allowed shell could still
modify files or reach the network; shell commands remain subject to your Claude
Code permission settings. For Codex review agents, run the parent session with a
read-only sandbox, because the agent file cannot impose one.

The adapters do not set models, permission modes, hooks, MCP servers, or reasoning
effort. Those settings are left to the user and the parent session.

## Manifest format

```yaml
version: 1
id: code-reviewer # must equal the folder name
name: Code Reviewer
description: What the agent does. Use when ... # used for delegation
responsibilities: [...]
activation: [...] # when to delegate to this agent
capabilities: [read, search] # tool categories the agent needs; subset of tools
tools: [read, search, shell] # allowed categories: read, search, edit, shell, web
restrictions: [edit] # critical denials; must not appear in tools
skills: [code-auditor, performance-engineer]
instructions: |
  Role-specific working method.
constraints: [...]
outputs: [...]
verification: [...]
platforms:
  claude:
    unenforced: [edit] # acknowledges that Claude enforces this only partially here
  codex:
    unenforced: [edit]
```

Unknown fields are rejected. Each platform key must have an adapter. For every
critical restriction that a platform cannot fully enforce, the author must list
it under that platform's `unenforced`; otherwise validation fails. This prevents
a restriction from being dropped silently, and installation prints a warning for
each acknowledged gap.

## Validation

`agents validate` accepts one agent directory or a directory of agents and
resolves related skills against the skill catalog selected with `--catalog`.

| Code                      | Meaning                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `AGENT_YAML`              | Invalid YAML, duplicate keys, or aliases                             |
| `AGENT_SCHEMA`            | Missing or invalid required metadata, or an unknown field            |
| `ID_MISMATCH`             | `id` differs from the folder name                                    |
| `DUPLICATE_AGENT`         | Two manifests declare the same `id`                                  |
| `MISSING_MANIFEST`        | A folder has no `agent.yaml`                                         |
| `NO_AGENTS`               | The target contains no agent directories                             |
| `INVALID_TOOL`            | A capability is not granted, or a restriction is also granted        |
| `DUPLICATE_ENTRY`         | A list repeats a value                                               |
| `MISSING_SKILL`           | A related skill is not in the skill catalog                          |
| `SKILL_CATALOG`           | The skill catalog could not be loaded to check related skills        |
| `UNSUPPORTED_PLATFORM`    | A platform has no adapter                                            |
| `NO_PLATFORM`             | No platform is declared                                              |
| `UNENFORCED_RESTRICTION`  | A critical restriction is not fully enforceable and not acknowledged |
| `STALE_ACKNOWLEDGEMENT`   | An acknowledgement does not match an actual enforcement gap          |
| `UNEXPECTED_FILE`         | Warning: a file other than `agent.yaml` is present and unused        |
| `DISCOVERY`, `FILESYSTEM` | Links, junctions, special files, or limits violated                  |

Validation parses manifests as data. It never executes instructions or files.

## Creating an agent

1. Confirm that a skill alone is not enough. An agent is useful when a task
   benefits from a separate context, a distinct role, and narrower tools.
2. Create `agents/<id>/agent.yaml` with the fields above. Keep `instructions` to
   the role's working method; put reusable procedures in a skill and list it.
3. Grant the fewest tool categories that let the agent finish its work, and list
   denials that matter for safety as `restrictions`.
4. Run `pnpm agentskills agents validate agents --strict`, then acknowledge any
   reported enforcement gap only if the agent is still acceptable with it.
5. Review the generated files with `agents info <id> --platform claude` and
   `--platform codex`.
6. Add a row to the catalog above and to the README, and run `pnpm check`.

## Security considerations

- Manifests are untrusted input: strict schemas, size limits, identifier rules,
  and link and junction rejection apply. Agent directories contain no scripts,
  and nothing in them is executed.
- Generated files never grant unrestricted access by default. Claude agents get
  an explicit tool allowlist, so tools not listed, including MCP tools, are not
  available. Codex agents inherit the parent session's sandbox and approvals,
  which the generated file states.
- Installation canonicalizes the project or home base, rejects links and
  junctions below it, writes only inside the platform's agent directory, refuses
  name conflicts, and replaces a file only with explicit authorization. Related
  skills installed with `--with-skills` use the existing validated skill installer.
- Restrictions that are partial or instruction-only are reported by `agents info`,
  printed during installation, and written into the agent's instructions.
- Generated instructions are only as safe as the model following them. Use your
  platform's permission settings as the enforcing boundary.

## Limitations

- Live discovery and delegation in Claude Code and Codex have not been exercised
  by this repository's tests; tests check generated files and installation only.
- Codex name rules beyond “a string” are not documented; the adapters use the
  lowercase hyphenated identifier. A community report describes custom agents
  rejected by one Codex desktop build, so confirm discovery in your version.
- Claude Code scans agent directories recursively, but the name-conflict check
  inspects only files directly in the destination directory.
- `CODEX_HOME` and Claude managed or plugin agent locations are not used.
- There is no orchestration between agents; each platform decides delegation.
