# Evaluating skills

Structural validation shows that a skill is well formed. Evaluation asks whether
it changes an agent's behavior in the intended way. AgentSkills separates the
two kinds of evidence:

| Kind            | Examples                                                          | Produced by                   | Reproducible       |
| --------------- | ----------------------------------------------------------------- | ----------------------------- | ------------------ |
| Deterministic   | Validator results, static checks of skill text, graded assertions | The CLI, from files on disk   | Yes                |
| Model-dependent | What an agent did and wrote when given a scenario                 | A person running a host agent | Only statistically |

The `eval` command handles only the deterministic part. It never starts an agent,
calls a model API, runs a shell, or executes fixture content. Agent runs are
performed separately and recorded as files that the command then grades.

## Layout

Suites live outside the installable skill, so fixtures are never copied into an
agent's skill folder:

```text
evals/
  skill-reviewer/
    suite.json            scenarios, static checks, assertions, rubrics
    fixtures/             synthetic inputs referenced by scenarios
    results/              optional recorded runs
      <run-id>.json
      outputs/...         optional recorded output files
```

Bundled suites exist for `documentation-engineer`, `skill-creator`,
`skill-evaluator`, `skill-optimizer`, and `skill-reviewer`. No results are
recorded in the repository yet, so no effectiveness claim is made for any skill.

## Suite format

`suite.json` is strict JSON; unknown fields are rejected.

| Field                    | Meaning                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `version`                | Must be `1`                                                                                       |
| `skill`                  | Target skill identifier; must match the suite directory and a catalog skill                       |
| `static`                 | Optional checks with `id`, a skill-relative `file`, and an `assertion`, evaluated without a model |
| `scenarios[].id`         | Unique lowercase hyphenated identifier                                                            |
| `scenarios[].prompt`     | The request given to the agent                                                                    |
| `scenarios[].fixtures`   | Optional paths inside the suite directory, files or directories                                   |
| `scenarios[].expected`   | Observable outcomes written for people                                                            |
| `scenarios[].assertions` | Deterministic checks graded against recorded output                                               |
| `scenarios[].rubric`     | Optional manual criteria with a `scale`; scenarios need assertions, a rubric, or both             |

Assertions are `contains`, `not-contains`, and `contains-any` (with `values`).
Matching ignores case unless `ignoreCase` is `false` and treats whitespace runs
as single spaces. Regular expressions are deliberately unsupported so that
contributed suites cannot supply expensive patterns.

Static checks are useful for protecting constraints. For example, the
`skill-reviewer` suite fails if “Never execute contributed scripts” disappears
from its `SKILL.md`, which guards against an optimization that drops the rule.

## Recording a run

1. Install the skill into a fresh, isolated test project, or leave it absent for
   a `baseline` run. Copy the scenario fixtures into that project. Never use
   production systems, real credentials, or real user data.
2. Give the agent the scenario prompt. Save its final response verbatim, for
   example under `results/outputs/<run-id>/<scenario-id>.md`.
3. Record wall time, tokens, and cost only if the host reports them.
4. Write `results/<run-id>.json`:

```json
{
  "version": 1,
  "skill": "skill-reviewer",
  "runId": "2026-10-20-claude-with-skill-1",
  "recordedAt": "2026-10-20T14:00:00Z",
  "condition": "with-skill",
  "agent": "the host name and version",
  "model": "the model identifier the host reports",
  "skillRevision": "commit SHA or content hash",
  "scenarios": [
    {
      "id": "flags-remote-execution",
      "outputFile": "outputs/2026-10-20-claude-with-skill-1/flags-remote-execution.md",
      "durationMs": 41250,
      "manualScores": { "Evidence quality": 2 }
    }
  ]
}
```

The file name must equal `runId`. Each scenario provides exactly one of `output`
or `outputFile`; output files must stay inside the suite directory. Scenarios not
listed are reported as not run. Totals are shown only when every recorded
scenario has the metric.

## Running the command

```sh
pnpm agentskills eval skill-reviewer
pnpm agentskills eval skill-reviewer --json
pnpm agentskills eval code-auditor --suite "/path/to/suite"
```

Output lists static checks, then each recorded run with pass, fail, manual, and
not-run counts. The exit code is 1 when the suite or a result file is invalid,
or when a static check fails. Failing assertions in recorded runs are reported
but do not change the exit code, because a baseline run is expected to fail some
scenarios. Read failing outputs before concluding; a text assertion is a proxy
for the expected outcome, not a full judgment.

The automated test suite loads every bundled suite and requires its static checks
to pass, so `pnpm check` protects them without credentials or network access.

## Comparing runs

Record runs with the same host, model, prompts, and fixtures. Compare
`with-skill` and `baseline` runs, and current and previous skill revisions, per
scenario. Report sample sizes, and treat small differences as inconclusive. The
`skill-evaluator` skill describes the full protocol.

## Limitations

- Producing agent output is manual; there is no runner that drives Claude Code or
  Codex, and no model-based grader.
- Text assertions can pass for the wrong reason or fail on valid wording. Rubrics
  and human review remain necessary for quality judgments.
- Suites are not yet defined for the original thirteen skills.
- Fixtures are synthetic. They exercise specific behaviors and do not represent
  the full distribution of real tasks.
