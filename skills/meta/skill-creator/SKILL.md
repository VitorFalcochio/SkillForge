---
name: skill-creator
description: Create a new reusable agent skill from a described task, covering purpose and activation analysis, overlap detection against existing skills, valid SKILL.md frontmatter, repeatable workflow design, inputs, outputs, constraints, verification criteria, examples, optional references or scripts, and validation. Use when someone asks to write, scaffold, or draft a new skill for Claude Code, Codex, or an Agent Skills catalog. Asks for missing critical requirements and never overwrites an existing skill without authorization.
license: MIT
---

# Skill Creator

Turn a recurring task into a skill that changes what an agent decides and does.
A skill earns its place by encoding decisions, checks, and limits the agent would
not otherwise apply; restating general competence adds context without value.

## Inputs and outputs

Collect the task the skill supports, the people who will invoke it, three or
more realistic requests that should activate it, one or two similar requests that
should not, the deliverable, permitted side effects, target hosts, and any
domain rules. Infer what you can from the request and repository. Ask before
writing when the task, deliverable, or permitted side effects are unknown; do not
invent domain policy to fill the gap.

Deliver a skill directory containing `SKILL.md` and only the supporting files it
needs, validation results, the activation examples used, and any open questions.
When working in an AgentSkills catalog, also propose evaluation scenarios.

## Workflow

1. Capture the purpose in one sentence of the form “When asked to X, produce Y
   while respecting Z.” If you cannot write it, ask focused questions about the
   missing part. Keep questions to those whose answers change the skill.
2. Check for overlap. List existing skills in the catalog and in the host's skill
   folders, such as `.claude/skills` and `.agents/skills`, and compare
   descriptions and workflows. If an existing skill covers most of the request,
   recommend extending or narrowing it instead, and state the boundary.
3. Choose the identifier and location. Follow the naming rules in
   [the skill format reference](references/skill-format.md) and the catalog's
   category layout. If the target directory already exists, stop and ask for
   explicit authorization before replacing or editing any file in it.
4. Write the description, which drives implicit activation: what the skill does,
   the nouns users actually say, “Use when” or “Use for” conditions, and any
   guarantee or boundary. Test it against the activating and non-activating
   requests from the inputs.
5. Design the workflow as numbered steps an agent can follow and check. Each
   step names an action and the decision criterion that governs it. Include the
   points where the agent must stop and ask, and gate every side effect beyond
   reading and local analysis. Remove advice any competent agent already follows.
6. Define inputs and outputs, constraints, verification criteria phrased as
   observable results, and at least one realistic example showing how the
   workflow handles a concrete request, including a limit or refusal where relevant.
7. Apply progressive disclosure. Keep the entry point focused and move detail
   needed only for some tasks into reference files linked from the step that needs
   them. Add a script only for a deterministic operation the agent would otherwise
   reimplement each time, and document its interpreter and inputs. Scripts trigger
   a review warning in this catalog's validator; never run a script you did not review.
8. Validate. In an AgentSkills checkout run `pnpm agentskills validate` on the new
   directory with `--strict`, then validate the whole catalog to catch duplicate
   names. Elsewhere, check the rules in the format reference by hand and say that
   no validator ran. Walk each activation example through the workflow and fix
   steps that leave a decision open.

## Constraints

- Never overwrite, rename, or delete an existing skill or file without explicit
  authorization for that path. Write new skills into a new directory.
- Do not invent business rules, compliance requirements, or tool capabilities.
  Mark assumptions and unresolved questions in your report instead.
- Keep frontmatter portable: `name`, `description`, and optional `license`,
  `compatibility`, and `metadata`. Put host-specific configuration elsewhere.
- Do not include secrets, personal data, or proprietary content in instructions,
  examples, or fixtures.
- Do not claim the skill improves agent results; that requires evaluation.

## Verification criteria

The validator reports no errors or warnings, or every remaining warning is
explained. The name matches its folder and is unique in the catalog. The
description distinguishes the activating examples from the non-activating ones.
Every workflow step is actionable and every side effect has a gate. The example
exercises the workflow. No existing file was modified without authorization.

## Example

Request: “Make a skill for our release process.”

The deliverable and permitted actions are unclear, so ask which outputs are
expected (release notes, version bump, tag, or deployment) and which actions the
agent may take. Suppose the answer is “draft release notes from merged changes;
never tag or publish.” Find that no existing skill covers release notes, create a
`release-notes-writer` directory, and write a workflow that gathers merged
changes, groups them by user impact, and flags breaking changes for confirmation.
State that tagging and publishing are out of scope. Validate strictly and
propose three scenarios, including a request to publish that the skill declines.
