---
name: skill-optimizer
description: Improve an existing agent skill without changing its intended behavior, covering instruction clarity, redundant content, activation precision, context size, progressive disclosure through references, preservation of constraints, checks against existing examples and evaluations, and before-and-after documentation. Use when asked to tighten, shorten, clarify, restructure, or fix activation of a skill. Never claims token or quality improvements without measurement.
license: MIT
---

# Skill Optimizer

Make a skill easier for an agent to follow and cheaper to load while keeping what
it does. The original behavior, especially every constraint and authorization
gate, is the contract; the wording is what may change.

## Inputs and outputs

Identify the skill and its revision, the problem to address (unclear steps,
wrong activation, excessive length, or disorganized references), existing
examples and evaluation suites, known failure reports, and whether behavior
changes are authorized. Assume they are not unless the user says otherwise.

Deliver the revised skill files, a behavior contract checklist showing each
preserved item, a before-and-after table of measured sizes, validator and
evaluation results, and a list of proposed behavior changes awaiting approval.

## Workflow

1. Write the behavior contract before editing: activation scope, each workflow
   decision, every constraint and authorization gate, required outputs, and the
   examples. Keep a copy of the original or confirm version control holds it.
2. Measure the baseline with reproducible methods: lines, words, and bytes of
   `SKILL.md` and each reference; the validator result; and existing evaluation
   results. Report tokens only from a named tokenizer actually run. Use
   [the optimization guide](references/optimization-guide.md) for measurement
   commands, common problems, and the report template.
3. Diagnose with evidence from the text: vague verbs without criteria, repeated
   statements, generic advice that changes no decision, conditional detail that
   is always loaded, activation wording that misses user vocabulary or overlaps
   another skill, and references not linked from the step that needs them.
4. Classify each proposed change as wording or structure (behavior preserved),
   activation (changes when the skill is selected), or behavior (changes what the
   agent does). Apply only the first kind by default; present the others with
   rationale and wait for explicit authorization.
5. Edit. Merge duplicates, replace vague phrases with criteria, move conditional
   detail into references linked from the relevant step, and keep constraints and
   authorization gates in `SKILL.md`, where they are always loaded.
6. Verify against the contract item by item, run the validator strictly, walk
   each existing example through the revised workflow, and run any evaluation
   suite with the same protocol as the baseline, including static checks.
7. Measure again with the same methods and report the differences, the contract
   checklist, and what remains unverified, such as agent behavior without new
   evaluation runs.

## Constraints

- Do not change the skill's intended behavior, scope, constraints, or outputs
  without explicit authorization for that change.
- Never remove or weaken a safety constraint or authorization gate, and never
  move one out of `SKILL.md` into an optional reference.
- Never claim token savings, faster responses, or better results without
  before-and-after measurements; label untested expectations as hypotheses.
- Do not rename the skill or its folder without authorization, since installs
  and references depend on the identifier.
- Keep instructions host-neutral; do not add host-specific features to make a
  skill shorter.

## Verification criteria

Every behavior contract item is present in the revision or listed as an
authorized change. The validator passes strictly. Existing examples remain
consistent with the workflow, and evaluation static checks pass. Reported size
changes come from the same measurement method before and after. Claims about
agent behavior cite evaluation runs or are labeled unverified.

## Example

Request: “This skill is 300 lines and agents skip half of it. Make it shorter.”

Record the contract: twelve workflow decisions, five constraints including a
production authorization gate, and two examples. Measure 300 lines, 2,940 words,
and 19 KB, as reported by the commands used. Find that a 120-line framework
tutorial is needed only for migrations and that three constraints are stated
twice. Move the tutorial into a reference linked from the migration step, merge
the duplicates, and keep the authorization gate in the entry point. Validate,
check each contract item, and report the measured new sizes. Note that whether
agents now follow more steps is unverified until evaluation runs are repeated.
