# Contributing to AgentSkills

Contributions should make skills more useful, installation safer, or maintenance
easier. Start with a concrete task or reproducible failure.

## Set up

Use Node.js 24 LTS or 22.14+ LTS and pnpm 10.20.0. Then run:

```sh
pnpm install --frozen-lockfile
pnpm check
```

The lockfile is part of the project. Keep it synchronized with dependency changes.
Do not enable dependency lifecycle scripts to resolve an unexplained failure;
investigate the dependency and document any actual requirement first.

## Propose a change

For a bug, include the command, environment, expected result, actual result, and
minimal reproduction with secrets removed. For a new feature or platform, explain
the use case and how it fits the existing package boundaries. Large changes
benefit from an issue describing the tradeoffs before implementation.

Pull requests should explain the behavior change and its validation. Keep changes
focused, preserve unrelated work, and update documentation when commands or
diagnostics change. Every implemented feature needs a meaningful test, including
failure behavior when applicable. Do not claim agent compatibility from filesystem
tests alone.

## Contribute a skill

Follow [creating skills](docs/creating-skills.md). Include a precise activation
description, repeatable workflow, inputs and outputs, constraints, verification
criteria, and a realistic example. Add supporting resources only when they add
useful detail. Keep host-specific configuration out of portable metadata.

Validate the entire catalog to catch duplicate identifiers, and run the skill's
evaluation suite if it has one:

```sh
pnpm build
pnpm agentskills validate skills --strict
pnpm agentskills eval skill-reviewer
```

New skills should include an evaluation suite under `evals/` with static checks
for their critical constraints; see [evaluating skills](docs/evaluating-skills.md).
Recorded results must come from real runs and state the agent, model, and skill
revision. Never submit estimated or invented results. The `skill-creator`,
`skill-reviewer`, `skill-optimizer`, and `skill-evaluator` skills can guide this work.

Review every instruction, script, and bundled asset as untrusted content. Explain
script dependencies and test scripts in isolation if adding them. Do not bundle
secrets, proprietary examples, generated dependency trees, or unlicensed content.
Contributions are provided under the repository's MIT license unless an explicitly
reviewed compatible asset license says otherwise.

## Review expectations

Maintainers review contributed skills as untrusted content: they read every file
as text and never execute contributed scripts during review. The checklist in the
`skill-reviewer` skill describes what is flagged.

Run `pnpm check` before opening a pull request. Tests create and remove only
isolated temporary trees; they do not install skills into your real agent folders.
Report any check you cannot execute. Hosted CI is configured for Windows, macOS,
and Linux on both supported Node.js major versions.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of posting exploit
details publicly. All interactions follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
