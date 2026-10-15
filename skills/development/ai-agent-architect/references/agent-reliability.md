# Agent reliability guide

Provider features and prices change frequently. Confirm specifics in the current
documentation for the SDK and models in use.

## Choosing the structure

| Structure         | Use when                                                       | Main risk                         |
| ----------------- | -------------------------------------------------------------- | --------------------------------- |
| Code only         | Rules and inputs are well defined                              | None from the model               |
| Single model call | One judgment over language, such as classify or extract        | Malformed or wrong output         |
| Fixed workflow    | Known steps, some needing judgment                             | Errors compounding across steps   |
| Router            | Inputs fall into distinct categories with separate handling    | Misrouting                        |
| Agent loop        | Steps depend on intermediate results and cannot be planned     | Cost, loops, and unsafe actions   |
| Multiple agents   | Independent subtasks or context isolation pay for coordination | Inconsistent results, higher cost |

Move up this table only when evaluation shows the simpler structure fails.

## Tool design

- Name tools by action and object, and describe when to use them and when not to.
- Constrain parameters with enumerations, formats, and ranges; reject invalid
  calls in code with an explanatory error.
- Return compact, relevant results with pagination rather than whole documents.
- Make write tools idempotent with a request key, and require approval tokens
  for consequential operations.
- Run tools with the end user's permissions, not the service's broadest access.

## Prompt injection defenses

No single defense is sufficient; combine them.

- Mark untrusted content clearly and instruct the model to treat it as data, but
  do not rely on this alone.
- Separate duties: a model that reads untrusted content has no privileged tools;
  privileged steps receive only validated, structured fields.
- Restrict outbound requests and rendered links or images that could exfiltrate
  data, and disable tools not needed for the current step.
- Require human approval for consequential actions, showing the exact parameters.
- Keep secrets out of model context; tools fetch credentials server-side.
- Include injection attempts in evaluation sets, including indirect injection
  through retrieved documents and tool results.

## Memory

| Type                | Contents                                 | Controls                                        |
| ------------------- | ---------------------------------------- | ----------------------------------------------- |
| Working context     | Current task, recent turns, tool results | Trim and summarize; keep instructions stable    |
| Retrieval           | Documents and records                    | Access control at query time; cite sources      |
| Durable user memory | Preferences and facts the user confirmed | Explicit write rules, user visibility, deletion |

Memory written from untrusted content can carry injected instructions into later
sessions. Store facts as structured fields where possible, with provenance.

## Evaluation

- Build datasets from real task distributions, with personal data removed or
  synthesized, plus edge and adversarial cases. Keep a held-out set.
- Prefer exact or programmatic graders: schema validity, field accuracy, tool
  call correctness, and policy compliance.
- For subjective quality, use model-based graders with a written rubric, and
  measure their agreement with human labels before trusting them.
- Evaluate trajectories for agents: tools chosen, arguments, number of steps, and
  whether approval gates were respected.
- Run several samples per case when outputs vary, and report the pass rate with
  sample counts. Track results by model, prompt, and tool version.
- Gate changes in CI on the evaluation suite, with thresholds per critical metric.

## Cost and latency

- Measure tokens, cost, and latency per task, including retries and tool time.
- Cache stable prompt prefixes when the provider supports it, by placing fixed
  instructions and tool definitions first.
- Route easy cases to smaller models and escalate only on low confidence or
  validation failure, verified by evaluation.
- Run independent calls in parallel, use batch interfaces for offline work, and
  stream responses to users.
- Cap output length, loop iterations, and total spend per task, and alert on
  anomalies.

## Approval gates

Require approval for actions that are irreversible, external, financial,
permission-changing, or affect many records. The approval request shows the
action, exact parameters, the evidence the model relied on, and the expected
effect. Record the approver, time, and outcome. Expired or modified requests
require new approval.
