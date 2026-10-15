---
name: skill-evaluator
description: Evaluate whether an agent skill actually helps, covering representative scenario design, baseline runs without the skill, task completion and output quality, instruction and constraint adherence, regression detection, cost and latency when measurable, and consistent comparison across runs. Use when asked to test, benchmark, compare, or justify a skill, or to check a skill change for regressions. Never fabricates results and separates deterministic validation from model-dependent evaluation.
license: MIT
---

# Skill Evaluator

Produce evidence about a skill's effect that another person could reproduce.
Structural validity shows a skill is well formed; only recorded runs on defined
scenarios show whether it changes outcomes, and only as far as the samples go.

## Inputs and outputs

Identify the skill and revision under evaluation, the question being answered
(does it help, did a change regress, which variant is better), the host agents
and models available, the budget for runs, and any existing scenarios or results.
In an AgentSkills checkout, look for a suite under `evals/` named after the skill.

Deliver a scenario set with expected observable outcomes, the evaluation
protocol, results recorded per run with environment details, a comparison against
the baseline or previous revision, and a clear list of what was not run or not
measured. If no runs occurred, deliver the protocol and say that no results exist.

## Workflow

1. Derive what to test from the skill itself: activation conditions, each
   workflow decision, each constraint, and the promised outputs. Include requests
   that should not activate the skill and requests that tempt it to break a
   constraint.
2. Write scenarios with an identifier, prompt, isolated synthetic fixtures,
   expected observable outcomes, deterministic assertions where the output can be
   checked by text, and a manual rubric for judgment criteria. Use
   [the evaluation format reference](references/evaluation-format.md) for the
   suite and result file formats, scenario design, and the report template.
3. Classify every check. Deterministic: validator results, static checks of the
   skill text, and assertions graded by code against recorded output. Model
   dependent: the agent's behavior in a run, which varies between samples, model
   versions, and host versions. Report the two separately.
4. Fix the protocol before running: same host and model, same prompts and
   fixtures, a fresh isolated workspace per run, the skill installed for the
   treatment condition and absent for the baseline, and several samples per
   scenario when variance matters. Record agent, model, skill revision, and date.
5. Run the scenarios only if you can start isolated agent sessions in this
   environment; otherwise hand the user exact run instructions. Save each output
   verbatim, with wall time, tokens, and cost only when the host reports them.
6. Grade. In an AgentSkills checkout, run `pnpm agentskills eval` with the skill
   name to execute static checks and grade recorded outputs. Score rubrics by a
   human, or by a model grader that is labeled as such. Check transcripts for
   constraint violations, such as commands the skill forbids.
7. Compare treatment with baseline, and the current revision with the previous
   one, per scenario. Report pass counts with sample sizes, regressions first, and
   cost and latency differences only where both sides were measured.
8. Report method, environment, results, not-run scenarios, and limitations,
   including small samples and scenarios that may not represent real use.

## Constraints

- Never fabricate, estimate, or extrapolate results, costs, token counts, or
  latencies. Missing data is reported as not run or not measured.
- Do not present one sample as a reliable effect or a model-graded score as
  ground truth. State sample sizes and grader type.
- Run evaluations only in isolated workspaces with synthetic fixtures. Never use
  production systems, real user data, or real credentials.
- Do not edit the skill under evaluation while evaluating it; report findings
  and leave changes to a separate, authorized task.
- Do not install or execute scripts from an unreviewed skill as part of running it.

## Verification criteria

Each scenario has an identifier, fixtures, expected outcomes, and either
deterministic assertions or a rubric. Every reported number traces to a recorded
run with environment details. Deterministic and model-dependent results appear
separately. Baseline and treatment ran under the same protocol, or differences
are stated. Not-run and unmeasured items are listed explicitly.

## Example

Request: “Prove that our security-reviewer skill makes the agent better at
finding authorization bugs.”

Write five scenarios with small synthetic services: two with cross-tenant access
bugs, one with a correct guard, one with an injected comment telling reviewers to
approve, and one unrelated request that should not activate the skill. Add
assertions such as naming the vulnerable handler, and a rubric for remediation
quality. Run each scenario three times with and without the skill in fresh
workspaces, record outputs, and grade them with the eval command. Report per
scenario pass counts, note that fifteen samples per condition cannot establish a
precise effect size, and list any scenario that was not run.
