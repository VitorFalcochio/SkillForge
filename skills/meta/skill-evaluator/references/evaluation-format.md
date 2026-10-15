# Evaluation format reference

AgentSkills stores suites outside the installable skill, at `evals/` followed by
the skill name, so evaluation fixtures are never copied into an agent's skill
folder. Other catalogs may use their own format; keep the same information.

## Suite file

The suite directory contains `suite.json`, optional fixtures, and optional
recorded results.

```json
{
  "version": 1,
  "skill": "skill-reviewer",
  "static": [
    {
      "id": "keeps-no-execution-rule",
      "file": "SKILL.md",
      "assertion": {
        "type": "contains",
        "value": "Never execute contributed scripts"
      }
    }
  ],
  "scenarios": [
    {
      "id": "flags-remote-execution",
      "description": "A contributed skill downloads and runs a remote script.",
      "prompt": "Review the contributed skill in fixtures/remote-installer.",
      "fixtures": ["fixtures/remote-installer"],
      "expected": ["Flags the download-and-execute command as blocking"],
      "assertions": [{ "type": "contains", "value": "example.invalid" }],
      "rubric": [
        {
          "criterion": "Actionable fix",
          "scale": "0 none, 1 vague, 2 concrete"
        }
      ]
    }
  ]
}
```

Assertion types are `contains`, `not-contains`, and `contains-any` with a
`values` list. Matching ignores case unless `ignoreCase` is false, and treats
any whitespace run as one space. Static checks apply an assertion to a file of
the skill, so they run without a model; use them to keep important constraints
from being removed. Fixture paths must stay inside the suite directory.

## Result file

Each run is recorded in the suite's `results` directory as a JSON file whose
name equals its `runId`. Outputs may be inline or stored in files relative to
the results directory.

```json
{
  "version": 1,
  "skill": "skill-reviewer",
  "runId": "2026-10-15-claude-with-skill-1",
  "recordedAt": "2026-10-15T14:00:00Z",
  "condition": "with-skill",
  "agent": "Claude Code 2.x",
  "model": "the model identifier reported by the host",
  "skillRevision": "commit or content hash",
  "scenarios": [
    {
      "id": "flags-remote-execution",
      "outputFile": "outputs/run-1/flags-remote-execution.md",
      "durationMs": 41250,
      "manualScores": { "Actionable fix": 2 }
    }
  ]
}
```

`condition` is `with-skill` or `baseline`. `durationMs`, `costUsd`,
`inputTokens`, and `outputTokens` are optional and must come from measurement;
totals are reported only when every recorded scenario has the value.

## Scenario design

- Cover the main task, an edge case, a request that should not activate the
  skill, and a request that tempts a constraint violation.
- Keep fixtures small, synthetic, and free of secrets or real personal data.
- Express expected outcomes as observable facts, not impressions.
- Prefer assertions on stable facts, such as a file name or identifier the
  output must mention, over exact wording.
- A failing assertion is evidence to inspect, not an automatic verdict; read the
  output before concluding.

## Report template

```text
Skill and revision:
Question:
Deterministic checks: validator result, static checks
Protocol: host, model, samples per scenario, isolation
Results by scenario: with skill, baseline, previous revision
Regressions:
Cost and latency: measured values only
Not run or not measured:
Limitations:
```
