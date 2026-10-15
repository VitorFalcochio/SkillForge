# Delivery checklist

Use the sections relevant to the change. Platform documentation for the
project's CI system, registry, and orchestrator takes precedence.

## Containers

- Pin the base image to a version tag and, where the project tracks them, a digest.
  Prefer minimal or distroless runtime images when the application supports them.
- Use multi-stage builds: compile and install development dependencies in a
  builder stage, and copy only runtime artifacts into the final stage.
- Create and switch to a non-root user. Avoid privileged mode and extra Linux
  capabilities at runtime.
- Keep a `.dockerignore` that excludes version control data, local environment
  files, dependencies installed on the host, and build output.
- Copy dependency manifests and install before copying source to reuse cache.
- Pass build-time secrets through the builder's secret mounts, not `ARG` or `ENV`,
  which persist in image metadata or history.
- Handle termination signals so the process shuts down gracefully, and define
  health or readiness checks where the platform uses them.

## Pipelines

- Set explicit, minimal token permissions per job.
- Pin third-party actions or plugins to a full commit SHA or an immutable version.
- Do not run untrusted pull request code with access to secrets or write tokens.
- Prefer short-lived federated credentials, such as OIDC, over long-lived keys.
- Build once, record the artifact digest, and promote that artifact; do not
  rebuild per environment.
- Gate production with protected environments and required approvals.
- Keep jobs deterministic: lock files, pinned tool versions, and no reliance on
  mutable `latest` tags.

## Configuration and secrets

| Kind                         | Location                                          |
| ---------------------------- | ------------------------------------------------- |
| Nonsensitive per-environment | Environment variables or config files in the repo |
| Secrets                      | Platform secret store, injected at runtime        |
| Feature toggles              | Existing flag system, with ownership and cleanup  |

Validate configuration at startup with clear errors naming the missing key but
never its value. Committed example files contain placeholders only. Any secret
found in version control is treated as compromised and handed to its owner for
rotation.

## Deployment strategies

| Strategy   | Use when                                            | Requires                                        |
| ---------- | --------------------------------------------------- | ----------------------------------------------- |
| Rolling    | Stateless services with backward-compatible changes | Readiness checks and surge capacity             |
| Blue-green | Fast switch-back is required                        | Duplicate capacity and a traffic switch         |
| Canary     | Risky changes with measurable health signals        | Traffic splitting and automated metric analysis |
| Flags      | Separating deploy from release                      | A flag system and a plan to remove the flag     |

## Infrastructure as code

Run formatting and validation, then produce a plan or diff for review. Highlight
destroy and replace actions on databases, volumes, queues, and DNS. Keep state
remote, locked, and access-controlled. Detect drift before applying. Applying is
always an authorized human-approved step.

## Observability and rollback

Define before release: the dashboards or queries for error rate, latency, and
saturation; the alert thresholds tied to SLOs; and the log fields needed to
correlate a request. A rollback plan states the trigger, the action such as
redeploying the previous artifact or disabling a flag, data compatibility
constraints, expected time to recover, and the decision owner. Database changes
use expand and contract so that rolling back the application does not require
rolling back data.
